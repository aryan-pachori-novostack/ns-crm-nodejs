const {
    ErpValidatorPipeline,
    LeadDisbursementDateValidator,
    LeadLoanApacNumberValidator,
    LeadPayoutDetailsValidator,
    LeadVendorPayoutCapsValidator,
    LeadSameDayBillingValidator,
    LeadPersonalLoanDisbursementValidator,
    LeadMaxDisbursementAmountValidator,
    LeadRateRatioCollideValidator,
    LeadSiblingDisbursementDateMatchValidator,
    LeadSiblingCombinedPayoutCapValidator,
    LeadDisbursementAmountCompareValidator,
    LeadErpSourceBuildValidator
} = require("./erpValidators");
const {
    buildErpSseContext,
    buildAutoErpContext,
    createErpPipelineOnCustomError,
    normalizeErpSubmit,
    SSEProgressHandler,
    groupLeadsByDsa,
    buildDsaEmailRecipientMap,
    panLeadProgressPercent
} = require("./erpHelpers");
const { erpSubmitFreshLeads } = require("./freshLeadMsClient");
const { verifyPanForErpLead, buildInitialSummary } = require("./leadPanVerification");
const { verifyCustomerEmailForErpLead, buildLeadByFreshLeadId } = require("./leadEmailVerification");
const { sendDsaSpecificEmails } = require("./mailHandler");
const { logLeadErpSubmission } = require("../../../../services/lead-log-services");
const { SYSTEM_BOT_UUID } = require("../../../../helpers/constantdata/config");
const ValidationPipeline = require("../../ValidationPipeline");
const { FinanceRootContextValidator } = require("../../financeRootPrivilegeAuth");

exports.sendLeadFormToErpSSE = async (req, sse) => {
    // Resolve finance root once per request, not inside the per-lead pipeline: each lead run
    // uses a fresh context object (`{ lead, isMaster, finalObj, req }`), so a first-step
    // FinanceRootContextValidator there would re-call `isFinanceRootUser` for every lead.
    const masterCtx = { req };
    await new ValidationPipeline().use(new FinanceRootContextValidator()).run(masterCtx);
    const isMaster = masterCtx.isMaster;
    const context = await buildErpSseContext({ req, sse, isMaster });
    const progress = new SSEProgressHandler(sse);

    if (context.noLeads || !context.leads?.length) {
        return sse.sendComplete(true, "No leads to process");
    }

    progress.validationLeads(context.leads.length);

    const perLeadPipeline = new ErpValidatorPipeline()
        .use(new LeadDisbursementDateValidator())
        .use(new LeadLoanApacNumberValidator())
        .use(new LeadPayoutDetailsValidator())
        .use(new LeadSameDayBillingValidator())
        .use(new LeadPersonalLoanDisbursementValidator())
        .use(new LeadMaxDisbursementAmountValidator())
        .use(new LeadVendorPayoutCapsValidator())
        .use(new LeadRateRatioCollideValidator())
        .use(new LeadSiblingDisbursementDateMatchValidator())
        .use(new LeadSiblingCombinedPayoutCapValidator())
        .use(new LeadDisbursementAmountCompareValidator())
        .use(new LeadErpSourceBuildValidator());

    const onPipelineCustomError = createErpPipelineOnCustomError(context);

    for (let i = 0; i < context.leads.length; i++) {
        await perLeadPipeline.run(
            { lead: context.leads[i], isMaster, finalObj: context.finalObj, req },
            onPipelineCustomError
        );
    }

    if (!context.finalObj?.length) {
        return sse.sendComplete(false, context.errorMsg?.[0] || "No valid leads to send");
    }

    const summary = buildInitialSummary(context.errorObj, context.errorMsg);
    const finalObjLength = context.finalObj.length;
    const leadById = buildLeadByFreshLeadId(context.leads);

    progress.panAndErpBatchIntro(finalObjLength);

    for (let i = 0; i < finalObjLength; i++) {
        const item = context.finalObj[i];

        progress.emailLead(i, finalObjLength);
        const emailOk = await verifyCustomerEmailForErpLead({
            item,
            leadById,
            summary,
            sse,
            skipEmailVerification: context.skipEmailVerification,
            skipEmailCheckLeadIds: context.skipEmailCheckLeadIds,
            interactivePartnerEmailGate: true,
            emailStepProgress: panLeadProgressPercent(i, finalObjLength)
        });
        if (!emailOk) {
            continue;
        }

        progress.panLead(i, finalObjLength);

        const proceedToErp = await verifyPanForErpLead({
            item,
            summary,
            sse,
            skipVerification: context.skipVerification
        });
        if (!proceedToErp) {
            continue;
        }

        try {
            const { status, message, data } = await erpSubmitFreshLeads([item], { isGetError: 1 });
            const normalized = normalizeErpSubmit({ status, message, data });

            sse.sendMessage("erpResponse", {
                itemId: item.id,
                status: normalized.ok,
                message: normalized.message
            });

            if (status && normalized.sentIds.length) {
                summary.successCount++;
                summary.sentToErpArray.push(item.id);
                summary.sentToErpClaimIds.push(item.claimId);
            } else {
                summary.errorCount++;
                summary.notSentToErpArray.push(item.id);
                summary.errorArray.push(normalized.message || `Lead ${item.id}: ERP error`);
            }

            progress.erpLeadProcessed(i, finalObjLength);
        } catch (err) {
            summary.errorCount++;
            summary.notSentToErpArray.push(item.id);
            summary.errorArray.push(`Lead ${item.id}: ${err.message}`);
            progress.erpLeadProcessed(i, finalObjLength, { error: true });
        }
    }

    if (summary.sentToErpClaimIds.length) {
        const userId = req?.loggedInUser?.id;
        await logLeadErpSubmission(summary.sentToErpClaimIds, userId);
    }

    const gateCount = (summary.partnerEmailVerifyRequired || []).length;
    const s = summary.successCount;
    const e = summary.errorCount;

    let finalMessage;
    const completeOk = e === 0 && gateCount === 0;

    if (gateCount > 0) {
        if (e > 0) {
            finalMessage = `Sent ${s} leads, ${e} errors, ${gateCount} lead(s) waiting on partner email verification (see dialog).`;
        } else if (s > 0) {
            finalMessage = `Sent ${s} lead(s) to ERP; ${gateCount} other lead(s) need partner email verification before PAN (see dialog).`;
        } else {
            finalMessage =
                gateCount === 1
                    ? "Partner email verification required before PAN/ERP. Use the dialog to enter or fix email, send OTP, verify, then re-run — or skip email check and send via skipEmailCheckLeadIds."
                    : `Partner email verification required for ${gateCount} leads before PAN/ERP. Use the dialog per lead, then re-run — or pass their IDs in skipEmailCheckLeadIds to skip email check and still send to ERP.`;
        }
    } else if (e === 0) {
        finalMessage = `Successfully sent ${s} leads to ERP`;
    } else {
        finalMessage = `Sent ${s} leads, ${e} errors`;
    }

    return sse.sendComplete(completeOk, finalMessage, summary);
};

/**
 * Same flow as `sendLeadFormToErpSSE` but without SSE (returns plain JSON object).
 * Intended to be used with `safe()` wrapper in routes hit by schedulers.
 */
exports.autoErpHandler = async (req) => {
    const context = await buildAutoErpContext({ req });

    if (context.noLeads || !context.leads?.length) {
        return { success: false, message: "No leads to process", statusCode: 400, data: {} };
    }

    // `isMaster` comes from `buildAutoErpContext` (always false for scheduler / external-auth).
    const { isMaster } = context;

    const perLeadPipeline = new ErpValidatorPipeline()
        .use(new LeadDisbursementDateValidator())
        .use(new LeadLoanApacNumberValidator())
        .use(new LeadPayoutDetailsValidator())
        .use(new LeadSameDayBillingValidator())
        .use(new LeadPersonalLoanDisbursementValidator())
        .use(new LeadMaxDisbursementAmountValidator())
        .use(new LeadVendorPayoutCapsValidator())
        .use(new LeadRateRatioCollideValidator())
        .use(new LeadSiblingDisbursementDateMatchValidator())
        .use(new LeadSiblingCombinedPayoutCapValidator())
        .use(new LeadDisbursementAmountCompareValidator())
        .use(new LeadErpSourceBuildValidator());

    const onPipelineCustomError = createErpPipelineOnCustomError(context);

    for (let i = 0; i < context.leads.length; i++) {
        await perLeadPipeline.run(
            { lead: context.leads[i], isMaster, finalObj: context.finalObj, req },
            onPipelineCustomError
        );
    }

    const summary = buildInitialSummary(context.errorObj, context.errorMsg);

    if (!context.finalObj?.length) {
        return {
            success: false,
            message: context.errorMsg?.[0] || "No valid leads to send",
            statusCode: 200,
            data: summary
        };
    }

    const finalObjLength = context.finalObj.length;
    const leadById = buildLeadByFreshLeadId(context.leads);

    for (let i = 0; i < finalObjLength; i++) {
        const item = context.finalObj[i];

        const emailOk = await verifyCustomerEmailForErpLead({
            item,
            leadById,
            summary,
            sse: null,
            skipEmailVerification: context.skipEmailVerification,
            skipEmailCheckLeadIds: context.skipEmailCheckLeadIds
        });
        if (!emailOk) {
            continue;
        }

        const proceedToErp = await verifyPanForErpLead({
            item,
            summary,
            sse: null
        });
        if (!proceedToErp) {
            continue;
        }

        try {
            const { status, message, data } = await erpSubmitFreshLeads([item], { isGetError: 1 });
            const normalized = normalizeErpSubmit({ status, message, data });

            if (status && normalized.sentIds.length) {
                summary.successCount++;
                summary.sentToErpArray.push(item.id);
                summary.sentToErpClaimIds.push(item.claimId);
            } else {
                summary.errorCount++;
                summary.notSentToErpArray.push(item.id);
                summary.errorArray.push(normalized.message || `ERP error`);
            }
        } catch (err) {
            summary.errorCount++;
            summary.notSentToErpArray.push(item.id);
            summary.errorArray.push(`${err.message}`);
        }
    }

    const message =
        summary.errorCount === 0
            ? `Successfully sent ${summary.successCount} leads to ERP`
            : `Sent ${summary.successCount} leads, ${summary.errorCount} errors`;

    if (summary.successCount > 0 || summary.errorCount > 0) {
        const groupedLeads = groupLeadsByDsa(context.leads);
        const emailRecipientMap = await buildDsaEmailRecipientMap(context.leads);
        await sendDsaSpecificEmails(groupedLeads, emailRecipientMap, summary);
    }

    if (summary.sentToErpClaimIds.length) {
        await logLeadErpSubmission(summary.sentToErpClaimIds, SYSTEM_BOT_UUID);
    }

    return {
        success: summary.errorCount === 0,
        message,
        statusCode: 200,
        data: summary
    };
};
