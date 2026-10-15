const { de } = require("date-fns/locale");
let Joi = require("joi");
const { filtersJoiObject } = require("../../../helpers/commonhelper");

exports.getInvoices = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    sortBy: Joi.string().allow(null, ''),
    sortDirection: Joi.string().valid('asc', 'desc').allow(null, ''),
    status: Joi.string().valid('Unsigned', 'Approved').allow(null, ''),
    bill_number: Joi.string().allow(null, ''),
    pan: Joi.string().allow(null, ''),
});

exports.createBills = Joi.object({
    description: Joi.string().required(),
    dsa_id_vendor: Joi.string().required(),
    partner_code: Joi.string().allow(null, '').optional(),
    expenses: Joi.array().items(Joi.object({
        amount: Joi.number().positive().required().messages({
            'number.base': 'amount must be a number',
            'any.required': 'amount is required',
            'number.positive': 'amount must be greater than 0',
        }),
        expense_type: Joi.string().required(),
        expense_type_value: Joi.string().required(),
        attachment: Joi.string().trim().min(1).required().messages({
            'any.required': 'attachment is required',
            'string.empty': 'attachment is required',
            'string.min': 'attachment is required',
            'string.base': 'attachment is required',
        }),
        attachment_2: Joi.string().allow(null, "").optional(),
        attachment_view: Joi.string().allow(null, ""),
        class_id: Joi.string().allow(null, "").optional(),
        dsa_id: Joi.string().allow(null, "").optional(),
        debit_to_vendor: Joi.boolean().allow(null, "").optional(),
        dsa_mobile_number: Joi.string().allow(null, "").optional(),
        business_head_code: Joi.string().allow(null, "").optional(),
    })),
    city: Joi.string().required(),
    bill_number: Joi.string().required(),
    bill_date: Joi.string().required(),
    enable_duplicacy: Joi.boolean().allow(null, ""),
    expense_id: Joi.number().allow(null, ""),
    ns_hierarchy: Joi.string().allow(null, "").optional(),
    force_create: Joi.boolean().allow(null, "").optional(),

});

exports.updateBillStatus = Joi.object({
    expense_id: Joi.number().required(),
    status: Joi.number().required(),
    enable_duplicacy: Joi.boolean().allow(null, ""),
    reason: Joi.string().allow(null, "")
});

exports.getSimilarBills = Joi.object({
    expense_id: Joi.number().required(),
});

exports.getVendorDetailsByExpenseId = Joi.object({
    expense_id: Joi.string().required(),
});

exports.mapDsaToVendorInvoices = Joi.object({
    expense_id: Joi.string().required(),
    dsa_id: Joi.string().required(),
});

exports.getExpensesForEdit = Joi.object({
    search_field: Joi.string().required(),
    value: Joi.string().required(),
});

exports.getExpenses = Joi.object({
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    dsa_filter: Joi.string().allow(null, ""),
    memo_filter: Joi.string().allow(null, ""),
    status_filter: Joi.string().allow(null, ""),
    account_filter: Joi.string().allow(null, ""),
    created_by_filter: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    dsa_mobile_number_filter: Joi.string().allow(null, ""),
    created_by_id: Joi.boolean().allow(null, ""),
    status: Joi.string().allow(null, ""),
    billStartDateFilter: Joi.string().allow(null, ""),
    billEndDateFilter: Joi.string().allow(null, ""),
    category: Joi.string().allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
    remarks: Joi.boolean().allow(null, ""),
    bill_number_filter: Joi.string().allow(null, ""),
    gstin_filter: Joi.string().allow(null, ""),
    dsa_pan_filter: Joi.string().allow(null, ""),
    dsa_class_filter: Joi.string().allow(null, ""),
    cgst_filter: Joi.string().allow(null, ""),
    sgst_filter: Joi.string().allow(null, ""),
    igst_filter: Joi.string().allow(null, ""),
    tax_amount_filter: Joi.string().allow(null, ""),
    amount_filter: Joi.string().allow(null, ""),
    status_alias_filter: Joi.string().allow(null, ""),
    class_id_filter : Joi.string().allow(null, ""),
    base_amount_filter: Joi.string().allow(null, ""),
    dsa_email_address_filter: Joi.string().allow(null, ""),
    expense_type_filter: Joi.string().allow(null, ""),
    type : Joi.string().allow(null, "").optional(),
    filterModel: Joi.object({
            items: Joi.array().items(
                Joi.object({
                    field: Joi.string().required(),
                    operator: Joi.string().valid(
                        'contains',
                        'doesNotContain',
                        'doesNotEqual',
                        'equals',
                        'startsWith',
                        'endsWith',
                        'isEmpty',
                        'isNotEmpty',
                        'isAnyOf',
                        'is',
                        'not',
                        'after',
                        'onOrAfter',
                        'before',
                        'onOrBefore',
                        'isEmpty',
                        'isNotEmpty'
                    ).required(),
                    fromInput: Joi.string().allow(null, ""),
                    id: Joi.number(),
                    value: Joi.alternatives().try(
                        Joi.string().allow('', null),
                        Joi.number().allow(null),
                        Joi.boolean().allow(null),
                        Joi.object({
                            startDate: Joi.string().isoDate().allow(null, ''),
                            endDate: Joi.string().isoDate().allow(null, '')
                        }).allow(null),
                        Joi.array().items(Joi.string()).allow(null)
                    ).default(null)
                })
            ).default([]),
        }).default({ items: [] }),
        logicOperator: Joi.string().valid("and", "or").allow(null, ""),
        sortBy: Joi.string().allow(null, ''),
        sortDirection: Joi.string().valid('asc', 'desc').allow(null, ''),
});

exports.getExpenseItems = Joi.object({
    pageNumber: Joi.number().required(),
    pageSize: Joi.number().required(),
    expense_id: Joi.string().required(),
    department_filter: Joi.string().allow(null, ""),
    expense_type_filter: Joi.string().allow(null, ""),
    amount_filter: Joi.string().allow(null, ""),
    tax_section_code_filter: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    base_amount_filter: Joi.string().allow(null, ""),
    tax_amount_filter: Joi.string().allow(null, ""),
    tax_rate_filter: Joi.string().allow(null, ""),
    cgst_filter: Joi.string().allow(null, ""),
    sgst_filter: Joi.string().allow(null, ""),
    igst_filter: Joi.string().allow(null, ""),
    memo_filter: Joi.string().allow(null, ""),
});

exports.deleteExpense = Joi.object({
    expense_id: Joi.number().required(),
});

exports.deleteExpenseItems = Joi.object({
    item_id: Joi.number().required(),
});

exports.getBbpsPayments = filtersJoiObject.append({
    customer_full_name_filter: Joi.string().allow(null, ""),
    customer_mobile_number_filter: Joi.string().allow(null, ""),
    dsa_full_name_filter: Joi.string().allow(null, ""),
    dsa_mobile_number_filter: Joi.string().allow(null, ""),
    biller_name_filter: Joi.string().allow(null, ""),
    biller_category_filter: Joi.string().allow(null, ""),
    customer_id: Joi.string().allow(null, ""),
    amount_paid_filter: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    txn_id_filter: Joi.string().allow(null, ""),
    txn_url_filter: Joi.string().allow(null, ""),
    status_filter: Joi.string().allow(null, ""),
    biller_id_filter: Joi.string().allow(null, ""),
    session_id_filter: Joi.string().allow(null, ""),
    reference_id_filter: Joi.string().allow(null, ""),
    bill_number_filter: Joi.string().allow(null, ""),
    bill_amount_filter: Joi.string().allow(null, ""),
    dueDateFilter: Joi.string().allow(null, ""),
    is_export: Joi.boolean().allow(null, ""),
});

exports.getBbpsPaymentCategoryWise = Joi.object({
    pageNumber: Joi.number().required(),
    pageSize: Joi.number().required(),
    dsa_full_name_filter: Joi.string().allow(null, ""),
    dsa_mobile_number_filter: Joi.string().allow(null, ""),
    biller_name_filter: Joi.string().allow(null, ""),
    biller_category_filter: Joi.string().allow(null, ""),
    amount_paid_filter: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
});

exports.getBbpsPaymentDateWise = Joi.object({
    type: Joi.string().allow(null, ""),
});
exports.getConsolidatedExpenses = Joi.object({
    billId: Joi.string().required(),
});
exports.getInvoiceDetails = Joi.object({
    invoiceId: Joi.string().required(),
});

exports.getInvoiceCompanyandBankDetails = Joi.object({
    invoiceId: Joi.string().required(),
});
exports.getActivityLogs = Joi.object({
    expense_id: Joi.string().required(),
});
exports.rejectInvoice = Joi.object({
    invoice_id: Joi.string().required(),
    reason: Joi.string().required(),
});

exports.updateInvoiceContact = Joi.object().keys({
    expense_id: Joi.string().optional().allow(null, ""),
    dsa_id: Joi.string().required(),
    email: Joi.string().email().required(),
    old_email: Joi.any().optional()
}).options({ allowUnknown: true });
exports.sendBulkInvoiceEmail = Joi.object({
    expense_ids: Joi.array().items(Joi.string()).allow(null, "").optional(),
    select_all : Joi.boolean().optional().allow(null, "")
});
exports.markItAsRead = Joi.object({
    expense_id: Joi.string().required(),
    read: Joi.string().valid('read', 'unread').required()
});
exports.getAnalyticsData = Joi.object({
    chart: Joi.string().required(),
    dateFrom: Joi.date().required(),
    dateTo: Joi.date().required(),
    amountKey: Joi.string().optional().allow(null, "")
});

exports.addFavourite = Joi.object({
    expense_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+$/)).optional(),
    favourite_id: Joi.string().trim().min(1).optional(),
    label: Joi.string().trim().allow('', null).optional(),
    lable: Joi.string().trim().allow('', null).optional(),
}).xor('expense_id', 'favourite_id');

exports.removeFavourite = Joi.object({
    expense_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+$/)).optional(),
    favourite_id: Joi.string().trim().min(1).optional(),
}).xor('expense_id', 'favourite_id');

exports.getFavourites = Joi.object({});

exports.setReminder = Joi.object({
    expense_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+$/)).optional(),
    favourite_id: Joi.string().trim().min(1).optional(),
    reminder_day: Joi.number().integer().min(0).max(28).allow(null).required(),
    // Sent by UI for convenience; server derives is_reminder from reminder_day (1–28 vs clear).
    is_reminder: Joi.alternatives().try(Joi.number().integer().valid(0, 1), Joi.boolean()).optional(),
    // Same column as addFavourite; optional on this call.
    label: Joi.string().trim().allow('', null).optional(),
    lable: Joi.string().trim().allow('', null).optional(),
}).xor('expense_id', 'favourite_id').unknown(true);

exports.checkReminders = Joi.object({});

exports.dismissReminder = Joi.object({
    expense_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+$/)).optional(),
    favourite_id: Joi.string().trim().min(1).optional(),
}).xor('expense_id', 'favourite_id').unknown(true);