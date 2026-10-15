const { logger } = require("../../api/helpers/logger");
const { uploadArrayToS3 } = require("../../api/helpers/commonhelper");
const { sequelize, _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const { searchFreshLeadClaims, upsertTentativeMatchMeta, isBankFileMatchExcluded } = require('../../api/services/finance-services');
const { v4: uuid } = require('uuid');

// Excel Header Definitions with Validation Rules
const EXCEL_HEADERS = {
    'Sr No': { instruction: 'IGNORE', dbField: null },
    'Month': { instruction: 'MANDATORY', dbField: null },
    'Loan Ac No': { instruction: 'MANDATORY', dbField: 'loan_number' },
    'Customer ID/APAC': { instruction: 'OPTIONAL', dbField: 'cust_id' },
    'Loan/APAC/Ref/LOS No': { instruction: 'MANDATORY', dbField: 'apac_loan_number' },
    'Borrower Name': { instruction: 'MANDATORY', dbField: 'customer_name' },
    'Borrower First Name': { instruction: 'MANDATORY', dbField: 'customer_first_name' },
    'Borrower Last Name': { instruction: 'MANDATORY', dbField: 'customer_last_name' },
    'Disb. Date': { instruction: 'MANDATORY', dbField: 'disbursement_date' },
    'Disb. / Ins. Amount': { instruction: 'MANDATORY', dbField: 'disbursement_amount' },
    'Insurance Amt': { instruction: 'IGNORE', dbField: null },
    'VLI/Add Payout on': { instruction: 'IGNORE', dbField: null },
    'Bank Payout Rate': { instruction: 'OPTIONAL', dbField: 'bank_payout_rate' },
    'Dummy': { instruction: 'IGNORE', dbField: null },
    'Addi. / Subv. Amt': { instruction: 'OPTIONAL', dbField: 'subvention_percentage' },
    'City': { instruction: 'MANDATORY', dbField: 'city' },
    'State': { instruction: 'MANDATORY', dbField: 'state' },
    'Total Payout in %': { instruction: 'OPTIONAL', dbField: 'remark1' },
    'Team': { instruction: 'IGNORE', dbField: null },
    'TME': { instruction: 'IGNORE', dbField: null },
    'Bank File - Remark 1': { instruction: 'IGNORE', dbField: null },
    'Remark 2': { instruction: 'IGNORE', dbField: null },
    'GST status': { instruction: 'IGNORE', dbField: null },
    'Subsidiary Name': { instruction: 'OPTIONAL', dbField: 'subsidiary' },
    'Bank/NBFC Name': { instruction: 'IGNORE', dbField: null },
    'Sub Product': { instruction: 'IGNORE', dbField: null },
    'Bank Remark': { instruction: 'OPTIONAL', dbField: 'bank_remark' },
    'Base Payout Amount': { instruction: 'OPTIONAL', dbField: 'amount' },
    'GST': { instruction: 'OPTIONAL', dbField: 'gst' },
    'Total Payout': { instruction: 'OPTIONAL', dbField: 'total' },
    'TDS': { instruction: 'IGNORE', dbField: null },
    'Net Payment': { instruction: 'IGNORE', dbField: null },
    'Bill No': { instruction: 'IGNORE', dbField: null },
    'Bill Date': { instruction: 'IGNORE', dbField: null },
    'Entry By': { instruction: 'IGNORE', dbField: null },
    'Proper': { instruction: 'IGNORE', dbField: null },
    'Bank Bill Reff No': { instruction: 'IGNORE', dbField: null },
    'State As per Bank': { instruction: 'IGNORE', dbField: null },
    'Netsuite': { instruction: 'IGNORE', dbField: null },
    'Banker Mail ID': { instruction: 'IGNORE', dbField: null },
    'To be Upload in NS once payment received': { instruction: 'IGNORE', dbField: null },
    'Bank_Claim Month': { instruction: 'MANDATORY', dbField: 'claim_month' },
    'Bank File - Remark 2': { instruction: 'IGNORE', dbField: null },
    'Subsidiary ID': { instruction: 'IGNORE', dbField: null },
    'Bank/NBFC ID': { instruction: 'MANDATORY', dbField: 'netsuite_bank_id' },
    'Sub Product ID': { instruction: 'MANDATORY', dbField: 'netsuite_sub_product_id' },
    'Business category': { instruction: 'IGNORE', dbField: null },
    'Claim': { instruction: 'IGNORE', dbField: null },
    'Date of the month would be 1': { instruction: 'IGNORE', dbField: null }
};

/**
 * Validation Helper Functions
 */
function isEmptyValue(value) {
    return value === null || value === undefined || value === '' ||
        (typeof value === 'string' && value.trim() === '');
}

function validateMandatoryField(value, headerName) {
    if (isEmptyValue(value)) {
        return `${headerName} is mandatory`;
    }
    return null;
}

/**
 * Validate a single row against the Excel header rules
 * @param {Object} row - The data row to validate
 * @param {Number} rowIndex - The row number (1-based for user display)
 * @returns {Array} - Array of error messages for this row
 */
function validateRow(row, rowIndex) {
    const errors = [];
    const rowNumber = rowIndex + 2; // +2 because Excel starts at 1 and has header row

    // Validate each field based on EXCEL_HEADERS definition
    for (const [headerName, config] of Object.entries(EXCEL_HEADERS)) {
        const { instruction } = config;

        // Skip IGNORE fields - no validation needed
        if (instruction === 'IGNORE') {
            continue;
        }

        const value = row[headerName];

        // Validate MANDATORY fields
        if (instruction === 'MANDATORY') {
            const error = validateMandatoryField(value, headerName);
            if (error) {
                errors.push(error); // Store error without row number prefix
            }
        }

        // OPTIONAL fields don't need validation - they can be empty
    }

    // Format errors with row number prefix only once if there are errors
    if (errors.length > 0) {
        return [`${errors.join(', ')}`];
    }

    return [];
}

/**
 * Validate all rows in the dataset
 * @param {Array} data - Array of data rows
 * @returns {Object} - { isValid: boolean, errors: Array }
 */
function validateAllRows(data) {
    const allErrors = [];

    for (let i = 0; i < data.length; i++) {
        const rowErrors = validateRow(data[i], i);
        allErrors.push(...rowErrors);
    }

    return {
        isValid: allErrors.length === 0,
        errors: allErrors
    };
}

/**
 * Convert Excel date serial number to JavaScript Date
 * @param {Number|String} date - Excel date serial number or date string
 * @returns {Date|null} - JavaScript Date object or null if invalid
 */
function excelDateToJSDate(date) {
    if (!date && date !== 0) {
        return null;
    }

    // If it's already a string date format (contains / or -)
    const dateStr = String(date);
    if (dateStr.includes('/') || dateStr.includes('-')) {
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }

    // Check if it's a number (Excel serial date)
    const dateNum = Number(date);
    if (!isNaN(dateNum) && dateNum > 0) {
        // Excel date serial number conversion
        // Excel epoch is January 1, 1900 (serial number 1)
        // JavaScript epoch is January 1, 1970
        // Excel incorrectly treats 1900 as a leap year, so we use 25569 as the offset
        const jsDate = new Date(Math.round((dateNum - 25569) * 86400 * 1000));

        // Validate the converted date
        if (!isNaN(jsDate.getTime())) {
            return jsDate;
        }
    }

    // If all else fails, try parsing as-is
    const fallbackDate = new Date(date);
    return !isNaN(fallbackDate.getTime()) ? fallbackDate : null;
}

/**
 * Get the mapped database value for a header
 * @param {Object} row - The data row
 * @param {String} headerName - The Excel header name
 * @returns {String|null} - The value from the row, or null if empty
 */
function getMappedValue(row, headerName) {
    const value = row[headerName];
    if (isEmptyValue(value)) {
        return null;
    }
    return String(value);
}

/**
 * Get the mapped date value for a header (handles Excel serial dates)
 * @param {Object} row - The data row
 * @param {String} headerName - The Excel header name
 * @returns {String|null} - The formatted date string (DD/MM/YY) or null if empty
 */
function getMappedDateValue(row, headerName) {
    const value = row[headerName];
    if (isEmptyValue(value)) {
        return null;
    }

    const date = excelDateToJSDate(value);
    if (!date) {
        return null;
    }

    // Format as DD/MM/YY (e.g., "20/04/23")
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2); // Last 2 digits of year

    return `${day}/${month}/${year}`;
}

function trimObject(arr) {
    let arrTemp = [];
    for (let i = 0; i < arr.length; i++) {
        let obj = arr[i];
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        const trimmedObject = {};

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const trimmedKey = key.trim();
                const value = obj[key];
                const trimmedValue = typeof value == 'string' ? value.trim() : value;

                trimmedObject[trimmedKey] = trimmedValue;
            }
        }

        arrTemp.push(trimmedObject);
    }

    return arrTemp;
}

module.exports = async function (job) {
    try {
        let query;
        let { data, file_name, user } = job.data;

        // Check if file already exists to prevent duplicate processing
        let fileAlreadyExistsQuery = ` SELECT * FROM application_logs WHERE application_type = 'bank_file_upload' AND updated_by = uuid_to_bin(?) AND application_id = ? AND createdAt >= ? - INTERVAL 5 MINUTE ORDER BY createdAt DESC LIMIT 1; `;
        let fileAlreadyExists = await sequelize.query(fileAlreadyExistsQuery, { replacements: [user.id, file_name, new Date()], type: QueryTypes.SELECT });
        if (fileAlreadyExists[0]) return;

        // Log file upload start
        query = ` insert into application_logs (application_type, application_id, updated_by, createdAt, updatedAt) values ('bank_file_upload',?,uuid_to_bin(?),?,?) `;
        await sequelize.query(query, { replacements: [file_name, user.id, new Date(), new Date()], type: QueryTypes.INSERT });

        logger.info(`Processing bank file upload: ${file_name}`);
        let dataNew = trimObject(data);
        // bank:product -> excluded from lead matching (SBI / CAT C / CAT D); one lookup per pair per upload
        const matchExcludedCache = new Map();

        // ============================================================
        // STEP 1: VALIDATION WILL BE DONE ROW-BY-ROW DURING PROCESSING
        // Invalid rows will be skipped and added to error report
        // ============================================================
        logger.info('Proceeding with row-by-row validation and processing...');

        // ============================================================
        // STEP 1.5: COLLECT UNIQUE BANK, PRODUCT IDs, AND STATES
        // ============================================================
        const uniqueBankIds = new Set();
        const uniqueProductIds = new Set();
        const uniqueStates = new Set();

        for (let i = 0; i < dataNew.length; i++) {
            const bankId = getMappedValue(dataNew[i], 'Bank/NBFC ID');
            const productId = getMappedValue(dataNew[i], 'Sub Product ID');
            const state = getMappedValue(dataNew[i], 'State');

            if (bankId) uniqueBankIds.add(bankId);
            if (productId) uniqueProductIds.add(productId);
            if (state) uniqueStates.add(state.toUpperCase().trim());
        }

        logger.info(`Found ${uniqueBankIds.size} unique bank IDs, ${uniqueProductIds.size} unique product IDs, and ${uniqueStates.size} unique states`);

        // ============================================================
        // STEP 1.6: BATCH FETCH ALL BANKS AND PRODUCTS
        // ============================================================
        const bankMap = new Map();
        const productMap = new Map();

        // Fetch all banks in one query
        if (uniqueBankIds.size > 0) {
            const bankIdsArray = Array.from(uniqueBankIds);
            const bankPlaceholders = bankIdsArray.map(() => '?').join(',');
            const bankQuery = `SELECT id, netsuite_bank_id, bank_name, external_id, registered_on_company_name, pan, status, grade, remarks FROM ru_netsuite_banks WHERE netsuite_bank_id IN (${bankPlaceholders})`;
            const banks = await _db2.query(bankQuery, { replacements: bankIdsArray, type: QueryTypes.SELECT });

            // Create map: netsuite_bank_id -> bank object
            for (const bank of banks) {
                bankMap.set(bank.netsuite_bank_id, bank);
            }
            logger.info(`Fetched ${banks.length} banks from database`);
        }

        // Fetch all products in one query
        if (uniqueProductIds.size > 0) {
            const productIdsArray = Array.from(uniqueProductIds);
            const productPlaceholders = productIdsArray.map(() => '?').join(',');
            const productQuery = `SELECT * FROM ru_netsuite_products WHERE netsuite_product_id IN (${productPlaceholders})`;
            const products = await _db2.query(productQuery, { replacements: productIdsArray, type: QueryTypes.SELECT });

            // Create map: netsuite_product_id -> product object
            for (const product of products) {
                productMap.set(product.netsuite_product_id, product);
            }
            logger.info(`Fetched ${products.length} products from database`);
        }

        // Fetch all valid states from pincodes_list
        const validStatesSet = new Set();
        const stateQuery = `SELECT DISTINCT state FROM pincodes_list WHERE state IS NOT NULL`;
        const states = await sequelize.query(stateQuery, { type: QueryTypes.SELECT });

        // Normalize states to uppercase for comparison (handle variations like "TAMIL NADU", "TAMILNADU", "Tamil Nadu")
        for (const stateRow of states) {
            if (stateRow.state) {
                const normalizedState = stateRow.state.toUpperCase().trim();
                validStatesSet.add(normalizedState);
            }
        }
        logger.info(`Fetched ${validStatesSet.size} valid states from database`);

        let userDetailsError = [];
        let failureCount = 0;
        let successCount = 0;
        const BATCH_SIZE = 100;

        // ============================================================
        // STEP 2: PROCESS VALIDATED DATA IN BATCHES
        // ============================================================
        const processBatch = async (batchData, startIndex) => {
            try {
                let queryString = '';
                let bindParams = [];
                const validRows = [];

                // Generate file_date and file_date_iso using current date (same for all rows in batch)
                const inputDate = new Date();
                const year = inputDate.getFullYear();
                const month = (inputDate.getMonth() + 1).toString().padStart(2, '0');
                const day = inputDate.getDate().toString().padStart(2, '0');
                const file_date = inputDate;
                const file_date_iso = `${year}-${month}-${day}`;

                // Look up bank, product names, and validate state from cached maps
                for (let i = 0; i < batchData.length; i++) {
                    let row = batchData[i];

                    // Initialize match columns for all rows (will be updated if matching occurs)
                    row['Tentative Data Matched'] = 'No';
                    row['Matched Lead Form Id'] = null;

                    // Validate row - if validation fails, skip this row and continue
                    const rowErrors = validateRow(row, startIndex + i);
                    if (rowErrors.length > 0) {
                        row.error = rowErrors.join('; ');
                        userDetailsError.push(row);
                        failureCount++;
                        continue; // Skip this row and continue with next row
                    }

                    // Get Bank/NBFC ID and Sub Product ID from row
                    const bankId = getMappedValue(row, 'Bank/NBFC ID');
                    const productId = getMappedValue(row, 'Sub Product ID');
                    const state = getMappedValue(row, 'State');

                    // Look up bank name from cache
                    let bankName = null;
                    if (bankId) {
                        const bank = bankMap.get(bankId);
                        if (!bank) {
                            row.error = `Bank/NBFC not found for ID ${bankId}`;
                            userDetailsError.push(row);
                            failureCount++;
                            continue;
                        }
                        bankName = bank.bank_name;
                    }

                    // Look up product name from cache
                    let productName = null;
                    let parentProductId = null;
                    if (productId) {
                        const product = productMap.get(productId);
                        if (!product) {
                            row.error = `Sub Product not found for ID ${productId}`;
                            userDetailsError.push(row);
                            failureCount++;
                            continue;
                        }
                        productName = product.product_name;
                        parentProductId = product.parent_product_id || null;
                    }

                    // Validate state against valid states from database
                    if (state) {
                        const normalizedState = state.toUpperCase().trim();
                        if (!validStatesSet.has(normalizedState)) {
                            row.error = `Invalid state: ${state}. Please use a valid state name.`;
                            userDetailsError.push(row);
                            failureCount++;
                            continue;
                        }
                    }

                    // Determine netsuite_product_id: use parent_product_id if available, otherwise use Sub Product ID
                    const netsuiteProductId = parentProductId || productId;

                    // Search for matching fresh lead claims
                    let matchResult = { is_matched: false, fresh_lead_id: null };
                    const customerFirstName = getMappedValue(row, 'Borrower First Name');
                    const customerLastName = getMappedValue(row, 'Borrower Last Name');
                    const customerFullName = getMappedValue(row, 'Borrower Name');
                    const city = getMappedValue(row, 'City');
                    const stateValue = getMappedValue(row, 'State');
                    const loanReferenceId = getMappedValue(row, 'Loan Ac No');
                    const loanApacRefLosNumber = getMappedValue(row, 'Loan/APAC/Ref/LOS No');

                    // Prepare product IDs array (both netsuite_product_id and netsuite_sub_product_id)
                    const productIdsArray = [];
                    if (netsuiteProductId) productIdsArray.push(netsuiteProductId);
                    if (productId && productId !== netsuiteProductId) productIdsArray.push(productId);

                    // Manual-review banks (SBI) and CAT C / CAT D products are never tentative-matched; the row is still inserted unclaimed
                    const matchExcludedKey = `${bankId}:${netsuiteProductId}`;
                    if (bankId && !matchExcludedCache.has(matchExcludedKey)) {
                        matchExcludedCache.set(matchExcludedKey, await isBankFileMatchExcluded(bankId, netsuiteProductId));
                    }
                    if (customerFirstName && customerLastName && customerFullName && bankId && !matchExcludedCache.get(matchExcludedKey) && productIdsArray.length > 0 && loanReferenceId && loanApacRefLosNumber) {
                        try {
                            matchResult = await searchFreshLeadClaims(
                                customerFirstName,
                                customerLastName,
                                customerFullName,
                                bankId,
                                productIdsArray,
                                loanReferenceId,
                                loanApacRefLosNumber
                            );
                            logger.info(`Row ${startIndex + i + 1} - Fresh Lead Match Result:`, JSON.stringify(matchResult));
                        } catch (err) {
                            logger.error(`Error searching fresh lead claims for row ${startIndex + i + 1}:`, err.message);
                        }
                    }

                    // If we reach here, bank, product, and state are all valid
                    // Add match information to row for S3 log file
                    row['Tentative Data Matched'] = matchResult.is_matched ? 'Yes' : 'No';
                    row['Matched Lead Form Id'] = matchResult.is_matched ? matchResult.fresh_lead_id : null;
                    
                    validRows.push({ row, bankName, productName, bankId, productId, netsuiteProductId, matchResult });
                    row.error = '';
                    userDetailsError.push(row);
                }

                // If no valid rows, skip insert
                if (validRows.length === 0) {
                    logger.warn(`Batch at row ${startIndex}: No valid rows to insert`);
                    return;
                }

                // Build insert query for valid rows only
                for (let i = 0; i < validRows.length; i++) {
                    const { row, bankName, productName, bankId, productId, netsuiteProductId, matchResult } = validRows[i];

                    // Generate UUID for bank_file_id
                    const bankFileId = uuid();

                    // If match found, upsert the tentative match metadata
                    if (matchResult.is_matched && matchResult.fresh_lead_id) {
                        try {
                            await upsertTentativeMatchMeta(
                                matchResult.fresh_lead_id,
                                1, // is_tentative_matched = 1
                                bankFileId // tentative_bank_file_id
                            );
                            logger.info(`Row ${startIndex + i + 1} - Updated tentative match meta for fresh_lead_id: ${matchResult.fresh_lead_id}, bank_file_id: ${bankFileId}`);
                        } catch (err) {
                            logger.error(`Row ${startIndex + i + 1} - Error upserting tentative match meta:`, err.message);
                        }
                    }

                    if (i === 0) {
                        queryString = ` INSERT IGNORE INTO ru_dsa_tentative_bank_files (
                            bank_file_id, file_date, file_date_iso, claim_month, apac_loan_number,
                            loan_number,  cust_id, bank_nbfc_name, customer_name,
                            customer_first_name, customer_last_name, disbursement_date,
                            disbursement_amount, bank_payout_rate, subvention_percentage,
                            city, state, remark1, subsidiary, sub_product, bank_remark,
                            amount, gst, total, netsuite_bank_id, netsuite_sub_product_id, netsuite_product_id,
                            claimed, fresh_lead_id,
                            created_at, updated_at
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
                    } else {
                        queryString += ` , (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
                    }

                    bindParams = bindParams.concat([
                        // System fields
                        bankFileId, // bank_file_id (random UUID for each entry)
                        file_date, // file_date
                        file_date_iso, // file_date_iso

                        // MANDATORY fields from EXCEL_HEADERS
                        getMappedValue(row, 'Bank_Claim Month'), // claim_month
                        getMappedValue(row, 'Loan Ac No'), // loan_number
                        getMappedValue(row, 'Loan/APAC/Ref/LOS No'), // apac_loan_number

                        // OPTIONAL fields from EXCEL_HEADERS
                        getMappedValue(row, 'Customer ID/APAC'), // cust_id

                        // Derived from database lookup
                        bankName, // bank_nbfc_name (from ru_netsuite_banks)
                        getMappedValue(row, 'Borrower Name'), // customer_name
                        getMappedValue(row, 'Borrower First Name'), // customer_first_name
                        getMappedValue(row, 'Borrower Last Name'), // customer_last_name
                        getMappedDateValue(row, 'Disb. Date'), // disbursement_date (converts Excel serial dates)
                        getMappedValue(row, 'Disb. / Ins. Amount'), // disbursement_amount

                        // OPTIONAL fields from EXCEL_HEADERS (continued)
                        getMappedValue(row, 'Bank Payout Rate'), // bank_payout_rate
                        getMappedValue(row, 'Addi. / Subv. Amt'), // subvention_percentage

                        // MANDATORY fields from EXCEL_HEADERS (continued)
                        getMappedValue(row, 'City'), // city
                        getMappedValue(row, 'State'), // state

                        // OPTIONAL fields from EXCEL_HEADERS (continued)
                        getMappedValue(row, 'Total Payout in %'), // remark1
                        getMappedValue(row, 'Subsidiary Name'), // subsidiary (handle typo)

                        // Derived from database lookup
                        productName, // sub_product (from ru_netsuite_products)

                        // OPTIONAL fields from EXCEL_HEADERS (continued)
                        getMappedValue(row, 'Bank Remark'), // bank_remark
                        getMappedValue(row, 'Base Payout Amount'), // amount
                        getMappedValue(row, 'GST'), // gst
                        getMappedValue(row, 'Total Payout'), // total

                        // System field

                        // IDs from Excel
                        bankId, // netsuite_bank_id
                        productId, // netsuite_sub_product_id (Sub Product ID from Excel)
                        netsuiteProductId, // netsuite_product_id (parent_product_id if available, else Sub Product ID)

                        // Fresh lead match result
                        matchResult.is_matched ? 1 : 0, // claimed (1 if match found, 0 otherwise)
                        matchResult.is_matched ? matchResult.fresh_lead_id : null, // fresh_lead_id (ID if match found, null otherwise)

                        // System fields
                        new Date(), // created_at
                        new Date() // updated_at
                    ]);
                }

                // Execute batch insert with INSERT IGNORE as a safety net (duplicates already filtered)
                await _db2.query(queryString, {
                    replacements: bindParams,
                    type: QueryTypes.INSERT,
                });

                successCount += validRows.length;

            } catch (err) {
                console.log(err, "log:err");
                logger.error(`Batch insert error at row ${startIndex}: ${err.message}`);
                for (let row of batchData) {
                    console.log(err.message, "log:error");
                    if (!row.error) {
                        row.error = `Error into the data provided. Please provide all the mandatory fields and all fields in desired format`;
                    }
                }
                failureCount += batchData.length;
            }
        };

        // Process all batches in parallel using Promise.all
        const batchPromises = [];
        for (let j = 0; j < dataNew.length; j += BATCH_SIZE) {
            const batchData = dataNew.slice(j, j + BATCH_SIZE);
            batchPromises.push(processBatch(batchData, j));
        }

        // Wait for all batches to complete
        await Promise.all(batchPromises);

        // Upload error report to S3
        let file = await uploadArrayToS3(userDetailsError, "result_tentative_bank_file_upload");
        query = ` update application_logs set field = ?, from_value = ?, to_value = ?, updatedAt = ? WHERE updated_by = uuid_to_bin(?) AND application_id = ? `;

        await sequelize.query(query, {
            replacements: [file, successCount, failureCount, new Date(), user.id, file_name],
            type: QueryTypes.UPDATE
        });

        logger.info(`Bank file upload completed: ${file_name} - Success: ${successCount}, Failures: ${failureCount}`);

    } catch (e) {
        console.log(e, "log:error");
        logger.error(e);
        logger.error(e.message);
    }
};

