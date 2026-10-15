const { QueryTypes } = require("sequelize");
const { uploadArrayToS3 } = require("../../api/helpers/commonhelper");
const { logger } = require("../../api/helpers/logger");
const { IST_NOW_SQL } = require("../../api/helpers/sql-time");
const { sequelize, _db3 } = require("../db");

function mapHeaderToField(header) {
    let clean = header.trim();
    if (clean.startsWith('*')) {
        clean = clean.substring(1).trim();
    }
    clean = clean.toLowerCase().replace(/[\s_-]+/g, '');
    
    if (clean === 'city') return 'city';
    if (['branchname', 'branch'].includes(clean)) return 'branch_name';
    if (['spid', 'salespersonid'].includes(clean)) return 'sp_id';
    if (['spname', 'salespersonname', 'name'].includes(clean)) return 'sp_name';
    if (['productid', 'product'].includes(clean)) return 'product_id';
    if (clean === 'code') return 'code';
    if (['pincode', 'pin'].includes(clean)) return 'pincode';
    if (['spemail', 'email'].includes(clean)) return 'sp_email';
    if (['spmobile', 'mobile', 'phone', 'mobile_number'].includes(clean)) return 'sp_mobile';
    if (['referenceid', 'reference'].includes(clean)) return 'reference_id';
    if (['locationtag', 'tags', 'tag'].includes(clean)) return 'location_tag';
    if (['isactive', 'status', 'active'].includes(clean)) return 'is_active';
    if (['isapproved', 'approved'].includes(clean)) return 'is_approved';
    
    return clean;
}

function getRowValue(row, dbField) {
    for (const key of Object.keys(row)) {
        if (mapHeaderToField(key) === dbField) {
            return row[key];
        }
    }
    return undefined;
}

module.exports = async function (job) {
    try {
        const { json, file_name, userId } = job?.data;
        const errData = [];
        let successCount = 0;
        let failureCount = 0;

        if (!json || json.length === 0) {
            return;
        }

        // Find keys starting with '*'
        const firstRow = json[0] || {};
        const matchKeys = Object.keys(firstRow).filter(key => key.trim().startsWith('*'));

        // Extract and resolve all unique product IDs in the uploaded sheet to deactivate them first
        const productIdsToDeactivate = new Set();
        for (const row of json) {
            let product_id = getRowValue(row, 'product_id');
            let product_name_val = getRowValue(row, 'product_name') || getRowValue(row, 'product');
            
            if (product_id && !isNaN(Number(product_id))) {
                productIdsToDeactivate.add(Number(product_id));
            } else if (product_name_val) {
                try {
                    const pResult = await _db3.query(`SELECT id FROM ru_loans_products WHERE product_name = ? LIMIT 1`, {
                        replacements: [String(product_name_val).trim()],
                        type: QueryTypes.SELECT
                    });
                    if (pResult && pResult.length > 0 && pResult[0].id && !isNaN(Number(pResult[0].id))) {
                        productIdsToDeactivate.add(Number(pResult[0].id));
                    }
                } catch (e) {
                    logger.error("Error resolving product_name in deactivation pre-process: ", e);
                }
            }
        }

        if (productIdsToDeactivate.size > 0) {
            const idsArray = Array.from(productIdsToDeactivate);
            const deactivateQuery = `
                UPDATE RULoans.ru_branch_sales_people 
                SET is_active = 0, updated_by = ?, updated_at = ${IST_NOW_SQL}
                WHERE product_id IN (?)
            `;
            await _db3.query(deactivateQuery, {
                replacements: [userId, idsArray],
                type: QueryTypes.UPDATE
            });
        }

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            const resultObj = { ...row, UploadStatus: "Success", ErrorMessage: "" };

            try {
                // Get values
                const city = getRowValue(row, 'city');
                const branch_name = getRowValue(row, 'branch_name');
                const sp_id = getRowValue(row, 'sp_id');
                const sp_name = getRowValue(row, 'sp_name');
                let product_id = getRowValue(row, 'product_id');
                const code = getRowValue(row, 'code');
                const pincode = getRowValue(row, 'pincode');
                const sp_email = getRowValue(row, 'sp_email');
                let sp_mobile = getRowValue(row, 'sp_mobile');
                const reference_id = getRowValue(row, 'reference_id');
                const location_tag = getRowValue(row, 'location_tag');
                const is_active = 1;
                const is_approved = 1;

                // If product_id is empty but product name is given, try finding product_id
                let product_name_val = getRowValue(row, 'product_name') || getRowValue(row, 'product');
                if (!product_id && product_name_val) {
                    const pResult = await _db3.query(`SELECT id FROM ru_loans_products WHERE product_name = ? LIMIT 1`, {
                        replacements: [String(product_name_val).trim()],
                        type: QueryTypes.SELECT
                    });
                    if (pResult && pResult.length > 0) {
                        product_id = pResult[0].id;
                    }
                }

                // Check if product is Incred
                let is_incred = false;
                if (product_id) {
                    const pResult = await _db3.query(`SELECT product_name, product_vendor FROM ru_loans_products WHERE id = ? LIMIT 1`, {
                        replacements: [product_id],
                        type: QueryTypes.SELECT
                    });
                    if (pResult && pResult.length > 0) {
                        const pName = String(pResult[0].product_name || "").toLowerCase();
                        const pVendor = String(pResult[0].product_vendor || "").toLowerCase();
                        if (pName.includes("incred") || pVendor.includes("incred")) {
                            is_incred = true;
                        }
                    }
                }

                // Conditional Validation
                const errors = [];
                if (is_incred) {
                    if (!city) errors.push("city is required");
                    if (!sp_name) errors.push("sp_name is required");
                    if (!sp_email) errors.push("email is required");
                    if (!sp_mobile) errors.push("mobile is required");
                    if (!product_id) errors.push("product_id is required");
                    if (!location_tag) errors.push("tags is required");
                }

                // Digits only; if more than 10, take last 10.
                let mobileDigits = String(sp_mobile ?? "").replace(/\D/g, "");
                if (mobileDigits.length > 10) {
                    mobileDigits = mobileDigits.slice(-10);
                }
                if (mobileDigits.length !== 10) {
                    errors.push("sp_mobile must be a 10-digit number");
                } else {
                    sp_mobile = mobileDigits;
                }

                if (errors.length > 0) {
                    throw new Error(errors.join(", "));
                }

                // Perform Upsert lookup
                let existingRecord = null;
                if (matchKeys.length > 0) {
                    let whereParts = [];
                    let replacements = [];
                    for (const key of matchKeys) {
                        const dbField = mapHeaderToField(key);
                        const val = row[key];
                        if (val !== undefined && val !== null && val !== '') {
                            whereParts.push(`${dbField} = ?`);
                            replacements.push(val);
                        }
                    }
                    if (whereParts.length > 0) {
                        const checkQuery = `SELECT id FROM RULoans.ru_branch_sales_people WHERE ${whereParts.join(' AND ')} LIMIT 1`;
                        const res = await _db3.query(checkQuery, { replacements, type: QueryTypes.SELECT });
                        if (res && res.length > 0) {
                            existingRecord = res[0];
                        }
                    }
                }

                if (existingRecord) {
                    // Update
                    const fieldsToUpdate = [];
                    const replacements = [];
                    
                    const updates = {
                        city, branch_name, sp_id, sp_name, product_id, code, pincode,
                        sp_email, sp_mobile, reference_id, tags: location_tag, is_active, is_approved
                    };

                    for (const [field, val] of Object.entries(updates)) {
                        if (val !== undefined) {
                            fieldsToUpdate.push(`${field} = ?`);
                            replacements.push(val);
                        }
                    }

                    if (fieldsToUpdate.length > 0) {
                        replacements.push(userId); // updated_by
                        replacements.push(existingRecord.id); // id
                        const updateQuery = `UPDATE RULoans.ru_branch_sales_people SET ${fieldsToUpdate.join(', ')}, updated_by = ?, updated_at = ${IST_NOW_SQL} WHERE id = ?`;
                        await _db3.query(updateQuery, { replacements, type: QueryTypes.UPDATE });
                    }
                } else {
                    // Insert
                    const fieldsToInsert = [];
                    const placeholders = [];
                    const replacements = [];

                    const inserts = {
                        city, branch_name, sp_id, sp_name, product_id, code, pincode,
                        sp_email, sp_mobile, reference_id, tags: location_tag, is_active, is_approved
                    };

                    for (const [field, val] of Object.entries(inserts)) {
                        if (val !== undefined && val !== null) {
                            fieldsToInsert.push(field);
                            placeholders.push('?');
                            replacements.push(val);
                        }
                    }

                    fieldsToInsert.push('created_by', 'updated_by', 'created_at', 'updated_at');
                    placeholders.push('?', '?', IST_NOW_SQL, IST_NOW_SQL);
                    replacements.push(userId, userId);

                    const insertQuery = `INSERT INTO RULoans.ru_branch_sales_people (${fieldsToInsert.join(', ')}) VALUES (${placeholders.join(', ')})`;
                    await _db3.query(insertQuery, { replacements, type: QueryTypes.INSERT });
                }

                successCount++;

            } catch (err) {
                resultObj.UploadStatus = "Failed";
                resultObj.ErrorMessage = err.message || "Unknown error";
                failureCount++;
            }

            errData.push(resultObj);
        }

        // Upload results to S3 and save activity log
        let s3Url = "";
        try {
            s3Url = await uploadArrayToS3(errData, "rm_users_upload");
        } catch (uploadErr) {
            console.error("Failed to upload error log to S3: ", uploadErr);
        }

        const logQuery = `
            INSERT INTO application_logs 
            (application_type, application_id, field, from_value, to_value, updated_by, createdAt, updatedAt) 
            VALUES ('rm_user_upload', ?, ?, ?, ?, uuid_to_bin(?), NOW(), NOW())
        `;
        await sequelize.query(logQuery, {
            replacements: [
                file_name,
                s3Url || "",
                String(successCount),
                String(failureCount),
                userId
            ],
            type: QueryTypes.INSERT
        });

    } catch (e) {
        console.error("Error in uploadRmUsers background job:", e);
        logger.error(e);
    }
};
