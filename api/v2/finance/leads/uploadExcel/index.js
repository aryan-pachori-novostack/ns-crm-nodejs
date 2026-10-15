const { QueryTypes } = require('sequelize');

const { logger } = require("../../../../helpers/logger");
const { sequelize } = require('../../../../../jobs/db');
const { uploadArrayToS3 } = require("../../../../helpers/commonhelper");
const { isFinanceRootUser } = require("../../../../services/finance-services");
const { buildUploadExcelPipeline } = require("./uploadExcelPipeline");
const { saveClaim, saveClaimPair } = require("../claims/FreshLeadClaimService");
const { buildClaimPair } = require("../claims/claimPairBuilder");
const { buildClaimPairPipeline } = require("../claims/claimPairValidators");
const uuid = require('node-uuid');
const { assignBucket } = require("./uploadExcelReport");
const { excelLeadColumnMapping } = require("./uploadExcelHelpers");
const { buildExcelClaimContext } = require("../claims/adapters/excelRowAdapter");
const { trimObject, createRowErrorCollector, createSharerErrorCollector } = require("./uploadExcelHelpers");

const GENERIC_ROW_ERROR = `Error Into The Data Provided. Please Provide all the Mandatory Fields and all fields in desired format`;

/**
 * Bulk Excel upload of disbursed lead claims (Bull job `Upload Lead Form Data`).
 *
 * Serves both `POST dsa/uploadLeadFormData` (CRM) and `.../uploadLeadFormDataExternal`
 * (DSA self-service, `isExternal`). Each Excel row runs the same validation pipeline;
 * a row that fails is recorded with its error and the batch continues. Every row —
 * passed or failed — is written to an S3 report linked from `application_logs`.
 */
const processUploadLeadFormData = async function (job) {
    try {
        const { data, leader, file_name, lead_admin_dsa_id, parent_user, isExternal } = job.data;

        const updatedByExpr = isExternal ? "UNHEX(LPAD(REPLACE(?,'-',''),32,'0'))" : 'uuid_to_bin(?)';
        const externalWhere = isExternal ? ' AND is_external = 1 ' : '';
        const externalCol = isExternal ? ', is_external' : '';
        const externalVal = isExternal ? ', 1' : '';

        // Same file from the same uploader is processed once only.
        const fileAlreadyExistsQuery = ` SELECT * FROM application_logs WHERE updated_by = ${updatedByExpr} AND application_id = ? ${externalWhere} ORDER BY createdAt DESC LIMIT 1; `;
        const fileAlreadyExists = await sequelize.query(fileAlreadyExistsQuery, { replacements: [leader.id, file_name], type: QueryTypes.SELECT });
        if (fileAlreadyExists[0]) return;

        const insertLogQuery = ` insert into application_logs (application_type, application_id, updated_by, createdAt, updatedAt${externalCol}) values ('lead_claim_upload',?,${updatedByExpr},?,?${externalVal}) `;
        await sequelize.query(insertLogQuery, { replacements: [file_name, leader.id, new Date(), new Date()], type: QueryTypes.INSERT });

        //TODO : implement better logger
        logger.info(file_name);

        const dataNew = trimObject(data);
        const isFinanceRoot = await isFinanceRootUser(leader?.userPhone);
        const jobMeta = { leader, file_name, lead_admin_dsa_id, parent_user, isExternal, isFinanceRoot };

        const report = { userDetailsError: [], failureCount: 0 };
        const onRowError = createRowErrorCollector(report);
        // Redirects the sharer's failure onto the primary's row — see the helper.
        const onSharerError = createSharerErrorCollector(report);
        const pipeline = buildUploadExcelPipeline();

        for (let i = 0; i < dataNew.length; i++) {
            // The adapter normalises the row into a LeadClaimContext; it parses leniently
            // and never throws, so parse failures surface at their original position in
            // the validator chain rather than pre-empting a mandatory-field error.
            const ctx = await buildExcelClaimContext(dataNew[i], i, jobMeta);
            try {
                // A payout-sharing row becomes TWO claims. `buildClaimPair` returns null
                // for every ordinary row, leaving the path below untouched. It runs before
                // the pipeline because both halves must validate fully before either is
                // written — the pair is all-or-nothing.
                //
                // Its own try/catch, because it runs OUTSIDE the pipeline and so has no
                // `onCustomError` of its own: the outer catch below would rewrite a
                // deliberate rejection (an external upload carrying sharing columns) as
                // `GENERIC_ROW_ERROR`, and the uploader would never learn why. A
                // `type: "custom"` failure is a rejected row like any other — stamp the real
                // message via the collector, which also pushes the row, hence `continue`.
                // Anything else is a genuine crash and belongs to the outer catch.
                let pair;
                try {
                    pair = buildClaimPair(ctx, { mintId: uuid.v4 });
                } catch (err) {
                    if (err?.type !== "custom") throw err;
                    await onRowError(err, ctx);
                    continue;
                }

                const { aborted } = await pipeline.run(ctx, onRowError);
                // A rejected row has already been recorded by the collector.
                if (aborted) continue;

                if (pair) {
                    // The sharer runs the SAME chain. Its errors are re-stamped onto the
                    // PRIMARY's row: `ctx.row` carries error/bucket in single slots and the
                    // collector pushes the row object itself, so reporting the sharer's own
                    // (detached shadow) row would lose the line entirely.
                    const sharerRun = await pipeline.run(pair.sharer, onSharerError);
                    if (sharerRun.aborted) continue;

                    // Pair rules need both halves fully resolved — the combined payout cap
                    // reads rates that only exist after each chain's master-rate fallback.
                    const pairRun = await buildClaimPairPipeline().run(pair, onRowError);
                    if (pairRun.aborted) continue;

                    const paired = await saveClaimPair(pair);
                    assignBucket(ctx);
                    // Both ids on the ONE report row, so an operator can trace the pair
                    // back from the output file. Seeded blank on every row by the adapter
                    // so the S3 header (taken from row 0 only) always contains the column.
                    ctx.row.payout_sharing_lead_ids = paired.claims.map((c) => c.fresh_lead_id).join(" | ");
                    report.userDetailsError.push(dataNew[i]);
                    continue;
                }

                // One write path for every channel: repository + mapper + side effects,
                // coordinated by the service. `columnMapping` lets the shared activity-log
                // effect translate this channel's keys into column names.
                await saveClaim(ctx, { columnMapping: excelLeadColumnMapping });
                assignBucket(ctx);
            } catch (err) {
                logger.error(`Lead Form Upload Error ${dataNew[i].loan_app_no}: ${err}`);
                dataNew[i].error = GENERIC_ROW_ERROR;
                report.failureCount++;
            }

            report.userDetailsError.push(dataNew[i]);
        }

        const file = await uploadArrayToS3(report.userDetailsError);
        const updateLogQuery = ` update application_logs set  field = ?,from_value =?,to_value=? , updatedAt = ? WHERE updated_by = ${updatedByExpr} AND application_id = ? ${externalWhere} `;
        await sequelize.query(updateLogQuery, {
            replacements: [file, dataNew.length - report.failureCount, report.failureCount, new Date(), leader.id, file_name],
            type: QueryTypes.UPDATE
        });
    } catch (e) {
        logger.error(e);
        logger.error(e.message);
    }
};

module.exports = { processUploadLeadFormData };
