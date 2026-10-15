const { checkWhereInQueryString, callNsApi, CustomOperatorHandlers, CreateWhereQueryFilter, getRuloansCustomerApiFieldMapping, jsonDifferenceForNestedObjects, nextDaySkippingSunday, isBackendAccessRole, formatGetLeadFormsFilterClause } = require("../../../helpers/commonhelper");
let ApiFieldMappings = require("../../../helpers/apiFieldMappings");
let UserService = require(_pathconst.ServicesPath.UserService);
const { NSInvoiceStatusJson } = require("../../../helpers/constantdata/config");
const { logger } = require("../../../helpers/logger");
const apiLogger = require("../../../helpers/api-logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let BillsServices = require(_pathconst.ServicesPath.BillsServices);
let BillsValidationV1 = require(_pathconst.ReqModelsPath.BillsValidationV1);
const { getExpensesApiFieldMapping, SQL_INVOICE_EXPENSE_VENDOR_PAN } = require("../../../helpers/apiFieldMappings");
const KafkaServices = require(_pathconst.ServicesPath.KafkaServices);
let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);
let createBillApi = process.env.ENVIRONMENT == "prod" ? `https://7970799.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=590&deploy=1` : `https://7970799-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_rest_create_vendorbill_api&deploy=1`;
// let classApi = `https://7970799-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_ruloans_rest_send_vendor&deploy=1`;

const formattedDate = (date = new Date()) => {
    const currentDate = date;
    const day = String(currentDate.getDate()).padStart(2, '0'); // Get the day, pad with 0 if necessary
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed, so add 1
    const year = currentDate.getFullYear();

    const formattedDate = `${day}/${month}/${year}`;
    return formattedDate;
};

// Persist a stable IST wall-clock timestamp in MySQL DATETIME fields.
const getISTDateTimeString = (date = new Date()) => {
    const istOffsetMinutes = 330; // Asia/Kolkata UTC+05:30
    const istTime = new Date(date.getTime() + (istOffsetMinutes + date.getTimezoneOffset()) * 60000);
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

exports.createBills = async (req, res, next) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'createBills', {
            description: req.body?.description,
            dsa_id_vendor: req.body?.dsa_id_vendor,
            expense_id: req.body?.expense_id,
            bill_number: req.body?.bill_number
        });

        const { error } = BillsValidationV1.createBills.validate(req.body);
        if (error) {
            // Format error message to remove array index prefix (e.g., "expenses[0].attachment" -> "attachment")
            let formattedMessage = error.message;
            // Remove patterns like "expenses[0].", "expenses[1].", etc. from the beginning of field names
            formattedMessage = formattedMessage.replace(/\w+\[\d+\]\./g, '');
            formattedMessage = formattedMessage.replace(/\battachment\[\d+\]/gi, 'attachment');
            const errorResponse = ResHelper.apiResponse(res, false, formattedMessage, 400, {}, "");
            apiLogger.logAPICall(req, res, 'createBills', {}, requestId, {
                validation_error: error.message
            });
            return errorResponse;
        } else {
            let { description, dsa_id_vendor, expenses, expense_id, bill_date, bill_number, city } = req?.body;
            const isExternalRequest = Boolean(req.dsa);
            const platform = isExternalRequest ? "b2b" : "crm";
            const createdBy = isExternalRequest
                ? req.dsa?.dsa_id
                : (req.loggedInUser?.id || req.dsa?.dsa_id);
            
            // Check bill date validation for new bills only (not updates)
            if (!expense_id && bill_date) {
                const billDate = new Date(bill_date);
                const currentDate = new Date();
                
                // Set to start of day for accurate comparison
                billDate.setHours(0, 0, 0, 0);
                currentDate.setHours(0, 0, 0, 0);
                
                // Calculate date 2 months ago from current date
                const twoMonthsAgo = new Date(currentDate);
                twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
                
                // Check if bill_date is less than 2 months from current date
                if (billDate < twoMonthsAgo) {
                    const errorResponse = ResHelper.apiResponse(res, false, "Bill date cannot be less than 2 months from current date", 400, {}, "");
                  
                    return errorResponse;
                }
            }
            
            let dsa_details = await BillsServices.getDsaClassId(dsa_id_vendor);

            // Restrict specific vendor partner_code and NS hierarchy
            if (dsa_details?.partner_code === "9930570707") {
                return ResHelper.apiResponse(res, false, "Bills cannot be created for this vendor as the partner is Ruloans HO.", 400, {}, "");
            }

            if ((dsa_details?.ns_hierarchy || "").toLowerCase() === "admin") {
                return ResHelper.apiResponse(res, false, "Bills cannot be created for vendors with Admin NS hierarchy", 400, {}, "");
            }

            // Trim bill_number to prevent duplicates with trailing/leading spaces
            bill_number = bill_number ? bill_number.trim() : bill_number;

            if (!expense_id) {
                let bill_exist = await BillsServices.checkBillForCurrentMonth(bill_number, createdBy, dsa_id_vendor);
                if (bill_exist) {
                    return ResHelper.apiResponse(res, false, `Bill number already exists`, 400, {}, "")
                };
            } else {
                let bill_exist = await BillsServices.checkBillForCurrentMonth(bill_number, createdBy, dsa_id_vendor, expense_id);
                if (bill_exist) {
                    return ResHelper.apiResponse(res, false, `Bill number already exists`, 400, {}, "")
                };
            };

            // Similar-bills check for new bills: if similar exist and force_create not set, return similar list and do not create
            if (!expense_id) {
                const force_create = Boolean(req?.body?.force_create);
                const totalAmount = (expenses || []).reduce((sum, exp) => sum + (Number(exp?.amount) || 0), 0);
                const candidate = {
                    dsa_id_vendor,
                    created_by: createdBy,
                    bill_date,
                    city,
                    account: '111',
                    memo: description,
                    bill_number,
                    totalAmount
                };
                const similarBills = await BillsServices.findSimilarBills(candidate, null);
                if (similarBills.length > 0 && !force_create) {
                    const response = ResHelper.apiResponse(res, true, "Similar bills found.", 200, {
                        similar_bills_exist: true,
                        similar_bills: similarBills,
                        message: "Similar bills found. Create anyway?"
                    }, "");
                    apiLogger.logAPICall(req, res, 'createBills', {}, requestId, {
                        similar_bills_exist: true,
                        similar_bills_count: similarBills.length,
                        force_create: false
                    });
                    return response;
                }
            }

            if (!dsa_details?.netsuite_vendor_id) {
                return ResHelper.apiResponse(res, false, "Netsuite Vendor ID not found!", 400, {}, "")
            };

            // get class id start
            if (!dsa_details?.class_id) {
                const data = await callNsApi({
                    "api": "customscript_ruloans_rest_send_vendor",
                    "payload": {
                        "internalid": dsa_details?.netsuite_vendor_id,
                        "pan_number": ""
                    }
                })
                const { class_internal_id, error, code, message } = data;
                if (class_internal_id) {
                    BillsServices.updateDsaClassId({ dsa_id_vendor, class_id: class_internal_id });
                    dsa_details["class_id"] = class_internal_id;
                } else {
                    return ResHelper.apiResponse(res, false, error || message, 400, {}, "");
                }
            };
            // get class id end

            const body = {
                memo: description,
                vendor_id: dsa_details?.netsuite_vendor_id,
                transaction_date: formattedDate(),
                class_id: dsa_details?.class_id,
                approval_status: "0",
                account: "111",
                line_details: []
            };


            for (i = 0; i < expenses?.length; i++) {
                let obj = {
                    amount: expenses[i]["amount"],
                    department: "",
                    taxSectionCode: "",
                    class_id: expenses[i]["class_id"] || "",
                    dsa_id: expenses[i]["dsa_id"] || "",
                    ns_hierarchy_type: expenses[i]["debit_to_vendor"] === true ? 1 : 0

                };
                obj[expenses[i]["expense_type"]] = Number(expenses[i]["expense_type_value"]);
                body?.line_details?.push(obj);
            };

            if (expense_id) {
                const oldBill = await BillsServices.getBillForApproval("id", expense_id);
                console.log("Old Bill", oldBill);
                const logTime = getISTDateTimeString();

                await BillsServices.updateBillsInternal({
                    ...body,
                    created_by: createdBy,
                    dsa_id_vendor,
                    expenses,
                    expense_id,
                    bill_date,
                    bill_number,
                    city,
                    platform,
                });

                const newBill = await BillsServices.getBillForApproval("id", expense_id);
                console.log("New Bill", newBill);

                let diff = jsonDifferenceForNestedObjects(oldBill, newBill);
                console.log("DIFFFF", diff);

                // Format the diff for latest_log. Save readable name only for created_by when possible.
                const formattedDiff = { from: {}, to: {} };
                const excludedFields = new Set(['expenses[0].id']);
                const nameLookupFields = new Set(['created_by']);
                const hasValueChanged = (oldValue, newValue) => {
                    if (oldValue === newValue) return false;

                    if (
                        (oldValue !== null && typeof oldValue === 'object') ||
                        (newValue !== null && typeof newValue === 'object')
                    ) {
                        try {
                            return JSON.stringify(oldValue) !== JSON.stringify(newValue);
                        } catch (e) {
                            return true;
                        }
                    }

                    return true;
                };

                for (const [key, oldValue, newValue] of diff) {
                    if (excludedFields.has(key)) continue;
                    if (!hasValueChanged(oldValue, newValue)) continue;

                    if (nameLookupFields.has(key)) {
                        formattedDiff.from[key] = await BillsServices.getAuditDisplayValue(key, oldValue);
                        formattedDiff.to[key] = await BillsServices.getAuditDisplayValue(key, newValue);
                    } else {
                        formattedDiff.from[key] = oldValue;
                        formattedDiff.to[key] = newValue;
                    }
                }

                console.log("Formatted DIFF:", formattedDiff);

                const hasDiffChanges = Object.keys(formattedDiff.from).length > 0 && Object.keys(formattedDiff.to).length > 0;

                if (hasDiffChanges) {
                    // Connect to Kafka producer and send the event
                    await KafkaServices.connectKafkaProducer();

                    const dsaUpdatedDetails = new KafkaServices.EventLogger(
                        "office_expense_details",
                        formattedDiff.from,  // Send 'from' values as an object
                        formattedDiff.to,    // Send 'to' values as an object
                        JSON.stringify(expense_id),
                        createdBy,
                        new Date()
                    );

                    // Send event to Kafka
                    await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);

                    // Persist changed header/item diff metadata in ru_dsa_expenses.
                    await BillsServices.updateExpenseAuditLog(
                        expense_id,
                        JSON.stringify(formattedDiff),
                        createdBy,
                        logTime
                    );
                } else {
                    console.log(`No audit diff found for expense_id ${expense_id}. Skipping audit log update.`);
                }
            }

            else {
                await BillsServices.createBillsInternal({ ...body, created_by: createdBy, dsa_id_vendor, expenses, bill_date, bill_number, city, platform });
            };

            const response = ResHelper.apiResponse(res, true, "Success", 200, {}, "");
            apiLogger.logAPICall(req, res, 'createBills', {}, requestId, {
                description: description,
                dsa_id_vendor: dsa_id_vendor,
                expense_id: expense_id,
                bill_number: bill_number,
                city: city,
                expenses_count: expenses?.length || 0,
                is_update: !!expense_id,
                kafka_events_sent: expense_id ? 1 : 0,
                platform: platform,
                user_id: createdBy,
                source: req.dsa ? 'external_dsa' : 'internal_user'
            });
            return response;
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'createBills', {}, requestId, {
            error: e.message,
            stack: e.stack
        });
        return errorResponse;
    }
};

exports.updateBillStatus = async (req, res, next) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'updateBillStatus', {
            expense_id: req.body?.expense_id,
            status: req.body?.status,
            reason: req.body?.reason
        });

        const { error } = BillsValidationV1.updateBillStatus.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            apiLogger.logAPICall(req, res, 'updateBillStatus', {}, requestId, {
                validation_error: error.message
            });
            return errorResponse;
        } else {
            const { expense_id, enable_duplicacy, reason } = req?.body;
            let status = Number(req?.body?.status);
            const userId = req.loggedInUser?.id || req.dsa?.dsa_id;
            const logTime = getISTDateTimeString();
            let statusLog = null;
            const userRole = req?.loggedInUser?.role || req?.dsa?.role;
            const bhOnlyApprovalRoles = ["LEAD_ADMIN", "SC_SUB_BH"];
            if (status === 2 && bhOnlyApprovalRoles.includes(userRole)) {
                status = 1;
            }
            
            if ([0, 1, 3]?.includes(status)) {
                if (status == 3) {
                    const action = "REJECTED";
                    await BillsServices.expenseActivityLogs(expense_id, userId, action, reason);
                    const getBillStatus = await BillsServices.billStatus(expense_id);
                    if (getBillStatus) {
                        if (getBillStatus?.status == '1') {
                            statusLog = { from: "Approved by BH /LEAD_ADMIN /SC_SUB_BH", to: "Rejected" };

                            await KafkaServices.connectKafkaProducer();
                            const dsaUpdatedDetails = new KafkaServices.EventLogger(
                                "office_expense_status",
                                statusLog.from,
                                statusLog.to,
                                JSON.stringify(expense_id),
                                userId,
                                logTime,
                            );

                            await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);

                        } else if (getBillStatus?.status == '0') {
                            statusLog = { from: "Pending", to: "Rejected" };

                            await KafkaServices.connectKafkaProducer();
                            const dsaUpdatedDetails = new KafkaServices.EventLogger(
                                "office_expense_status",
                                statusLog.from,
                                statusLog.to,
                                JSON.stringify(expense_id),
                                userId,
                                logTime,
                            );
                            await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);
                        } else {
                            statusLog = { from: "-", to: "Rejected" };
                            await KafkaServices.connectKafkaProducer();
                            const dsaUpdatedDetails = new KafkaServices.EventLogger(
                                "office_expense_status",
                                statusLog.from,
                                statusLog.to,
                                JSON.stringify(expense_id),
                                userId,
                                logTime,
                            );
                            await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);
                        }
                    }
                } else {
                    statusLog = { from: "Pending", to: "Approved by BH /LEAD_ADMIN /SC_SUB_BH" };
                    await KafkaServices.connectKafkaProducer();
                    const dsaUpdatedDetails = new KafkaServices.EventLogger(
                        "office_expense_status",
                        statusLog.from,
                        statusLog.to,
                        JSON.stringify(expense_id),
                        userId,
                        logTime,
                    );

                    await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);
                }
                await BillsServices.updateBillStatus(
                    status,
                    expense_id,
                    reason,
                    statusLog ? JSON.stringify(statusLog) : null,
                    userId,
                    logTime
                );

                const response = ResHelper.apiResponse(res, true, "Success", 200, {}, "");
                apiLogger.logAPICall(req, res, 'updateBillStatus', {}, requestId, {
                    expense_id: expense_id,
                    status: status,
                    reason: reason,
                    user_id: userId,
                    kafka_events_sent: 1
                });
                return response;
            };
            const getBillStatus = await BillsServices.billStatus(expense_id);
            if (getBillStatus) {
                if (getBillStatus?.status == '0') {
                    statusLog = { from: "Pending", to: "Approved by CEO/CFO" };
                    await KafkaServices.connectKafkaProducer();
                    const dsaUpdatedDetails = new KafkaServices.EventLogger(
                        "office_expense_status",
                        statusLog.from,
                        statusLog.to,
                        JSON.stringify(expense_id),
                        userId,
                        logTime,
                    );

                    await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);
                } else {
                    statusLog = { from: "Approved by BH", to: "Approved by CEO/CFO" };
                    await KafkaServices.connectKafkaProducer();
                    const dsaUpdatedDetails = new KafkaServices.EventLogger(
                        "office_expense_status",
                        statusLog.from,
                        statusLog.to,
                        JSON.stringify(expense_id),
                        userId,
                        logTime,
                    );

                    await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);
                }
            }

            if (process.env.ENVIRONMENT === "dev" && (status === 2 || status === "2")) {
                await BillsServices.updateBillStatus(
                    status,
                    expense_id,
                    reason,
                    statusLog ? JSON.stringify(statusLog) : null,
                    userId,
                    logTime
                );
                const response = ResHelper.apiResponse(res, true, "Success", 200, {}, "");
                apiLogger.logAPICall(req, res, 'updateBillStatus', {}, requestId, {
                    expense_id: expense_id,
                    status: status,
                    reason: reason,
                    user_id: userId,
                    dev_skip_ns: true
                });
                return response;
            }

            let expense = await BillsServices.getBillForApproval("id", expense_id);
            const billId = await BillsServices.getBillId(expense_id);
            let dsa_details = await BillsServices.getDsaClassId(expense?.dsa_id);
            let { expenses, memo, created_at, bill_date, bill_number, city } = expense;
            const nextDate = nextDaySkippingSunday(new Date());
            memo = memo + ` City ${city} - Bill No ${bill_number} - Date ${formattedDate(nextDate)} `;
            const body = {
                bill_id: billId?.expense_id || "",
                memo,
                vendor_id: dsa_details?.netsuite_vendor_id,
                transaction_date: formattedDate(nextDate),
                class_id: dsa_details?.class_id,
                approval_status: "1",
                account: "111",
                memo_hyperlink: expenses
                    ?.flatMap(exp => [exp?.attachment, exp?.attachment_2].filter(Boolean))
                    .join(",") || "",
                line_details: []
            };

            for (i = 0; i < expenses?.length; i++) {
                let obj = {
                    amount: expenses[i]["amount"],
                    department: "",
                    taxSectionCode: "",
                    class_id: expenses[i]["class_id"] || "",
                    expense_class: expenses[i]["ns_hierarchy_type"] === 1 ? "112" : "",
                };
                obj["vendor_expense_account"] = Number(expenses[i]["expense_type_value"]);
                body?.line_details?.push(obj);
            };

            // create bill external api start
            console.log("Creating bill in netsuite", body);
            const data = await callNsApi({
                "api": "customscript_rest_create_vendorbill_api",
                "payload": { "Vendor_Bill_details": [body] }
            });

            console.log(body);

            const { Code } = data;

            if (Array.isArray(data) && data.length) {
                await BillsServices.updateBillStatus(
                    status,
                    expense_id,
                    reason,
                    statusLog ? JSON.stringify(statusLog) : null,
                    userId,
                    logTime
                );

                const NsbillId = data[0]?.NetSuite_Vendor_Bill_ID;
                if (NsbillId) {
                    await BillsServices.updateNSInternalId(NsbillId, expense_id);
                }
                
                const response = ResHelper.apiResponse(res, true, "Success", 200, {}, "");
                apiLogger.logAPICall(req, res, 'updateBillStatus', {}, requestId, {
                    expense_id: expense_id,
                    status: status,
                    reason: reason,
                    user_id: userId,
                    ns_bill_id: NsbillId,
                    kafka_events_sent: 1,
                    ns_webhook_success: true
                });
                return response;
            } else {
                const errorResponse = ResHelper.apiResponse(res, false, data?.error, Code, {}, "");
                apiLogger.logAPICall(req, res, 'updateBillStatus', {}, requestId, {
                    expense_id: expense_id,
                    status: status,
                    ns_error: data?.error,
                    ns_code: Code,
                    ns_webhook_success: false
                });
                return errorResponse;
            };
        };
    }
    catch (e) {
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'updateBillStatus', {}, requestId, {
            error: e.message,
            stack: e.stack,
            expense_id: req.body?.expense_id,
            status: req.body?.status
        });
        return errorResponse;
    }
};

// DSA-portal endpoint: unsigned invoices belonging only to the logged-in DSA (req.dsa.dsa_id),
// no hierarchy/subtree. Standalone — does not go through getExpenses.
exports.getInvoices = async (req, res, next) => {
    try {
        const { error } = BillsValidationV1.getInvoices.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        const dsaId = req?.dsa?.dsa_id;
        if (!dsaId) {
            return ResHelper.apiResponse(res, false, "DSA id not found for logged in user", 400, {}, "");
        }

        const { pageNumber, pageSize, sortDirection, sortBy, status, bill_number, pan } = req?.body;
        const limit = pageSize || 20;
        const offset = (pageNumber || 0) * limit;

        const sanitizedDsaId = dsaId.replace(/'/g, "\\'");
        let where = "";
        where = checkWhereInQueryString(where);
        // Company bills store the company_id (not the registrant's own dsa_id)
        // in e.dsa_id, so `d.dsa_id = self` alone misses invoices filed under
        // a company the logged-in vendor registered themselves.
        where += ` (
            d.dsa_id = '${sanitizedDsaId}'
            OR EXISTS (
                SELECT 1 FROM ru_companies rc
                WHERE rc.company_id = e.dsa_id AND rc.registered_by = '${sanitizedDsaId}'
            )
        ) `;
        where = checkWhereInQueryString(where);
        where += ` e.category = 'invoices' `;
        where = checkWhereInQueryString(where);

        if (status === 'Approved') {
            where += ` e.status = 'Approved' `;
        } else {
            // Default: Unsigned
            where += ` e.status = 'Pending Approval' AND e.status_alias IN ('e_sign_created', 'e_sign_viewed') `;
        }

        if (bill_number) {
            where = checkWhereInQueryString(where);
            where += ` e.bill_number like '%${bill_number.replace(/'/g, "\\'")}%' `;
        }

        if (pan) {
            where = checkWhereInQueryString(where);
            where += ` ${SQL_INVOICE_EXPENSE_VENDOR_PAN} like '%${pan.replace(/'/g, "\\'")}%' `;
        }

        let orderBy = '';
        if (sortBy) {
            orderBy = `${sortBy} ${sortDirection || 'asc'}`;
        }

        let data = await BillsServices.getExpensesNew(offset, limit, where, "", "", orderBy, null, false);

        return ResHelper.apiResponse(res, true, "Success", 200, data, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getExpenses = async (req, res, next) => {
    let requestId = null;
    let cteRootPhone = null;
    let hierarchyType = 'creator';
    try {
      requestId = apiLogger.logRequest(req, 'getExpenses', {
        filters: {
          category: req.body?.category,
          type: req.body?.type,
          is_export: req.body?.is_export,
          pageNumber: req.body?.pageNumber,
          pageSize: req.body?.pageSize
        }
      });
  
      const { error } = BillsValidationV1.getExpenses.validate(req.body);
      if (error) {
        const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        apiLogger.logAPICall(req, res, 'getExpenses', {}, requestId, {
          validation_error: error.message,
          validation_details: error.details
        });
        return errorResponse;
      }
  
          let {
              sortDirection, sortBy, filterModel, type, pageNumber, pageSize,
              dsa_mobile_number_filter, dsa_filter, memo_filter, status_filter, account_filter,
              created_by_filter, startDateFilter, endDateFilter, created_by_id, status,
              billStartDateFilter, billEndDateFilter, category, is_export, remarks,
              bill_number_filter, gstin_filter, dsa_pan_filter, dsa_class_filter,
              cgst_filter, sgst_filter, igst_filter, tax_amount_filter, amount_filter,
              status_alias_filter, class_id_filter, base_amount_filter, dsa_email_address_filter,
              expense_type_filter
          } = req?.body;
  
      // Export gating now lives solely in authorizeGetExpensesExport (route-level,
      // ExportMiddleware.authorizeExport against the per-user export_permissions table).
      // This used to also require the requester's phone be on the legacy
      // finance_root_privileges allowlist -- a leftover from before that system existed --
      // which meant a real, CEO-granted export permission was still silently blocked here
      // unless the user's phone also happened to be on that old list.

          category = category || "bills";
  
          let where = "";
          let having = "";
  
          const masterRoles = ["CEO", "CFO","CTO"];
          const isMasterRole = masterRoles.includes(req?.loggedInUser?.role);
          cteRootPhone = null;
          hierarchyType = 'creator';
      
      if (category && category.toLowerCase() === "bills") {
        if (req?.dsa?.dsa_mobile_number) {
          hierarchyType = 'external_b2b';
          where = checkWhereInQueryString(where);
          const dsaId = req.dsa?.dsa_id;
          
          if (dsaId) {
            where += ` (
              e.created_by = '${dsaId}' 
              OR u.dsa_id = '${dsaId}' 
              OR du2.dsa_id = '${dsaId}'
              OR EXISTS (
                SELECT 1 FROM CRMTest.users u2 
                WHERE bin_to_uuid(u2.id) = e.created_by 
                AND u2.dsa_id = '${dsaId}'
              )
            ) `;
          }
        }
        else if (req?.loggedInUser && !isMasterRole) {
          hierarchyType = 'creator';
          where = checkWhereInQueryString(where);
          const loggedInUserId = req.loggedInUser?.id;
          const loggedInUserDsaId = req.loggedInUser?.dsa_id;
          const materializedPath = req.loggedInUser?.materialized_path;
          
          const hierarchyConditions = [];
          
          if (loggedInUserId) {
            const sanitizedUserId = loggedInUserId.replace(/'/g, "\\'");
            hierarchyConditions.push(`e.created_by = '${sanitizedUserId}'`);
            hierarchyConditions.push(`bin_to_uuid(u.id) = '${sanitizedUserId}'`);
          }
          
          if (loggedInUserDsaId) {
            const sanitizedDsaId = loggedInUserDsaId.replace(/'/g, "\\'");
            hierarchyConditions.push(`(e.platform = 'b2b' AND e.created_by = '${sanitizedDsaId}')`);
            hierarchyConditions.push(`(e.platform = 'b2b' AND du2.dsa_id = '${sanitizedDsaId}')`);
          }
          
          // Backend Access Role Logic - Include parent's data
          if (isBackendAccessRole(req.loggedInUser.role)) {
            const parent = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail);
            if (parent) {
              // Add parent's created_by conditions
              if (parent.id) {
                const sanitizedParentId = parent.id.replace(/'/g, "\\'");
                hierarchyConditions.push(`e.created_by = '${sanitizedParentId}'`);
                hierarchyConditions.push(`bin_to_uuid(u.id) = '${sanitizedParentId}'`);
              }
              // Add parent's dsa_id conditions for B2B
              if (parent.dsa_id) {
                const sanitizedParentDsaId = parent.dsa_id.replace(/'/g, "\\'");
                hierarchyConditions.push(`(e.platform = 'b2b' AND e.created_by = '${sanitizedParentDsaId}')`);
                hierarchyConditions.push(`(e.platform = 'b2b' AND du2.dsa_id = '${sanitizedParentDsaId}')`);
                // Add parent's hierarchy
                hierarchyConditions.push(`(e.platform = 'b2b' AND du2.materialized_path LIKE '%${sanitizedParentDsaId}%')`);
                hierarchyConditions.push(`((e.platform IS NULL OR e.platform != 'b2b') AND du.materialized_path LIKE '%${sanitizedParentDsaId}%')`);
                hierarchyConditions.push(`(d.materialized_path LIKE '%${sanitizedParentDsaId}%')`);
              }
            }
          }
          
          if (materializedPath) {
            const sanitizedPath = materializedPath.replace(/'/g, "\\'");
            
            const idsForPathMatch = [
              loggedInUserDsaId,
              req?.loggedInUser?.parent_dsa_id
            ].filter(Boolean);
            
            const containsConditions = idsForPathMatch.map(id => {
              const sanitizedId = id.replace(/'/g, "\\'");
              return `'%${sanitizedId}%'`;
            });
            
            const buildHierarchyCondition = (alias) => {
              const prefixCondition = `${alias}.materialized_path LIKE '${sanitizedPath}%'`;
              const containsCondition = containsConditions.length > 0 
                ? containsConditions.map(cond => `${alias}.materialized_path LIKE ${cond}`).join(' OR ')
                : '';
              return containsCondition 
                ? `(${prefixCondition} OR ${containsCondition})`
                : prefixCondition;
            };
            
            hierarchyConditions.push(`(e.platform = 'b2b' AND du2.materialized_path IS NOT NULL AND ${buildHierarchyCondition('du2')})`);
            
            hierarchyConditions.push(`((e.platform IS NULL OR e.platform != 'b2b') AND du.materialized_path IS NOT NULL AND ${buildHierarchyCondition('du')})`);
            
            hierarchyConditions.push(`(d.materialized_path IS NOT NULL AND ${buildHierarchyCondition('d')})`);
          } else if (loggedInUserDsaId) {
            const sanitizedDsaId = loggedInUserDsaId.replace(/'/g, "\\'");
            hierarchyConditions.push(`(e.platform = 'b2b' AND du2.dsa_id IS NOT NULL AND du2.dsa_id = '${sanitizedDsaId}')`);
            hierarchyConditions.push(`((e.platform IS NULL OR e.platform != 'b2b') AND du.dsa_id IS NOT NULL AND du.dsa_id = '${sanitizedDsaId}')`);
            hierarchyConditions.push(`(d.dsa_id IS NOT NULL AND d.dsa_id = '${sanitizedDsaId}')`);
          }
          
          if (hierarchyConditions.length > 0) {
            where += ` (${hierarchyConditions.join(' OR ')}) `;
          }
        }
      } else {
        where = checkWhereInQueryString(where);
        const isInvoiceHierarchyCategory = category && category.toLowerCase() === "invoices";
        
        let dsaId = null;
        let materializedPath = null;
        
        if (req?.dsa?.dsa_mobile_number) {
          dsaId = req.dsa?.dsa_id;
          materializedPath = req.dsa?.materialized_path;
        } else if (req?.loggedInUser && !isMasterRole) {
          dsaId = req.loggedInUser?.dsa_id;
          materializedPath = req.loggedInUser?.materialized_path;
          if ((!dsaId || !materializedPath) && req.loggedInUser?.userPhone) {
            const dsaFromPhone = await BillsServices.getDsaByMobileNumber(req.loggedInUser.userPhone);
            if (dsaFromPhone?.dsa_id) dsaId = dsaFromPhone.dsa_id;
            if (dsaFromPhone?.materialized_path) materializedPath = dsaFromPhone.materialized_path;
          }
        }

        if (isInvoiceHierarchyCategory) {
          const invoiceHierarchyConditions = [];

          // Company bills/invoices store the company_id (not the registrant's
          // own dsa_id) in e.dsa_id. `d` is joined on d.dsa_id = e.dsa_id, so
          // for these rows `d` never matches any dsa_id/materialized_path
          // condition below no matter how correctly the hierarchy is walked.
          // vendorHierarchyMatch(alias) builds the same self+subtree match
          // against a given DSA-row alias, so it can be reused both directly
          // against `d` and against the company's registrant via EXISTS.
          const vendorHierarchyMatch = (alias, id, path) => {
            const conds = [];
            if (id) {
              const sanitizedId = id.replace(/'/g, "\\'");
              conds.push(`${alias}.dsa_id = '${sanitizedId}'`);
              conds.push(`${alias}.materialized_path LIKE '%/${sanitizedId}/%'`);
              conds.push(`${alias}.materialized_path LIKE '%${sanitizedId}%'`);
            } else if (path) {
              const sanitizedPath = path.replace(/'/g, "\\'");
              conds.push(`${alias}.materialized_path LIKE '${sanitizedPath}%'`);
            }
            return conds.length ? conds.join(" OR ") : null;
          };
          const companyRegistrantMatch = (id, path) => {
            const match = vendorHierarchyMatch("reg", id, path);
            return match
              ? `EXISTS (
                  SELECT 1 FROM ru_companies rc
                  JOIN ru_direct_selling_agents reg ON reg.dsa_id = rc.registered_by
                  WHERE rc.company_id = e.dsa_id AND (${match})
                )`
              : null;
          };

          const selfMatch = vendorHierarchyMatch("d", dsaId, materializedPath);
          if (selfMatch) invoiceHierarchyConditions.push(`(${selfMatch})`);
          const selfCompanyMatch = companyRegistrantMatch(dsaId, materializedPath);
          if (selfCompanyMatch) invoiceHierarchyConditions.push(selfCompanyMatch);

          // Backend access roles can view parent hierarchy as well.
          if (req?.loggedInUser && !isMasterRole && isBackendAccessRole(req.loggedInUser.role) && req.loggedInUser.parentEmail) {
            const parent = await UserService.findUserByPhoneOrEmail(req.loggedInUser.parentEmail, req.loggedInUser.parentEmail);
            const parentMatch = vendorHierarchyMatch("d", parent?.dsa_id, parent?.materialized_path);
            if (parentMatch) invoiceHierarchyConditions.push(`(${parentMatch})`);
            const parentCompanyMatch = companyRegistrantMatch(parent?.dsa_id, parent?.materialized_path);
            if (parentCompanyMatch) invoiceHierarchyConditions.push(parentCompanyMatch);
          }

          if (invoiceHierarchyConditions.length > 0) {
            where += ` (${invoiceHierarchyConditions.join(" OR ")}) `;
          }
        } else if (dsaId) {
          const sanitizedDsaId = dsaId.replace(/'/g, "\\'");
          const dsaMobileNumber = req?.dsa?.dsa_mobile_number || req?.loggedInUser?.userPhone;
          
          if (dsaMobileNumber) {
            const sanitizedDsaMobile = dsaMobileNumber.replace(/'/g, "\\'");
            // Include company_ids registered by any DSA in the downline too —
            // company bills store the company_id (not the registrant's own
            // dsa_id) in e.dsa_id, so without this a vendor's company invoice
            // is invisible to everyone above them in the hierarchy.
            where += ` e.dsa_id IN (
              WITH RECURSIVE DSAHierarchy AS (
                SELECT dsa_id, dsa_mobile_number, partner_code
                FROM ru_direct_selling_agents
                WHERE dsa_id = '${sanitizedDsaId}' OR dsa_mobile_number = '${sanitizedDsaMobile}'
                UNION ALL
                SELECT t.dsa_id, t.dsa_mobile_number, t.partner_code
                FROM ru_direct_selling_agents t
                INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
              )
              SELECT dsa_id FROM DSAHierarchy
              UNION
              SELECT rc.company_id FROM ru_companies rc
              WHERE rc.registered_by IN (SELECT dsa_id FROM DSAHierarchy)
            ) `;
          } else {
            where += ` (
              e.dsa_id = '${sanitizedDsaId}'
              OR EXISTS (
                SELECT 1 FROM ru_companies rc
                WHERE rc.company_id = e.dsa_id AND rc.registered_by = '${sanitizedDsaId}'
              )
            ) `;
          }
        } else if (materializedPath) {
          const sanitizedPath = materializedPath.replace(/'/g, "\\'");
          where += ` d.materialized_path LIKE '${sanitizedPath}%' `;
        }
      }
  
          const dsaAlias = "d";
          
          if (memo_filter) {
              where = checkWhereInQueryString(where);
              where += ` e.memo like '%${memo_filter}%' `;
          };
          if (class_id_filter) {
              where = checkWhereInQueryString(where);
              where += ` e.class_id like '%${class_id_filter}%' `;
          }
          if (base_amount_filter) {
              where = checkWhereInQueryString(where);
              where += ` ei.base_amount like '%${base_amount_filter}%' `;
          }
          if (dsa_filter) {
              where = checkWhereInQueryString(where);
              where += ` ${dsaAlias}.full_name like '%${dsa_filter}%' `;
          };
          if (expense_type_filter) {
              where = checkWhereInQueryString(where);
              where += ` ${BillsServices.BILLS_EXPENSE_TYPE_EXPR} LIKE CONVERT('%${expense_type_filter}%' USING utf8mb4) COLLATE utf8mb4_unicode_ci `;
          };
          if (dsa_mobile_number_filter) {
              where = checkWhereInQueryString(where);
              where += ` ${dsaAlias}.dsa_mobile_number like '%${dsa_mobile_number_filter}%' `;
          };
          if (created_by_filter) {
              where = checkWhereInQueryString(where);
              const createdByExpr = `
                  CASE 
                      WHEN e.platform = 'b2b' THEN CONVERT(COALESCE(du2.full_name, d.full_name) USING utf8mb4) 
                      ELSE CONVERT(u.name USING utf8mb4) 
                  END
              `;
              where += ` (${createdByExpr} COLLATE utf8mb4_unicode_ci) like '%${created_by_filter}%' COLLATE utf8mb4_unicode_ci `;
          };
          if (status_filter) {
              where = checkWhereInQueryString(where);
              where += ` case when e.status = 0 then "Approval Pending" when e.status = 1 then "Approved By BH" when e.status = 2 then "Approved By CFO" else "Rejected" end like '%${status_filter}%' `;
          };
          if (dsa_email_address_filter) {
              where = checkWhereInQueryString(where);
              where += ` ${dsaAlias}.email_address like '%${dsa_email_address_filter}%' `;
          }
          if (account_filter) {
              where = checkWhereInQueryString(where);
              where += ` e.account like '%${account_filter}%' `;
          };
          if (status_filter) {
              where = checkWhereInQueryString(where);
              where += ` case when e.status = 0 then "Approval Pending" when e.status = 1 then "Approved By BH" when e.status = 2 then "Approved By CFO" else "Rejected" end like '%${status_filter}%' `;
          };
          if (status == "pending") {
              where = checkWhereInQueryString(where);
              where += ` e.status = "0" `;
          };
          // Invoice Status Conditions - status and status_alias combinations
          if (status == "Pending_Invoices" || status == "Pending") {
              where = checkWhereInQueryString(where);
              where += ` (e.status = 'Pending Approval' AND e.status_alias IS NULL) 
          AND ${dsaAlias}.email_address REGEXP '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        `;
          }
          if (status === "Unsigned") {
              where = checkWhereInQueryString(where);
              where += ` e.status = 'Pending Approval' AND e.status_alias IN ('e_sign_created', 'e_sign_viewed') `;
          }
          let latestInvalidPerDsa = false;
          if (status === "Invalid_Data") {
              latestInvalidPerDsa = true;
          }
          if (status === "Pending_Approval") {
              where = checkWhereInQueryString(where);
              where += ` e.status = 'Pending Approval' `;
          }
          if (status === "Approved") {
              where = checkWhereInQueryString(where);
              where += ` e.status = 'Approved' `;
          }
          if (status === "Rejected") {
              where = checkWhereInQueryString(where);
              where += ` e.status = 'Rejected' `;
          }
          if (status === "Rejected_NS") {
              where = checkWhereInQueryString(where);
              where += ` e.status = 'Rejected' `;
          }
          if (status === "Rejected_CRM") {
              where = checkWhereInQueryString(where);
              where += ` e.status = 'Rejected' `;
          }
          if(status === "Rejected_Vendor"){
              where = checkWhereInQueryString(where);
              where += ` e.status = 'Rejected' `;
          }

          // Explicit All bucket: no status-based filtering.
          if (status === "All") {
              // Intentionally no-op
          }
  
  
          if (status == "approved_by_bh") {
              where = checkWhereInQueryString(where);
              where += ` e.status = "1" `;
          };
          if (status == "approved_by_cfo") {
              where = checkWhereInQueryString(where);
              where += ` e.status = "2" `;
          };
          if (status === "rejected") {
              where = checkWhereInQueryString(where);
              where += ` e.status = "3" `;
          };
          if (category) {
              where = checkWhereInQueryString(where);
              where += ` e.category = "${category}" `;
          };
          if (remarks) {
              where = checkWhereInQueryString(where);
              where += ` e.memo is not null `;
          };
          if (bill_number_filter) {
              where = checkWhereInQueryString(where);
              where += ` e.bill_number like '%${bill_number_filter}%' `;
          };
          if (gstin_filter) {
              where = checkWhereInQueryString(where);
              where += ` ${dsaAlias}.gstin like '%${gstin_filter}%' `;
          };
          if (dsa_pan_filter) {
              where = checkWhereInQueryString(where);
              const panFilterField = category && category.toLowerCase() === 'invoices'
                  ? SQL_INVOICE_EXPENSE_VENDOR_PAN
                  : 'kyc_exp.permanent_account_number';
              where += ` ${panFilterField} like '%${dsa_pan_filter}%' `;
          };
          if (dsa_class_filter) {
              where = checkWhereInQueryString(where);
              where += ` kyc_exp.class_id like '%${dsa_class_filter}%' `;
          };
          if (cgst_filter) {
              where = checkWhereInQueryString(where);
              where += ` e.cgst like '%${cgst_filter}%' `;
          };
          if (sgst_filter) {
              where = checkWhereInQueryString(where);
              where += ` e.sgst like '%${sgst_filter}%' `;
          };
          if (igst_filter) {
              where = checkWhereInQueryString(where);
              where += ` e.igst like '%${igst_filter}%' `;
          };
          if (tax_amount_filter) {
              having = checkWhereInQueryString(having, "having");
              having += ` SUM(ei.tax_amount) like '%${tax_amount_filter}%' `;
          };
          if (amount_filter) {
              having = checkWhereInQueryString(having, "having");
              having += ` SUM(ei.amount) like '%${amount_filter}%' `;
          };
          if (status_alias_filter) {
              where = checkWhereInQueryString(where);
              where += ` e.status_alias like '%${status_alias_filter}%' `;
          };
          if (startDateFilter) {
              where = checkWhereInQueryString(where);
              where += ` DATE(e.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
          };
          if (billStartDateFilter) {
              where = checkWhereInQueryString(where);
              where += ` DATE(e.bill_date) between DATE("${billStartDateFilter}") and DATE("${billEndDateFilter}") `;
          };
          if (created_by_id) {
              where = checkWhereInQueryString(where);
              where += ` e.created_by = "${req?.loggedInUser?.id}" `;
          };
  
          if (is_export) {
              await ApplicationLogServices?.createExportLog(req, "post_export", null, null);
          };
  
          let whereFilterQuery = [];
          const operatorHandlers = CustomOperatorHandlers();
          const isInvoiceCategory = category && category.toLowerCase() == "invoices";
          const billsFilterFieldMapping = (field) => {
              const billsFieldMap = {
                  vendor: `d.full_name`,
                  dsa_name: `d.full_name`,
                  expense_type: BillsServices.BILLS_EXPENSE_TYPE_EXPR,
                  dsa_pan: `kyc_exp.permanent_account_number`,
                  dsa_class: `kyc_exp.class_id`,
                  gstin: `CASE WHEN e.platform = 'b2b' THEN d.gstin ELSE du.gstin END`,
                  created_by: `CASE WHEN e.platform = 'b2b' THEN CAST(du2.full_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci ELSE CAST(u.name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci END`,
                  created_by_name: `CASE WHEN e.platform = 'b2b' THEN CAST(du2.full_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci ELSE CAST(u.name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci END`,
                  status: `CASE WHEN e.status = 0 THEN "Approval Pending" WHEN e.status = 1 THEN "Approved By BH" WHEN e.status = 2 THEN "Approved By CEO/CFO" ELSE "Rejected" END`,
                  status_filter: `CASE WHEN e.status = 0 THEN "Approval Pending" WHEN e.status = 1 THEN "Approved By BH" WHEN e.status = 2 THEN "Approved By CEO/CFO" ELSE "Rejected" END`,
                  approved_at: `DATE(e.approved_at)`,
                  viewed_at: `DATE(e.viewed_at)`,
                  latest_log: `e.latest_log`,
                  log_updated_by: `e.log_updated_by`,
                  last_updated_log: `e.last_updated_log`
              };
              return billsFieldMap[field] || getExpensesApiFieldMapping(field);
          };
          const fieldMapper = isInvoiceCategory ? getExpensesApiFieldMapping : billsFilterFieldMapping;
          if (filterModel) {
              whereFilterQuery = CreateWhereQueryFilter(
                  filterModel,
                  fieldMapper,
                  operatorHandlers,
                  "invoices"
              );
          }
  
          let orderBy = '';
          if (sortBy) {
              const sortField = fieldMapper(sortBy);
              orderBy = `${sortField} ${sortDirection || 'asc'}`;
          }
  
          const favouriteUserId = req?.loggedInUser?.id || null;

          if (isInvoiceCategory) {
              // Favourite flag is not used in invoice listing and adds query overhead.
              let data = await BillsServices.getExpensesNew(
                  pageNumber * pageSize, pageSize, where, having, whereFilterQuery, orderBy, null, latestInvalidPerDsa
              );
              data.records = Array.isArray(data?.records)
                  ? data.records.map((row) => ({ ...row, viewed_at: row?.viewed_at || null }))
                  : data?.records;
              return ResHelper.apiResponse(res, true, "Success", 200, data, "");
          }
  
          // Bills path: pass cteRootPhone (null for CEO/CFO -> no hierarchy) and hierarchyType
          let data = await BillsServices.getBillsNew(
              pageNumber * pageSize,
              pageSize,
              where,
              having,
              whereFilterQuery,
              orderBy,
              cteRootPhone,
              hierarchyType,
              favouriteUserId
          );
          data.records = Array.isArray(data?.records)
              ? data.records.map((row) => ({ ...row, viewed_at: row?.viewed_at || null }))
              : data?.records;
          
          const response = ResHelper.apiResponse(res, true, "Success", 200, data, "");
          apiLogger.logAPICall(req, res, 'getExpenses', data, requestId, {
            record_count: data?.records?.length || 0,
            total_records: data?.totalRecords || 0,
            category: category,
            hierarchy_applied: !!cteRootPhone,
            hierarchy_type: hierarchyType,
            cte_root_phone: cteRootPhone,
            source: req.dsa ? 'external_dsa' : 'internal_user'
          });
          return response;
  
      } catch (e) {
          console.log(e);
          logger.error(e);
          const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
          apiLogger.logAPICall(req, res, 'getExpenses', {}, requestId, {
            error: e.message,
            stack: e.stack,
            hierarchy_type: hierarchyType,
            cte_root_phone: cteRootPhone,
            source: req.dsa ? 'external_dsa' : 'internal_user'
          });
          return errorResponse;
      }
};


exports.getExpenseItems = async (req, res, next) => {
    let requestId = null;
    try {
        // Log API request
        requestId = apiLogger.logRequest(req, 'getExpenseItems', {
            filters: {
                expense_id: req.body?.expense_id,
                department_filter: req.body?.department_filter,
                expense_type_filter: req.body?.expense_type_filter,
                pageNumber: req.body?.pageNumber,
                pageSize: req.body?.pageSize
            }
        });

        const { error } = BillsValidationV1.getExpenseItems.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            apiLogger.logAPICall(req, res, 'getExpenseItems', {}, requestId, {
                validation_error: error.message,
                validation_details: error.details
            });
            return errorResponse;
        } else {
            let { pageNumber, pageSize, expense_id, department_filter, expense_type_filter, amount_filter, tax_section_code_filter, startDateFilter, endDateFilter, base_amount_filter, tax_amount_filter, tax_rate_filter, cgst_filter, sgst_filter, igst_filter, memo_filter } = req?.body;

            let where = "";
            if (expense_id) {
                where = checkWhereInQueryString(where);
                where += ` ei.expense_id = '${expense_id}' `;
            };
            if (department_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.department like '%${department_filter}%' `;
            };
            if (expense_type_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.expense_type like '%${expense_type_filter}%' `;
            };
            if (amount_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.amount like '%${amount_filter}%' `;
            };
            if (base_amount_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.base_amount like '%${base_amount_filter}%' `;
            };
            if (tax_amount_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.tax_amount like '%${tax_amount_filter}%' `;
            };
            if (tax_rate_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.tax_rate like '%${tax_rate_filter}%' `;
            };
            if (cgst_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.cgst like '%${cgst_filter}%' `;
            };
            if (sgst_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.sgst like '%${sgst_filter}%' `;
            };
            if (igst_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.igst like '%${igst_filter}%' `;
            };
            if (memo_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.memo like '%${memo_filter}%' `;
            };
            if (tax_section_code_filter) {
                where = checkWhereInQueryString(where);
                where += ` ei.tax_section_code like '%${tax_section_code_filter}%' `;
            };
            if (startDateFilter) {
                where = checkWhereInQueryString(where);
                where += ` DATE(ei.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            };

            const dbStartTime = Date.now();
            let data = await BillsServices.getExpenseItems(pageNumber * pageSize, pageSize, where);
            const dbDuration = Date.now() - dbStartTime;
            
            const response = ResHelper.apiResponse(res, true, "Success", 200, data, "");
            apiLogger.logAPICall(req, res, 'getExpenseItems', data, requestId, {
                record_count: data?.records?.length || 0,
                total_records: data?.totalRecords || 0,
                query_duration_ms: dbDuration,
                where_clause: where
            });
            return response;
        }
    }
    catch (e) {
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'getExpenseItems', {}, requestId, {
            error: e.message,
            stack: e.stack,
            expense_id: req.body?.expense_id,
            department_filter: req.body?.department_filter,
            expense_type_filter: req.body?.expense_type_filter
        });
        return errorResponse;
    }
};

exports.deleteExpense = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.getB2cUserQueries.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { expense_id } = req?.body;
            await BillsServices.deleteExpense(expense_id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.deleteExpenseItems = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.getB2cUserQueries.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { item_id } = req?.body;
            await BillsServices.deleteExpenseItems(item_id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getBbpsPayments = async (req, res, next) => {
    try {
        const { error } = BillsValidationV1.getBbpsPayments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { customer_id, pageNumber, pageSize, customer_full_name_filter, customer_mobile_number_filter, dsa_full_name_filter, dsa_mobile_number_filter, biller_name_filter, biller_category_filter, amount_paid_filter, startDateFilter, endDateFilter, txn_id_filter, txn_url_filter, status_filter, biller_id_filter, session_id_filter, reference_id_filter, bill_number_filter, bill_amount_filter, dueDateFilter, filterModel, logicOperator } = req?.body;
            let masterRoles = ["CEO"];
            let childPhones = !masterRoles?.includes(req?.loggedInUser?.role) ? req?.loggedInUser?.userPhone : null;

            let where = " ";

            const addCondition = (column, value) => {
                if (value === "-") {
                    where = checkWhereInQueryString(where);
                    where += ` ${column} IS NULL `;
                } else {
                    where = checkWhereInQueryString(where);
                    where += ` ${column} LIKE '%${value}%' `;
                }
            };

            const addConditionWithEmptyString = (column, value) => {
                if (value === "-") {
                    where = checkWhereInQueryString(where);
                    where += ` ${column} = ' ' `;
                } else {
                    where = checkWhereInQueryString(where);
                    where += ` ${column} LIKE '%${value}%' `;
                }
            };

            if (childPhones) {
                where = checkWhereInQueryString(where);
                where += ` d.dsa_mobile_number in (
                        WITH RECURSIVE DSAHierarchy AS (
                            SELECT dsa_mobile_number, partner_code
                            FROM ru_direct_selling_agents
                            WHERE dsa_mobile_number = '${childPhones}'
                            UNION ALL
                            SELECT t.dsa_mobile_number, t.partner_code
                            FROM ru_direct_selling_agents t
                            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                        ) 
                        SELECT dsa_mobile_number
                        FROM DSAHierarchy
                      ) `;
            };
            if (customer_id) addCondition('bbps.customer_id', customer_id);
            if (customer_full_name_filter) addConditionWithEmptyString('CONCAT_WS(" ", c.first_name, c.middle_name, c.last_name)', customer_full_name_filter);
            if (dsa_full_name_filter) addConditionWithEmptyString('CONCAT_WS(" ", d.first_name, d.middle_name, d.last_name)', dsa_full_name_filter);
            if (customer_mobile_number_filter) addCondition('c.customer_mobile_number', customer_mobile_number_filter);
            if (dsa_mobile_number_filter) addCondition('d.dsa_mobile_number', dsa_mobile_number_filter);
            if (biller_name_filter) addCondition('bbps.biller_name', biller_name_filter);
            if (biller_category_filter) addCondition('bbps.biller_category', biller_category_filter);
            if (amount_paid_filter) addCondition('bbps.amount_paid', amount_paid_filter);
            if (startDateFilter) {
                where = checkWhereInQueryString(where);
                where += ` DATE(bbps.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            };
            if (txn_id_filter) addCondition('bbps.txn_id', txn_id_filter);
            if (txn_url_filter) addCondition('bbps.txn_url', txn_url_filter);
            if (status_filter) addCondition('bbps.status', status_filter);
            if (biller_id_filter) addCondition('bbps.biller_id', biller_id_filter);
            if (session_id_filter) addCondition('bbps.session_id', session_id_filter);
            if (reference_id_filter) addCondition('bbps.reference_id', reference_id_filter);
            if (bill_number_filter) addCondition('bpd.bill_number', bill_number_filter);
            if (bill_amount_filter) addCondition('bpd.bill_amount', bill_amount_filter);
            if (dueDateFilter) {
                where = checkWhereInQueryString(where);
                where += ` DATE(bpd.due_date) = DATE("${dueDateFilter}") `;
            }

            // MUI X DataGrid filterModel — keep legacy filters unchanged.
            let whereFilterQuery = "";
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, ApiFieldMappings.getBbpsPaymentsFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    whereFilterQuery = filters.join(logicOp);
                }
            }
            if (whereFilterQuery) {
                where = checkWhereInQueryString(where);
                where += `(${whereFilterQuery})`;
            }

            let data = await BillsServices.getBbpsPayments(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getBbpsPaymentCategoryWise = async (req, res, next) => {
    try {
        const { error } = BillsValidationV1.getBbpsPayments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, dsa_full_name_filter, dsa_mobile_number_filter, biller_name_filter, biller_category_filter, amount_paid_filter, startDateFilter, endDateFilter } = req?.body;
            let masterRoles = ["CEO"];
            let childPhones = !masterRoles?.includes(req?.loggedInUser?.role) ? req?.loggedInUser?.userPhone : null;

            let where = " where (d.dsa_id and bbps.biller_category is not null) ";
            if (childPhones) {
                where = checkWhereInQueryString(where);
                where += ` d.dsa_mobile_number in (
                        WITH RECURSIVE DSAHierarchy AS (
                            SELECT dsa_mobile_number, partner_code
                            FROM ru_direct_selling_agents
                            WHERE dsa_mobile_number = '${childPhones}'
                            UNION ALL
                            SELECT t.dsa_mobile_number, t.partner_code
                            FROM ru_direct_selling_agents t
                            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                        ) 
                        SELECT dsa_mobile_number
                        FROM DSAHierarchy
                      ) `;
            };

            if (dsa_full_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` CONCAT_WS(' ', d.first_name, d.middle_name, d.last_name) like '%${dsa_full_name_filter}%' `;
            };
            if (dsa_mobile_number_filter) {
                where = checkWhereInQueryString(where);
                where += ` d.dsa_mobile_number like '%${dsa_mobile_number_filter}%' `;
            };
            if (biller_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` bbps.biller_name like '%${biller_name_filter}%' `;
            };
            if (biller_category_filter) {
                where = checkWhereInQueryString(where);
                where += ` bbps.biller_category like '%${biller_category_filter}%' `;
            };
            if (amount_paid_filter) {
                where = checkWhereInQueryString(where);
                where += ` bbps.amount_paid like '%${amount_paid_filter}%' `;
            };
            if (startDateFilter) {
                where = checkWhereInQueryString(where);
                where += ` DATE(bbps.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            };

            let editedPageSize = (pageNumber * pageSize) == 0 ? pageSize - 1 : 0;
            let data = await BillsServices.getBbpsPaymentCategoryWise(pageNumber * pageSize, editedPageSize || pageSize, where);

            if (editedPageSize) {
                let total = await BillsServices.getBbpsPaymentTotal(where);
                data.records = [total, ...data.records];
            };

            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getBbpsPaymentDateWise = async (req, res, next) => {
    try {
        const { error } = BillsValidationV1.getBbpsPaymentDateWise.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { type } = req?.body;
            let masterRoles = ["CEO"];
            let childPhones = (!masterRoles?.includes(req?.loggedInUser?.role) || type == "dsa_wise") ? req?.loggedInUser?.userPhone : null;
            let where = " where (bbps.biller_category is not null) ";
            if (childPhones) {
                where = checkWhereInQueryString(where);
                where += ` d.dsa_mobile_number in (
                        WITH RECURSIVE DSAHierarchy AS (
                            SELECT dsa_mobile_number, partner_code
                            FROM ru_direct_selling_agents
                            WHERE dsa_mobile_number = '${childPhones}'
                            UNION ALL
                            SELECT t.dsa_mobile_number, t.partner_code
                            FROM ru_direct_selling_agents t
                            INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                        ) 
                        SELECT dsa_mobile_number
                        FROM DSAHierarchy
                      ) `;
            };
            if (type == "self") {
                let dsa_id = await BillsServices.getDefaultDSA();
                where = checkWhereInQueryString(where);
                where += ` bbps.dsa_id = '${dsa_id?.setting_value}' `;
            };
            let data = await BillsServices.getBbpsPaymentDateWise(where);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        };
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getSimilarBills = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'getSimilarBills', {
            expense_id: req.body?.expense_id
        });

        const { error } = BillsValidationV1.getSimilarBills.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            apiLogger.logAPICall(req, res, 'getSimilarBills', {}, requestId, {
                validation_error: error.message
            });
            return errorResponse;
        }

        const { expense_id } = req.body;
        const bill = await BillsServices.getBillForApproval('id', expense_id);
        if (!bill) {
            const response = ResHelper.apiResponse(res, true, "Success", 200, { similar_bills: [] }, "");
            apiLogger.logAPICall(req, res, 'getSimilarBills', {}, requestId, { expense_id, bill_not_found: true });
            return response;
        }

        const totalAmount = (bill.expenses || []).reduce((sum, exp) => sum + (Number(exp?.amount) || 0), 0);
        const candidate = {
            dsa_id_vendor: bill.dsa_id,
            created_by: bill.created_by,
            bill_date: bill.bill_date,
            city: bill.city,
            account: bill.account,
            memo: bill.memo,
            bill_number: bill.bill_number,
            totalAmount
        };
        const similarBills = await BillsServices.findSimilarBills(candidate, expense_id);

        const response = ResHelper.apiResponse(res, true, "Success", 200, { similar_bills: similarBills }, "");
        apiLogger.logAPICall(req, res, 'getSimilarBills', {}, requestId, {
            expense_id,
            similar_bills_count: similarBills.length
        });
        return response;
    } catch (e) {
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'getSimilarBills', {}, requestId, {
            error: e.message,
            stack: e.stack,
            expense_id: req.body?.expense_id
        });
        return errorResponse;
    }
};

exports.getExpensesForEdit = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'getExpensesForEdit', {
            search_field: req.body?.search_field,
            value: req.body?.value
        });

        const { error } = BillsValidationV1.getExpensesForEdit.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            apiLogger.logAPICall(req, res, 'getExpensesForEdit', {}, requestId, {
                validation_error: error.message
            });
            return errorResponse;
        } else {
            const { search_field, value } = req?.body;
            let data = await BillsServices.getBillForApproval(search_field, value);
            if (data) {
                data.viewed_at = data?.viewed_at || null;
            }
            
            const response = ResHelper.apiResponse(res, true, "Success", 200, data, "");
            apiLogger.logAPICall(req, res, 'getExpensesForEdit', data, requestId, {
                search_field: search_field,
                value: value,
                data_found: !!data
            });
            return response;
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'getExpensesForEdit', {}, requestId, {
            error: e.message,
            stack: e.stack,
            search_field: req.body?.search_field,
            value: req.body?.value
        });
        return errorResponse;
    }
};
exports.getConsolidatedExpenses = async (req, res) => {
    let requestId = null;
    try {
        // Log API request
        requestId = apiLogger.logRequest(req, 'getConsolidatedExpenses', {
            billId: req.body?.billId
        });

        const { error } = BillsValidationV1.getConsolidatedExpenses.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            apiLogger.logAPICall(req, res, 'getConsolidatedExpenses', {}, requestId, {
                validation_error: error.message,
                validation_details: error.details
            });
            return errorResponse;
        } else {
            const { billId } = req.body;
            
            const dbStartTime = Date.now();
            let data = await BillsServices.getConsolidatedExpenses(billId);
            const dbDuration = Date.now() - dbStartTime;
            
            const response = ResHelper.apiResponse(res, true, "Success", 200, data, "");
            apiLogger.logAPICall(req, res, 'getConsolidatedExpenses', data, requestId, {
                billId: billId,
                record_count: data?.length || 0,
                query_duration_ms: dbDuration
            });
            return response;
        }
    }
    catch (e) {
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'getConsolidatedExpenses', {}, requestId, {
            error: e.message,
            stack: e.stack,
            billId: req.body?.billId
        });
        return errorResponse;
    }
}

exports.getInvoiceDetails = async (req, res) => {
    let requestId = null;
    try {
        // Log API request
        requestId = apiLogger.logRequest(req, 'getInvoiceDetails', {
            invoiceId: req.body?.invoiceId
        });

        const { error } = BillsValidationV1.getInvoiceDetails.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            apiLogger.logAPICall(req, res, 'getInvoiceDetails', {}, requestId, {
                validation_error: error.message,
                validation_details: error.details
            });
            return errorResponse;
        } else {
            const { invoiceId } = req.body;
            
            const dbStartTime = Date.now();
            let data = await BillsServices.getInvoiceDetails(invoiceId);
            const dbDuration = Date.now() - dbStartTime;
            
            const response = ResHelper.apiResponse(res, true, "Success", 200, data, "");
            apiLogger.logAPICall(req, res, 'getInvoiceDetails', data, requestId, {
                invoiceId: invoiceId,
                has_data: !!data,
                query_duration_ms: dbDuration
            });
            return response;
        }
    }
    catch (e) {
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'getInvoiceDetails', {}, requestId, {
            error: e.message,
            stack: e.stack,
            invoiceId: req.body?.invoiceId
        });
        return errorResponse;
    }
}
exports.getVendorDetailsByExpenseId = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'getVendorDetailsByExpenseId', {
            expense_id: req.body?.expense_id
        });

        const { error } = BillsValidationV1.getVendorDetailsByExpenseId.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            apiLogger.logAPICall(req, res, 'getVendorDetailsByExpenseId', {}, requestId, { validation_error: error.message });
            return errorResponse;
        }

        const { expense_id } = req.body;
        let data = await BillsServices.getVendorDetailsByExpenseId(expense_id);

        const response = ResHelper.apiResponse(res, true, "Success", 200, data, "");
        apiLogger.logAPICall(req, res, 'getVendorDetailsByExpenseId', data, requestId, {});
        return response;
    } catch (e) {
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'getVendorDetailsByExpenseId', {}, requestId, { error: e.message, stack: e.stack });
        return errorResponse;
    }
};

exports.mapDsaToVendorInvoices = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'mapDsaToVendorInvoices', {
            expense_id: req.body?.expense_id,
            dsa_id: req.body?.dsa_id
        });

        const { error } = BillsValidationV1.mapDsaToVendorInvoices.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            apiLogger.logAPICall(req, res, 'mapDsaToVendorInvoices', {}, requestId, { validation_error: error.message });
            return errorResponse;
        }

        const { expense_id, dsa_id } = req.body;
        let data = await BillsServices.mapDsaToVendorInvoices(expense_id, dsa_id);

        if (!data.matched) {
            const errorResponse = ResHelper.apiResponse(res, false, "DSA/company NetSuite internal id does not match the expense's vendor id", 400, data, "");
            apiLogger.logAPICall(req, res, 'mapDsaToVendorInvoices', data, requestId, {});
            return errorResponse;
        }

        const response = ResHelper.apiResponse(res, true, "Success", 200, data, "");
        apiLogger.logAPICall(req, res, 'mapDsaToVendorInvoices', data, requestId, {});
        return response;
    } catch (e) {
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'mapDsaToVendorInvoices', {}, requestId, { error: e.message, stack: e.stack });
        return errorResponse;
    }
};

exports.getInvoiceCompanyandBankDetails = async (req, res) => {
    try {
        const { error } = BillsValidationV1.getInvoiceCompanyandBankDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { invoiceId } = req.body;
            let data = await BillsServices.getInvoiceCompanyandBankDetails(invoiceId);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
exports.getActivityLogs = async (req, res) => {
    console.log("getActivityLogs called");
    try {
        const { error } = BillsValidationV1.getActivityLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { expense_id } = req.body;
            let data = await BillsServices.getActivityLogs(expense_id);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
exports.rejectInvoice = async (req, res) => {
    let requestId = null;
    try {
        // Log API request
        requestId = apiLogger.logRequest(req, 'rejectInvoice', {
            invoice_id: req.body?.invoice_id,
            reason: req.body?.reason
        });

        const { error } = BillsValidationV1.rejectInvoice.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            apiLogger.logAPICall(req, res, 'rejectInvoice', {}, requestId, {
                validation_error: error.message,
                validation_details: error.details
            });
            return errorResponse;
        } else {
            await KafkaServices.connectKafkaProducer();
            let { invoice_id, reason } = req?.body;
            const action = "REJECTED";
            
            // Handle both internal (req.loggedInUser) and external (req.dsa) endpoints
            const userId = req.loggedInUser?.id || req.dsa?.dsa_id;
            
            await BillsServices.invoiceActivityLogs(invoice_id, userId, action, reason);
            const invoice = await BillsServices.getInvoiceDetails(invoice_id);
            
            const newDsaOnboard = new KafkaServices.EventLogger(
                "invoice_reject_crm",
                "pending",
                `rejected reason :${reason}`,
                invoice_id,
                userId,
                new Date(),
            );
            await KafkaServices.sendToKafkaLoggerService(newDsaOnboard);
            //ns webhook starts//
            let status = NSInvoiceStatusJson;
            const event = "declined";
            if (status[event]) {
                let payload = {
                    "internal_id": invoice?.ns_internal_id || "12423",
                    "approval_status": status[event],
                    "rejection_reason": status[event] == "2" ? "Declined by DSA" : reason,
                    "invoice_link": invoice?.sign_url || ""
                }
                const data = await callNsApi({
                    "api": "customscript_rest_update_vb_status",
                    "payload": payload
                });

                const { Code } = data;
                
                const response = ResHelper.apiResponse(res, true, `NS Response`, Code, data, "");
                apiLogger.logAPICall(req, res, 'rejectInvoice', data, requestId, {
                    invoice_id: invoice_id,
                    reason: reason,
                    action: action,
                    user_id: userId,
                    ns_response_code: Code,
                    webhook_success: true,
                    kafka_events_sent: 1
                });
                return response;
            };
            //ns webhook ends//
            
            const response = ResHelper.apiResponse(res, true, "Success", 200, {}, "");
            apiLogger.logAPICall(req, res, 'rejectInvoice', {}, requestId, {
                invoice_id: invoice_id,
                reason: reason,
                action: action,
                user_id: userId,
                webhook_success: false,
                kafka_events_sent: 1
            });
            return response;
        }
    }
    catch (e) {
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'rejectInvoice', {}, requestId, {
            error: e.message,
            stack: e.stack,
            invoice_id: req.body?.invoice_id,
            reason: req.body?.reason
        });
        return errorResponse;
    }
};

exports.updateInvoiceContact = async (req, res, next) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'updateInvoiceContact', {
            expense_id: req.body?.expense_id,
            dsa_id: req.body?.dsa_id,
            email: req.body?.email
        });

        const { error } = BillsValidationV1.updateInvoiceContact.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            apiLogger.logAPICall(req, res, 'updateInvoiceContact', {}, requestId, {
                validation_error: error.message
            });
            return errorResponse;
        } else {
            const { expense_id, dsa_id, email, old_email } = req?.body;
            const isEmailChanged = !!old_email && old_email !== email;

            // Update DSA email only — keep sign_id / sign_url so OpenSign reuses the same doc.
            await BillsServices.updateInvoiceContactDetails(expense_id || null, dsa_id, email);

            // Only when the email actually changed does the signer identity change — clear the
            // existing sign fields so the next send gets a fresh OpenSign document. A plain resend
            // (email unchanged) must reuse the existing sign_id/sign_url as-is.
            if (expense_id && isEmailChanged) {
                await BillsServices.clearSignFieldsAfterDecline(expense_id);
            }

            const userId = req?.loggedInUser?.id || req?.dsa?.dsa_id || 'system';
            let kafkaEventsSent = 0;

            // Only trigger invoice sending when expense_id is present
            if (expense_id) {
                await KafkaServices.connectKafkaProducer();
                const invoiceContactUpdate = new KafkaServices.EventLogger(
                    "invoice_contact_update",
                    old_email || '',
                    email,
                    expense_id,
                    userId,
                    new Date(),
                );
                await KafkaServices.sendToKafkaLoggerService(invoiceContactUpdate);

                const invoiceTrigger = new KafkaServices.InvoiceSignTrigger(
                    "invoice",
                    [expense_id],
                    userId,
                    "InvoiceSignTrigger"
                );
                await KafkaServices.sendToKafka(invoiceTrigger);

                const invoiceSignRequest = new KafkaServices.EventLogger(
                    "invoice_sign_request",
                    expense_id,
                    "Email sent to sign invoice after contact update",
                    userId,
                    new Date(),
                );
                await KafkaServices.sendToKafkaLoggerService(invoiceSignRequest);
                kafkaEventsSent = 2;
            }
            
            try {
                await KafkaServices.connectKafkaProducer();
                const evt = new KafkaServices.VendorSnapshotEvent('CONTACT_UPDATED', dsa_id, { email }, userId);
                await KafkaServices.sendToKafkaVendorSnapshot(evt);
            } catch (kafkaErr) {
                logger.error('VendorSnapshotEvent Kafka failed in updateInvoiceContact', kafkaErr);
            }

            const message = expense_id
                ? "Vendor email updated successfully. The email for invoice signing will be sent shortly."
                : "Vendor email updated successfully.";
            const response = ResHelper.apiResponse(res, true, message, 200, {}, "");
            apiLogger.logAPICall(req, res, 'updateInvoiceContact', {}, requestId, {
                expense_id: expense_id || null,
                old_email: old_email,
                new_email: email,
                kafka_events_sent: kafkaEventsSent
            });
            return response;
        }
    } catch (e) {
        console.log(e);
        logger.error(e);
        const isDuplicateEmail =
            e.name === 'SequelizeUniqueConstraintError' ||
            (e.original && e.original.code === 'ER_DUP_ENTRY') ||
            (e.parent && e.parent.code === 'ER_DUP_ENTRY') ||
            (e.message && e.message.includes('email_address') && e.message.includes('unique'));
        if (isDuplicateEmail) {
            const errorResponse = ResHelper.apiResponse(res, false, "Email already exists", 400, {}, "");
            apiLogger.logAPICall(req, res, 'updateInvoiceContact', {}, requestId, {
                error: 'Email already exists',
                duplicate_email: req.body?.email
            });
            return errorResponse;
        }
        const errorResponse = ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
        apiLogger.logAPICall(req, res, 'updateInvoiceContact', {}, requestId, {
            error: e.message,
            stack: e.stack
        });
        return errorResponse;
    }
};
exports.sendBulkInvoiceEmail = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'sendBulkInvoiceEmail', {
            expense_ids: req.body?.expense_ids,
            select_all: req.body?.select_all
        });

        const { error } = BillsValidationV1.sendBulkInvoiceEmail.validate(req.body);
        if (error) {
            const errorResponse = ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            apiLogger.logAPICall(req, res, 'sendBulkInvoiceEmail', {}, requestId, {
                validation_error: error.message
            });
            return errorResponse;
        }

        const { expense_ids = [], select_all = false } = req.body;

        await KafkaServices.connectKafkaProducer();

        if (expense_ids.length > 0) {
            // Keep existing sign_id / sign_url so OpenSign reuses the same doc (Python passes sign_id in payload).
            const invoiceTrigger = new KafkaServices.InvoiceSignTrigger(
                "invoice",
                expense_ids,
                req?.loggedInUser?.id || "system",
                "InvoiceSignTrigger"
            );
            await KafkaServices.sendToKafka(invoiceTrigger);

            for (const expense_id of expense_ids) {
                const dsaUpdatedDetails = new KafkaServices.EventLogger(
                    "invoice_sign_request",
                    expense_id,
                    "Email sent to sign invoice",
                    req?.loggedInUser?.id || 'auto generated',
                    new Date(),
                );

                await KafkaServices.sendToKafkaLoggerService(dsaUpdatedDetails);
            }
        }
        if (select_all) {
            const category = "invoices";
            const status = "Pending_Invoices";

            let where = "";
            let having = "";
            let masterRoles = ["CEO", "CFO"];
            let pageNumber = 0;
            const pageSize = 50;

            const childPhones = !masterRoles.includes(req?.loggedInUser?.role)
                ? req?.loggedInUser?.userPhone
                : null;

            if (childPhones) {
                where = checkWhereInQueryString(where);
                where += ` (d.dsa_mobile_number in (
                    WITH RECURSIVE DSAHierarchy AS (
                        SELECT dsa_mobile_number, partner_code
                        FROM ru_direct_selling_agents
                        WHERE dsa_mobile_number = '${childPhones}'
                        UNION ALL
                        SELECT t.dsa_mobile_number, t.partner_code
                        FROM ru_direct_selling_agents t
                        INNER JOIN DSAHierarchy d ON t.partner_code = d.dsa_mobile_number
                    )
                    SELECT dsa_mobile_number FROM DSAHierarchy
                ) OR e.created_by = "${req?.loggedInUser?.id}" ) `;
            }

            if (status === "Pending_Invoices") {
                where = checkWhereInQueryString(where);
                where += `
                    (e.status = 'Pending Approval' AND e.status_alias IS NULL)
                    AND d.email_address REGEXP '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
                `;
            }

            if (category) {
                where = checkWhereInQueryString(where);
                where += ` e.category = "${category}" `;
            }

            // ✅ Step 1: Fetch page 0 to get total count
            const firstPage = await BillsServices.getExpenses(0, 1, where, having);
            const totalRecords = firstPage.totalRecords || 0;

            // ✅ Step 2: Loop over batches of 50
            for (let offset = 0; offset < totalRecords; offset += pageSize) {
                const pageData = await BillsServices.getExpenses(offset, pageSize, where, having);
                const ids = pageData?.records?.map(r => r.expense_id).filter(Boolean);

                if (ids.length > 0) {
                    // Keep existing sign_id so OpenSign reuses the same doc on resend.
                    const trigger = new KafkaServices.InvoiceSignTrigger(
                        "invoice",
                        ids,
                        req?.loggedInUser?.id || "system",
                        "InvoiceSignTrigger"
                    );
                    logger.log("Sending to Kafka for bulk invoice email", trigger);
                    await KafkaServices.sendToKafka(trigger);
                }
            }
        }

        const response = ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        apiLogger.logAPICall(req, res, 'sendBulkInvoiceEmail', {}, requestId, {
            expense_ids_count: expense_ids?.length || 0,
            select_all: select_all,
            total_processed: select_all ? 'all_pending_invoices' : expense_ids?.length || 0,
            kafka_events_sent: 1
        });
        return response;
    } catch (e) {
        logger.error(e);
        const errorResponse = ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, {});
        apiLogger.logAPICall(req, res, 'sendBulkInvoiceEmail', {}, requestId, {
            error: e.message,
            stack: e.stack,
            expense_ids: req.body?.expense_ids,
            select_all: req.body?.select_all
        });
        return errorResponse;
    }
};

exports.markItAsRead = async (req, res) => {
    try {
        const { error } = BillsValidationV1.markItAsRead.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { expense_id, read } = req.body;
        const viewedAt = read === 'read' ? getISTDateTimeString() : null;

        const result = await BillsServices.markExpenseReadState({
            expense_id,
            viewed_at: viewedAt
        });

        const affectedRows = Array.isArray(result) ? Number(result[1] || 0) : 0;
        if (affectedRows === 0) {
            return ResHelper.apiResponse(res, false, "Expense not found", 404, {}, "");
        }

        return ResHelper.apiResponse(
            res,
            true,
            "Success",
            200,
            { expense_id, viewed_at: viewedAt },
            ""
        );
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};
exports.getAnalyticsData = async (req, res) => {
    try {
        const { error } = BillsValidationV1.getAnalyticsData.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            const { chart, dateFrom, dateTo, amountKey } = req.body;
            const bills = await BillsServices.getAnalyticsData(chart, dateFrom, dateTo);

            return ResHelper.apiResponse(res, true, "Success", 200, bills, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const expenseFavouriteBusinessErrors = new Set([
    'You can only favourite your own bills',
    'Bill not in favourites',
    'Favourite not found',
    'Invalid expense_id',
]);

exports.addFavourite = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'addFavourite', { expense_id: req.body?.expense_id });
        if (!req.loggedInUser?.id) {
            const r = ResHelper.apiResponse(res, false, 'Unauthorized', 401, {}, "");
            apiLogger.logAPICall(req, res, 'addFavourite', {}, requestId, { error: 'missing user id' });
            return r;
        }
        const { error } = BillsValidationV1.addFavourite.validate(req.body);
        if (error) {
            apiLogger.logAPICall(req, res, 'addFavourite', {}, requestId, { validation_error: error.message });
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }
        const { expense_id, favourite_id } = req.body;
        const label = req.body.label ?? req.body.lable;
        const data = await BillsServices.addFavourite({
            created_by: req.loggedInUser.id,
            expense_id,
            favourite_id,
            label,
        });
        apiLogger.logAPICall(req, res, 'addFavourite', data, requestId, { favourite_id: data?.favourite_id });
        return ResHelper.apiResponse(res, true, 'Success', 200, data, '');
    } catch (e) {
        console.log(e);
        logger.error(e);
        const code = expenseFavouriteBusinessErrors.has(e.message) ? 400 : 500;
        apiLogger.logAPICall(req, res, 'addFavourite', {}, requestId, { error: e.message, stack: e.stack });
        return ResHelper.apiResponse(res, false, e.message || 'Error occured during execution', code, {}, '');
    }
};

exports.removeFavourite = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'removeFavourite', { expense_id: req.body?.expense_id });
        if (!req.loggedInUser?.id) {
            apiLogger.logAPICall(req, res, 'removeFavourite', {}, requestId, { error: 'missing user id' });
            return ResHelper.apiResponse(res, false, 'Unauthorized', 401, {}, '');
        }
        const { error } = BillsValidationV1.removeFavourite.validate(req.body);
        if (error) {
            apiLogger.logAPICall(req, res, 'removeFavourite', {}, requestId, { validation_error: error.message });
            return ResHelper.apiResponse(res, false, error.message, 400, {}, '');
        }
        const data = await BillsServices.removeFavourite({
            created_by: req.loggedInUser.id,
            expense_id: req.body.expense_id,
            favourite_id: req.body.favourite_id,
        });
        apiLogger.logAPICall(req, res, 'removeFavourite', data, requestId, {});
        return ResHelper.apiResponse(res, true, 'Success', 200, data, '');
    } catch (e) {
        console.log(e);
        logger.error(e);
        const code = expenseFavouriteBusinessErrors.has(e.message) ? 400 : 500;
        apiLogger.logAPICall(req, res, 'removeFavourite', {}, requestId, { error: e.message, stack: e.stack });
        return ResHelper.apiResponse(res, false, e.message || 'Error occured during execution', code, {}, '');
    }
};

exports.getFavourites = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'getFavourites', {});
        if (!req.loggedInUser?.id) {
            apiLogger.logAPICall(req, res, 'getFavourites', {}, requestId, { error: 'missing user id' });
            return ResHelper.apiResponse(res, false, 'Unauthorized', 401, {}, '');
        }
        const { error } = BillsValidationV1.getFavourites.validate(req.body || {});
        if (error) {
            apiLogger.logAPICall(req, res, 'getFavourites', {}, requestId, { validation_error: error.message });
            return ResHelper.apiResponse(res, false, error.message, 400, {}, '');
        }
        const data = await BillsServices.getFavourites({ created_by: req.loggedInUser.id });
        apiLogger.logAPICall(req, res, 'getFavourites', data, requestId, { totalRecords: data?.totalRecords });
        return ResHelper.apiResponse(res, true, 'Success', 200, data, '');
    } catch (e) {
        console.log(e);
        logger.error(e);
        apiLogger.logAPICall(req, res, 'getFavourites', {}, requestId, { error: e.message, stack: e.stack });
        return ResHelper.apiResponse(res, false, e.message || 'Error occured during execution', 500, {}, '');
    }
};

exports.setReminder = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'setReminder', {
            expense_id: req.body?.expense_id,
            favourite_id: req.body?.favourite_id,
        });
        if (!req.loggedInUser?.id) {
            apiLogger.logAPICall(req, res, 'setReminder', {}, requestId, { error: 'missing user id' });
            return ResHelper.apiResponse(res, false, 'Unauthorized', 401, {}, '');
        }
        const { error } = BillsValidationV1.setReminder.validate(req.body);
        if (error) {
            apiLogger.logAPICall(req, res, 'setReminder', {}, requestId, { validation_error: error.message });
            return ResHelper.apiResponse(res, false, error.message, 400, {}, '');
        }
        const { expense_id, favourite_id, reminder_day } = req.body;
        const hasLabel = Object.prototype.hasOwnProperty.call(req.body, 'label')
            || Object.prototype.hasOwnProperty.call(req.body, 'lable');
        const label = hasLabel ? (req.body.label ?? req.body.lable) : undefined;
        const data = await BillsServices.setReminder({
            created_by: req.loggedInUser.id,
            expense_id,
            favourite_id,
            reminder_day,
            label,
        });
        apiLogger.logAPICall(req, res, 'setReminder', data, requestId, {});
        return ResHelper.apiResponse(res, true, 'Success', 200, data, '');
    } catch (e) {
        console.log(e);
        logger.error(e);
        const code = expenseFavouriteBusinessErrors.has(e.message) ? 400 : 500;
        apiLogger.logAPICall(req, res, 'setReminder', {}, requestId, { error: e.message, stack: e.stack });
        return ResHelper.apiResponse(res, false, e.message || 'Error occured during execution', code, {}, '');
    }
};

exports.checkReminders = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'checkReminders', {});
        if (!req.loggedInUser?.id) {
            apiLogger.logAPICall(req, res, 'checkReminders', {}, requestId, { error: 'missing user id' });
            return ResHelper.apiResponse(res, false, 'Unauthorized', 401, {}, '');
        }
        const { error } = BillsValidationV1.checkReminders.validate(req.body || {});
        if (error) {
            apiLogger.logAPICall(req, res, 'checkReminders', {}, requestId, { validation_error: error.message });
            return ResHelper.apiResponse(res, false, error.message, 400, {}, '');
        }
        const data = await BillsServices.checkReminders({ created_by: req.loggedInUser.id });
        apiLogger.logAPICall(req, res, 'checkReminders', data, requestId, { count: data?.reminders?.length });
        return ResHelper.apiResponse(res, true, 'Success', 200, data, '');
    } catch (e) {
        console.log(e);
        logger.error(e);
        apiLogger.logAPICall(req, res, 'checkReminders', {}, requestId, { error: e.message, stack: e.stack });
        return ResHelper.apiResponse(res, false, e.message || 'Error occured during execution', 500, {}, '');
    }
};

exports.dismissReminder = async (req, res) => {
    let requestId = null;
    try {
        requestId = apiLogger.logRequest(req, 'dismissReminder', { favourite_id: req.body?.favourite_id });
        if (!req.loggedInUser?.id) {
            apiLogger.logAPICall(req, res, 'dismissReminder', {}, requestId, { error: 'missing user id' });
            return ResHelper.apiResponse(res, false, 'Unauthorized', 401, {}, '');
        }
        const { error } = BillsValidationV1.dismissReminder.validate(req.body || {});
        if (error) {
            apiLogger.logAPICall(req, res, 'dismissReminder', {}, requestId, { validation_error: error.message });
            return ResHelper.apiResponse(res, false, error.message, 400, {}, '');
        }
        const data = await BillsServices.dismissReminder({
            created_by: req.loggedInUser.id,
            expense_id: req.body.expense_id,
            favourite_id: req.body.favourite_id,
        });
        apiLogger.logAPICall(req, res, 'dismissReminder', data, requestId, {});
        return ResHelper.apiResponse(res, true, 'Success', 200, data, '');
    } catch (e) {
        console.log(e);
        logger.error(e);
        const code = expenseFavouriteBusinessErrors.has(e.message) ? 400 : 500;
        apiLogger.logAPICall(req, res, 'dismissReminder', {}, requestId, { error: e.message, stack: e.stack });
        return ResHelper.apiResponse(res, false, e.message || 'Error occured during execution', code, {}, '');
    }
};
