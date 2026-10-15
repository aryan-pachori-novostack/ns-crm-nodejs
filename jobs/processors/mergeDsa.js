const { QueryTypes } = require("sequelize");
const { bulkCreate } = require("../../api/services/application-log-services");
let DSAService = require(_pathconst.ServicesPath.DSAService);
let uuid = require('node-uuid');

const updateFields = async (tables, set_fields, replacements, where_field, toBeRemoved) => {
    let temp_dsa_id = uuid();
    let temp_dsa_mobile_number = uuid();
    let replace_kyc = Boolean(tables[0] == "ru_dsa_kyc_data" && replacements[0] != replacements[2][0]);

    if (replace_kyc) {
        query = ` update ru_dsa_kyc_data set dsa_id = '${temp_dsa_id}', dsa_mobile_number = '${temp_dsa_mobile_number}' where ${where_field} `;
        await _db2.query(query, { replacements: toBeRemoved, type: QueryTypes.UPDATE });
    };

    for (let i = 0; i < tables?.length; i++) {
        if (toBeRemoved && tables[i] != "ru_dsa_kyc_data" && tables[i] != "ru_dsa_expenses" && tables[i] != "ru_dsa_expense_items") {
            query = ` delete from ${tables[i]} where ${where_field} `;
            await _db2.query(query, { replacements: toBeRemoved, type: QueryTypes.DELETE });
        };
        query = ` update ${tables[i]} set ${set_fields} where ${where_field} `;
        await _db2.query(query, { replacements: replacements, type: QueryTypes.UPDATE });
    };

    if (replace_kyc) {
        let replacements_new = [replacements[2][0], replacements[3][0], [temp_dsa_id], [temp_dsa_mobile_number]];
        query = ` update ru_dsa_kyc_data set ${set_fields} where ${where_field} `;
        await _db2.query(query, { replacements: replacements_new, type: QueryTypes.UPDATE });

        await _db2.query(
            `UPDATE ru_user_onboarding_steps a
            JOIN ru_user_onboarding_steps b
              ON a.dsa_id = ?
             AND b.dsa_id = ?
             AND a.step = b.step
             AND a.step IN ('kyc','dsa_agreement')
             AND a.status IS NOT NULL
             AND b.status IS NOT NULL
            SET
              a.status = b.status,
              b.status = 0`,
            { replacements: [replacements[2][0], replacements[0]], type: QueryTypes.UPDATE }
        );
    };
};

module.exports = async function (job) {
    try {
        const { updateRecords, dsaIdArray, primary_dsa, secondary_dsa, logs, keep_secondary_email, user_id } = job?.data;

        // Retrieve latest emails and verified status from DB
        const [primaryDsaDb] = await _db2.query(
            `SELECT email_address, is_email_address_verified FROM ru_direct_selling_agents WHERE dsa_id = ?`,
            { replacements: [primary_dsa.dsa_id], type: QueryTypes.SELECT }
        );

        const [secondaryDsaDb] = await _db2.query(
            `SELECT email_address, is_email_address_verified FROM ru_direct_selling_agents WHERE dsa_id = ?`,
            { replacements: [secondary_dsa.dsa_id], type: QueryTypes.SELECT }
        );

        if (secondaryDsaDb && secondaryDsaDb.email_address) {
            const secondaryHasVerifiedEmail = Number(secondaryDsaDb.is_email_address_verified) === 1;

            if (keep_secondary_email && secondaryHasVerifiedEmail) {
                // Rename secondary email to release the unique constraint
                const tempSecondaryEmail = `${secondaryDsaDb.email_address}_merged_${Date.now()}`;
                await _db2.query(
                    `UPDATE ru_direct_selling_agents 
                     SET email_address = ?, is_email_address_verified = 0 
                     WHERE dsa_id = ?`,
                    { replacements: [tempSecondaryEmail, secondary_dsa.dsa_id], type: QueryTypes.UPDATE }
                );

                // Assign the verified email to the primary DSA
                await _db2.query(
                    `UPDATE ru_direct_selling_agents 
                     SET email_address = ?, is_email_address_verified = 1 
                     WHERE dsa_id = ?`,
                    { replacements: [secondaryDsaDb.email_address, primary_dsa.dsa_id], type: QueryTypes.UPDATE }
                );

                if (logs && Array.isArray(logs)) {
                    logs.push(`Email address updated from ${primaryDsaDb?.email_address || 'None'} to ${secondaryDsaDb.email_address} (verified) due to merge.`);
                }
            } else {
                // Just release the secondary email so it doesn't cause unique constraint violations
                const tempSecondaryEmail = `${secondaryDsaDb.email_address}_merged_${Date.now()}`;
                await _db2.query(
                    `UPDATE ru_direct_selling_agents 
                     SET email_address = ?, is_email_address_verified = 0 
                     WHERE dsa_id = ?`,
                    { replacements: [tempSecondaryEmail, secondary_dsa.dsa_id], type: QueryTypes.UPDATE }
                );
            }
        }

        let secondaryKyc = await _db2.query(
            `SELECT permanent_account_number, netsuite_vendor_id, is_permanent_account_number_verified FROM ru_dsa_kyc_data WHERE dsa_id = ?`,
            { replacements: [secondary_dsa.dsa_id], type: QueryTypes.SELECT }
        );

        let secondaryCompany = await _db2.query(
            `SELECT * FROM ru_companies WHERE registered_by = ?`,
            { replacements: [secondary_dsa.dsa_id], type: QueryTypes.SELECT }
        );

        let dsa_pan = secondaryKyc[0]?.permanent_account_number || secondaryCompany[0]?.pan;

        const panIsNotP = dsa_pan && typeof dsa_pan === 'string' && dsa_pan.length >= 4 && dsa_pan.charAt(3).toUpperCase() !== 'P';

        if (panIsNotP) {
            let primaryCompany = await _db2.query(
                `SELECT * FROM ru_companies WHERE registered_by = ?`,
                { replacements: [primary_dsa.dsa_id], type: QueryTypes.SELECT }
            );

            let dateOfIncorp = null;
            if (secondary_dsa.date_of_birth) {
                const parsedDate = new Date(secondary_dsa.date_of_birth);
                if (!isNaN(parsedDate.getTime())) {
                    dateOfIncorp = parsedDate;
                }
            }

            if (primaryCompany && primaryCompany.length > 0) {
                await _db2.query(
                    `UPDATE ru_companies SET 
                        name = ?, 
                        short_name = ?, 
                        phone = ?, 
                        pan = ?, 
                        gstin = ?, 
                        date_of_incorp = ?, 
                        business_type = ?, 
                        verification_status = ?,
                        ns_internal_id = ?, 
                        is_pan_verified = ?, 
                        updated_at = NOW() 
                     WHERE company_id = ?`,
                    {
                        replacements: [
                            secondary_dsa.company_name || secondary_dsa.full_name || null,
                            secondary_dsa.company_name || secondary_dsa.full_name || null,
                            secondary_dsa.dsa_mobile_number || null,
                            dsa_pan || null,
                            secondary_dsa.gstin || null,
                            dateOfIncorp,
                            secondary_dsa.profession || null,
                            secondary_dsa.dsa_verification_status || null,
                            secondaryKyc[0]?.netsuite_vendor_id || null,
                            secondaryKyc[0]?.is_permanent_account_number_verified || 0,
                            primaryCompany[0].company_id
                        ],
                        type: QueryTypes.UPDATE
                    }
                );
            } else {
                if (dsa_pan) {
                    const newCompanyId = uuid();

                    await _db2.query(
                        `INSERT INTO ru_companies (
                            company_id, 
                            name, 
                            short_name, 
                            phone, 
                            pan, 
                            gstin, 
                            date_of_incorp, 
                            business_type, 
                            registered_by, 
                            verification_status,
                            ns_internal_id, 
                            is_pan_verified, 
                            created_at, 
                            updated_at
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                        {
                            replacements: [
                                newCompanyId,
                                secondary_dsa.company_name || secondary_dsa.full_name || null,
                                secondary_dsa.company_name || secondary_dsa.full_name || null,
                                secondary_dsa.dsa_mobile_number || null,
                                dsa_pan || null,
                                secondary_dsa.gstin || null,
                                dateOfIncorp,
                                secondary_dsa.profession || null,
                                primary_dsa.dsa_id,
                                secondary_dsa.dsa_verification_status || null,
                                secondaryKyc[0]?.netsuite_vendor_id || null,
                                secondaryKyc[0]?.is_permanent_account_number_verified || 0
                            ],
                            type: QueryTypes.INSERT
                        }
                    );

                    await _db2.query(
                        `UPDATE ru_direct_selling_agents SET company_id = ?, user_type = 'company', business_mode = 'company' WHERE dsa_id = ?`,
                        { replacements: [newCompanyId, primary_dsa.dsa_id], type: QueryTypes.UPDATE }
                    );
                }
            }
        }

        for (let j = 0; j < updateRecords?.length; j++) {
            const { tables, set_fields, replacements, where_field, remove } = updateRecords[j];
            await updateFields(tables, set_fields, replacements, where_field, remove);
        };

        let prevCount = primary_dsa?.heirarchy_level || 0;
        for (let k = 0; k < dsaIdArray?.length; k++) {
            await DSAService.reassignPartner(dsaIdArray[k], primary_dsa?.dsa_mobile_number, prevCount);
        };

        query = ` select * from ru_companies where registered_by = ? `;
        let company = await _db2.query(query, { replacements: [secondary_dsa?.dsa_id], type: QueryTypes.SELECT });
        let company_id = company[0]?.company_id || null;

        if (company_id) {
            query = ` update ru_direct_selling_agents set is_deleted = 1, company_id = case when company_id is null or company_id = "" then "${company_id}" else company_id end where dsa_id = ? `;
            await _db2.query(query, { replacements: [secondary_dsa?.dsa_id], type: QueryTypes.UPDATE });

            query = ` update ru_companies set registered_by = ? where registered_by = ? `;
            await _db2.query(query, { replacements: [primary_dsa?.dsa_id, secondary_dsa?.dsa_id], type: QueryTypes.UPDATE });
        } else {
            query = ` update ru_direct_selling_agents set is_deleted = 1 where dsa_id = ? `;
            await _db2.query(query, { replacements: [secondary_dsa?.dsa_id], type: QueryTypes.UPDATE });
        };

        await bulkCreate([["merge_dsa", "", logs]], primary_dsa?.dsa_id, "dsa", user_id);
    } catch (e) {
        console.log(e)
    };
};