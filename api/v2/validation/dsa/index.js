let Joi = require("joi");
const moment = require("moment");
const { filtersJoiObject } = require("../../../helpers/commonhelper");
const { getMinimumAllowedAutonomousDisbDateFrom } = require("../../finance/leads/autonomous/autonomousHelper");

const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const msmeRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
let pan_regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
let pincode_regex = /^[1-9][0-9]{5}$/;
let adhaar_regex = /^[2-9]{1}[0-9]{11}$/;
let phone_regex = /^[6-9]\d{9}$/;
let company_pan_regex = /^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$/;
let string_regex = /^[A-Za-z\s]+$/;
let numeric_regex = /^\d+$/;

exports.addDsaBasicDetails = Joi.object({
    "company_pan": Joi.string()
        .pattern(company_pan_regex)
        .message('Please enter a valid Company PAN number (e.g., ABCDE1234F)')
        .allow(null, ''),

    "partner_code": Joi.string()
        .pattern(phone_regex)
        .message('Partner code must be a valid 10-digit mobile number')
        .required()
        .messages({
            'string.empty': 'Partner code is required',
            'any.required': 'Partner code is required'
        }),

    "role_in_company": Joi.string().allow(null, ''),
    "profession": Joi.string().allow(null, ''),
    "company_pan_image": Joi.string().allow(null, ""),

    "first_name": Joi.string()
        .pattern(string_regex)
        .message('First Name must contain only alphabets')
        .required()
        .messages({
            'string.empty': 'First Name is required',
            'any.required': 'First Name is required'
        }),

    "middle_name": Joi.string()
        .pattern(string_regex)
        .message('Middle Name must contain only alphabets')
        .allow(null, ""),

    "last_name": Joi.string()
        .pattern(string_regex)
        .message('Last Name must contain only alphabets')
        .allow(null, ""),

    "email": Joi.string().email().required()
        .messages({
            'string.empty': 'Email Address is required',
            'string.email': 'Please enter a valid Email Address',
            'any.required': 'Email Address is required',
        }),
    "gender": Joi.string().valid("male", "female", "others").required().messages({
        'any.only': 'Gender must be one of male, female, or others',
        'string.empty': 'Gender is required',
        'any.required': 'Gender is required'
    }),
    "dob": Joi.string().required(null, "", undefined).messages({
        'string.empty': 'Date of Birth is required',
        'any.required': 'Date of Birth is required'
    }),
    "dsa_id": Joi.string().allow(null, ""),
    "type": Joi.string().allow(null, ""),
    "business_type": Joi.string().allow(null, ""),
    "company_name": Joi.string().allow(null, ""),
    "utm_main_source": Joi.string().allow(null, ""),
    "utm_source": Joi.string().allow(null, ""),
});

exports.sendDsaEmailAddressVerificationOtp = Joi.object({
    email: Joi.string().email().required().messages({
        "string.empty": "Email is required",
        "string.email": "Please enter a valid email address",
        "any.required": "Email is required"
    }),
    /** Optional: when CRM acts for another DSA. Otherwise DSA is resolved from `req.dsa` or `loggedInUser.userPhone` → DSA row. */
    dsa_id: Joi.string().trim().allow(null, "").optional()
});

exports.verifyDsaEmailAddressVerificationOtp = Joi.object({
    email: Joi.string().email().required().messages({
        "string.empty": "Email is required",
        "string.email": "Please enter a valid email address",
        "any.required": "Email is required"
    }),
    otp: Joi.alternatives()
        .try(
            Joi.string().pattern(/^\d{6}$/).messages({ "string.pattern.base": "OTP must be 6 digits" }),
            Joi.number().integer().min(100000).max(999999)
        )
        .required()
        .messages({
            "any.required": "OTP is required"
        }),
    /** Optional: when CRM acts for another DSA. Otherwise DSA is resolved from `req.dsa` or `loggedInUser.userPhone` → DSA row. */
    dsa_id: Joi.string().trim().allow(null, "").optional()
});

/** B2B external — same body as first-time verify; email must already be verified on profile. */
exports.sendDsaEmailReverificationOtp = exports.sendDsaEmailAddressVerificationOtp;
exports.verifyDsaEmailReverificationOtp = exports.verifyDsaEmailAddressVerificationOtp;

exports.addDsaKyc = Joi.object({
    "dsa_id": Joi.string().allow(null, ""),
    "pan_number": Joi.string()
        .pattern(pan_regex)
        .message('Please enter a valid Personal PAN number (e.g., ABCDE1234F)')
        .allow(null, ""),

    "aadhar_number": Joi.string()
        .pattern(adhaar_regex)
        .message('Please enter a valid 12-digit Aadhaar number')
        .allow(null, ""),

    "pan": Joi.string().allow(null, ""),
    "aadhar_front": Joi.string().allow(null, ""),
    "aadhar_back": Joi.string().allow(null, ""),
    selfie: Joi.string()
        .required()
        .messages({
            'string.base': 'Selfie must be a valid file.',
            'string.empty': 'Please upload your selfie.',
            'any.required': 'Selfie is required.'
        })
});

exports.addCompanyDetails = Joi.object({
    "dsa_id": Joi.string().allow(null, ""),
    phone: Joi.string()
        .pattern(phone_regex)
        .message('Please enter a valid 10-digit mobile number')
        .allow(null, ""),

    // pan_number: Joi.string()
    //     .pattern(pan_regex)
    //     .message('Invalid PAN number format')
    //     .required(),

    gstin: Joi.string()
        .pattern(gstRegex)
        .allow(null, "")
        .messages({
            'string.pattern.base': 'Please enter a valid GST number',
            'string.empty': 'GST number is required'
        }),

    msme_no: Joi.string()
        .pattern(msmeRegex)
        .allow(null, "")
        .messages({
            'string.pattern.base': 'Please enter a valid MSME/Udyam number',
            'string.empty': 'MSME/Udyam number is required'
        }),

    short_name: Joi.string().allow(null, ""),
    date_of_incorp: Joi.string().required().messages({
        'string.empty': 'Date of Incorporation is required',
        'any.required': 'Date of Incorporation is required'
    }),
    msme_doc: Joi.string().allow(null, ""),

    // partnership docs
    pal_doc: Joi.string().allow(null, ""),
    partnership_deed_doc: Joi.string().allow(null, ""),

    // pvt ltd docs
    gst_doc: Joi.string().allow(null, ""),
    coi: Joi.string().allow(null, ""),
    board_resolution: Joi.string().allow(null, ""),
    share_holder: Joi.string().allow(null, ""),
    company_id: Joi.string().allow(null, ""),
});

const addAddressDetailsItems = Joi.object({
    dsa_id: Joi.string().allow(null, ""),
    postal_code: Joi.string()
        .pattern(pincode_regex)
        .message('Please enter a valid 6-digit postal code')
        .required()
        .messages({
            'string.empty': 'Postal Code is required',
            'any.required': 'Postal Code is required'
        }),

    house_number: Joi.string().required().messages({
        'string.empty': 'House Number is required',
        'any.required': 'House Number is required'
    }),
    area: Joi.string().required().messages({
        'string.empty': 'Area is required',
        'any.required': 'Area is required'
    }),
    city: Joi.string().required().messages({
        'string.empty': 'City is required',
        'any.required': 'City is required'
    }),
    state: Joi.string().required().messages({
        'string.empty': 'State is required',
        'any.required': 'State is required'
    }),
    country: Joi.string().required().messages({
        'string.empty': 'Country is required',
        'any.required': 'Country is required'
    }),
    type: Joi.string().valid("dsa", "company", "billing").required().messages({
        'string.empty': 'Address Type is required',
        'any.required': 'Address Type is required',
        'any.only': 'Address Type must be one of dsa, company, or billing'
    }),
    company_id: Joi.string().allow(null, ""),
});

exports.addAddressDetails = Joi.array().items(addAddressDetailsItems).required();

exports.switchBusinessMode = Joi.object({
    business_mode: Joi.string().valid("company", "individual").required().messages({
        'any.only': 'Business Mode must be either company or individual',
        'string.empty': 'Business Mode is required',
        'any.required': 'Business Mode is required'
    }),
    "dsa_id": Joi.string().allow(null, ""),
    "company_id": Joi.string().allow(null, ""),
});

exports.uploadDocumentsCentralized = Joi.object({
    "folder": Joi.string().valid("companyDocuments", "dsaDocuments").required(),
    "doc_name": Joi.string().valid("dsa_pan", "dsa_aadhar_front", "dsa_aadhar_back", "dsa_selfie", "gst_doc", "msme_doc", "pal_doc", "partnership_deed_doc", "board_resolution", "company_pan_image", "share_holder", "coi", "cheque_image").required(),
    "doc": Joi.allow(null, "")
});

exports.addDsaPhone = Joi.object({
    phone: Joi.string()
        .pattern(numeric_regex)
        .message('Phone number must contain only digits')
        .required()
        .messages({
            'string.empty': 'Phone number is required',
            'any.required': 'Phone number is required'
        }),

    otp: Joi.number().allow(null, ""),
});

exports.getDsaSteps = Joi.object({
    dsa_id: Joi.string().required(),
});

exports.getDsaAssigningPayoutPercentage = Joi.object({
    dsa_id: Joi.string().required(),
});

exports.getDsaAutonomousSettings = Joi.object({
    dsa_id: Joi.string().required(),
});

exports.getDsaSameDayBilling = Joi.object({
    dsa_id: Joi.string().required(),
});

exports.saveDsaAutonomousPaymentSettings = Joi.object({
    dsa_id: Joi.string().trim().required().messages({
        "string.empty": "DSA ID is required.",
        "any.required": "DSA ID is required.",
    }),
    autonomous_secured_payout: Joi.number()
        .min(0)
        .max(100)
        .allow(null)
        .empty("")
        .default(null)
        .messages({
            "number.base": "Autonomous secured payout must be a valid number.",
            "number.min": "Autonomous secured payout cannot be less than 0.",
            "number.max": "Autonomous secured payout cannot be greater than 100.",
        }),
    autonomous_unsecured_payout: Joi.number()
        .min(0)
        .max(100)
        .required()
        .messages({
            "number.base": "Autonomous unsecured payout must be a valid number.",
            "number.min": "Autonomous unsecured payout cannot be less than 0.",
            "number.max": "Autonomous unsecured payout cannot be greater than 100.",
            "any.required": "Autonomous unsecured payout is required.",
        }),
    global_autonomous_disb_date_from: Joi.string()
        .trim()
        .required()
        .custom((value, helpers) => {
            const m = moment(value, "YYYY-MM-DD", true);
            if (!m.isValid()) {
                return helpers.message(
                    "Autonomous start date must be a valid calendar date in YYYY-MM-DD format (e.g. 2026-03-23)."
                );
            }
            return value;
        })
        .messages({
            "string.empty": "Autonomous start date is required.",
            "any.required": "Autonomous start date is required.",
        }),
    global_autonomous_disb_date_to: Joi.string()
        .trim()
        .allow(null, "")
        .optional()
        .default(null)
        .custom((value, helpers) => {
            if (value === undefined || value === null || value === "") return null;
            const m = moment(value, "YYYY-MM-DD", true);
            if (!m.isValid()) {
                return helpers.message(
                    "Autonomous end date must be a valid calendar date in YYYY-MM-DD format (e.g. 2026-12-31)."
                );
            }
            return value;
        }),
    _isApprovalReplay: Joi.boolean().optional().allow(null),
})
    .custom((value, helpers) => {
        const { global_autonomous_disb_date_from, global_autonomous_disb_date_to } = value;
        if (global_autonomous_disb_date_from && global_autonomous_disb_date_to) {
            if (global_autonomous_disb_date_from > global_autonomous_disb_date_to) {
                return helpers.error("any.invalid", {
                    message: "Autonomous start date cannot be after autonomous end date",
                });
            }
        }
        return value;
    })
    .unknown(false)
    .messages({
        "any.invalid": "{{#message}}",
        "object.unknown": "The field {{#label}} is not allowed in this request.",
    });

/** Eligibility check — only the vendor id. Payouts/dates belong on save-settings. */
exports.requestAutonomousForVendor = Joi.object({
    dsa_id: Joi.string().trim().required().messages({
        "string.empty": "DSA ID is required.",
        "any.required": "DSA ID is required.",
    }),
    /**
     * Internal flag used by `/jobs/processors/approvalReplay.js` when replaying an approved request.
     * We must allow this field, otherwise Joi blocks replay with a 400.
     */
    _isApprovalReplay: Joi.boolean().optional().allow(null),
})
    .unknown(false)
    .messages({
        "object.unknown": "The field {{#label}} is not allowed in this request.",
    });

/** Raise approval request after eligibility check passes. Only creates a pending approval. */
exports.raiseAutonomousRequestForVendor = Joi.object({
    dsa_id: Joi.string().trim().required().messages({
        "string.empty": "DSA ID is required.",
        "any.required": "DSA ID is required.",
    }),
    approver_id: Joi.string().trim().required().messages({
        "string.empty": "Approver ID is required.",
        "any.required": "Approver ID is required.",
    }),
    autonomous_secured_payout: Joi.number()
        .min(0)
        .max(100)
        .allow(null)
        .empty("")
        .default(null)
        .messages({
            "number.base": "Autonomous secured payout must be a valid number.",
            "number.min": "Autonomous secured payout cannot be less than 0.",
            "number.max": "Autonomous secured payout cannot be greater than 100.",
        }),
    autonomous_unsecured_payout: Joi.number()
        .min(0)
        .max(100)
        .required()
        .messages({
            "number.base": "Autonomous unsecured payout must be a valid number.",
            "number.min": "Autonomous unsecured payout cannot be less than 0.",
            "number.max": "Autonomous unsecured payout cannot be greater than 100.",
            "any.required": "Autonomous unsecured payout is required.",
        }),
    global_autonomous_disb_date_from: Joi.string()
        .trim()
        .required()
        .custom((value, helpers) => {
            const m = moment(value, "YYYY-MM-DD", true);
            if (!m.isValid()) {
                return helpers.message(
                    "Autonomous start date must be a valid calendar date in YYYY-MM-DD format (e.g. 2026-03-23)."
                );
            }
            return value;
        })
        .messages({
            "string.empty": "Autonomous start date is required.",
            "any.required": "Autonomous start date is required.",
        }),
    global_autonomous_disb_date_to: Joi.string()
        .trim()
        .allow(null, "")
        .optional()
        .default(null)
        .custom((value, helpers) => {
            if (value === undefined || value === null || value === "") return null;
            const m = moment(value, "YYYY-MM-DD", true);
            if (!m.isValid()) {
                return helpers.message(
                    "Autonomous end date must be a valid calendar date in YYYY-MM-DD format (e.g. 2026-12-31)."
                );
            }
            return value;
        }),
})
    .custom((value, helpers) => {
        const { global_autonomous_disb_date_from, global_autonomous_disb_date_to } = value;
        if (global_autonomous_disb_date_from && global_autonomous_disb_date_to) {
            if (global_autonomous_disb_date_from > global_autonomous_disb_date_to) {
                return helpers.error("any.invalid", {
                    message: "Autonomous start date cannot be after autonomous end date",
                });
            }
        }
        return value;
    })
    .unknown(false)
    .messages({
        "any.invalid": "{{#message}}",
        "object.unknown": "The field {{#label}} is not allowed in this request.",
    });

/** Eligibility check — only the vendor id. Payouts/dates belong on save-settings. */
exports.requestAutonomousForVendor = Joi.object({
    dsa_id: Joi.string().trim().required().messages({
        "string.empty": "DSA ID is required.",
        "any.required": "DSA ID is required.",
    }),
    /**
     * Internal flag used by `/jobs/processors/approvalReplay.js` when replaying an approved request.
     * We must allow this field, otherwise Joi blocks replay with a 400.
     */
    _isApprovalReplay: Joi.boolean().optional().allow(null),
})
    .unknown(false)
    .messages({
        "object.unknown": "The field {{#label}} is not allowed in this request.",
    });

/** Raise approval request after eligibility check passes. Only creates a pending approval. */
exports.raiseAutonomousRequestForVendor = Joi.object({
    dsa_id: Joi.string().trim().required().messages({
        "string.empty": "DSA ID is required.",
        "any.required": "DSA ID is required.",
    }),
    approver_id: Joi.string().trim().required().messages({
        "string.empty": "Approver ID is required.",
        "any.required": "Approver ID is required.",
    }),
})
    .unknown(false)
    .messages({
        "object.unknown": "The field {{#label}} is not allowed in this request.",
    });

exports.disableDsaSameDayBilling = Joi.object({
    dsa_id: Joi.string().trim().required().messages({
        "string.empty": "DSA ID is required.",
        "any.required": "DSA ID is required.",
    }),
})
    .unknown(false)
    .messages({
        "object.unknown": "The field {{#label}} is not allowed in this request.",
    });

exports.updateGlobalPayoutPercentage = Joi.object({
    dsa_id: Joi.string().required(),
    global_payout_percentage: Joi.number().required()
});

exports.getBankProductMappedPayout = Joi.object({
    dsa_id: Joi.string().required(),
    product_id: Joi.string().required(),
    bank_id: Joi.string().required(),
    payout_type: Joi.string().optional().valid("rate", "ratio", null, ""),
    for_autonomous: Joi.boolean().optional().allow(null, "").default(false),
    is_company: Joi.boolean().optional().allow(null, "").default(false)
});

exports.getOwnedCompanyByPan = Joi.object({
    "pan": Joi.string()
        .pattern(company_pan_regex)
        .message('Please enter a valid Company PAN number (e.g., ABCDE1234F)')
        .required()
        .messages({
            'string.empty': 'Company PAN is required',
            'any.required': 'Company PAN is required'
        })
});

exports.getDsaPayoutList = filtersJoiObject.append({
    dsa_id: Joi.string(),
    bank_name_filter: Joi.string(),
    main_product_filter: Joi.string(),
    sub_product_filter: Joi.string(),
    search: Joi.string(),
    show_all: Joi.boolean().optional().allow(null, ""),
    bank_product_combinations_id: Joi.string().optional().allow(null, ""),
    login_code_filter: Joi.string().optional().allow(null, ""),
})

exports.AddBankDetailDsa = Joi.object({
    dsa_id: Joi.string().allow(null, ""),
    accountNumber: Joi.string().required().messages({ 'string.empty': 'Account Number is required', 'any.required': 'Account Number is required' }),
    bankName: Joi.string().required().messages({ 'string.empty': 'Bank Name is required', 'any.required': 'Bank Name is required' }),
    accountType: Joi.string().required().messages({ 'string.empty': 'Account Type is required', 'any.required': 'Account Type is required' }),
    ifsc: Joi.string().required().messages({ 'string.empty': 'IFSC Code is required', 'any.required': 'IFSC Code is required' }),
    accountHolderName: Joi.string().required().messages({ 'string.empty': 'Account Holder Name is required', 'any.required': 'Account Holder Name is required' }),
    user_type: Joi.string().required().messages({ 'string.empty': 'User Type is required', 'any.required': 'User Type is required' }),
    cheque_image: Joi.string().allow(null, ""),
});

exports.updateBankAccountType = Joi.object({
    id: Joi.number().integer().required().messages({
        'number.base': 'Bank account id must be a valid number',
        'any.required': 'Bank account id is required'
    }),
    bank_type: Joi.string().valid("Primary", "Secondary").required().messages({
        'any.only': 'Bank type must be either Primary or Secondary',
        'any.required': 'Bank type is required'
    }),
});

exports.getPendingBankVerificationList = Joi.object({
    pageNumber: Joi.number().integer().min(0).optional().default(0),
    pageSize: Joi.number().integer().min(1).max(5000).optional().default(10),
    filterModel: Joi.object().optional().allow(null),
    sortModel: Joi.array().optional().allow(null),
});

exports.updateBankAccountStatus = Joi.object({
    id: Joi.number().integer().required().messages({
        'number.base': 'Bank account id must be a valid number',
        'any.required': 'Bank account id is required'
    }),
    status: Joi.string().valid("approved", "rejected").required().messages({
        'any.only': 'Status must be either approved or rejected',
        'any.required': 'Status is required'
    }),
});

exports.getDsaEligiblePayoutDetails = Joi.object({
    loan_type: Joi.string().valid('personal_loan', 'business_loan').optional()
});

exports.instantClaimApplications = Joi.object({
    loan_type: Joi.string().valid('personal_loan', 'business_loan').required().messages({
        'any.only': 'Loan Type must be personal_loan or business_loan',
        'any.required': 'Loan Type is required'
    }),
    application_ids: Joi.array()
        .items(Joi.string().messages({
            'string.base': `Application IDs must be valid strings`
        }))
        .min(1)
        .required()
        .messages({
            'array.base': `Please select a valid list of applications`,
            'array.min': `Please select at least one application to claim`,
            'any.required': `Please select at least one application`
        })
});

exports.instantClaimAllEligibleApplication = Joi.object({
    loan_type: Joi.string().required()
});

exports.setLeadPayoutRateOrRatio = Joi.object({
    id: Joi.number().integer().required(),
    vendor_payout_rate: Joi.number().allow(null, ""),
    vendor_payout_ratio: Joi.number().allow(null, ""),
    is_exception: Joi.boolean().allow(null, ""),
    payout_type: Joi.string().required()
});

exports.updateDsaMasterPayout = Joi.object({
    bank_product_combinations_id: Joi.string().required(),
    dsa_id: Joi.string().required(),
    payoutLock: Joi.boolean().required().allow(0, 1),
    rate: Joi.number().allow(null, '').optional(),
    ratio: Joi.number().allow(null, '').optional(),
    default_payout_type: Joi.string().valid('rate', 'ratio').required(),
    is_autonomous_enabled: Joi.boolean().optional().default(false),
    autonomous_rate: Joi.number().min(0).max(100).allow(null, '').optional()
        .when('is_autonomous_enabled', {
            is: true,
            then: Joi.number().min(0).max(100).required().messages({
                'any.required': 'Autonomous rate is required when autonomous payment is enabled',
                'number.base': 'Autonomous rate must be a valid number',
            })
        }),
    autonomous_ratio: Joi.number().min(0).max(100).allow(null, '').optional()
        .when('is_autonomous_enabled', {
            is: true,
            then: Joi.number().min(0).max(100).required().messages({
                'any.required': 'Autonomous ratio is required when autonomous payment is enabled',
                'number.base': 'Autonomous ratio must be a valid number',
            })
        }),
    default_autonomous_payout_type: Joi.string().valid('rate', 'ratio').allow(null, '').optional()
        .when('is_autonomous_enabled', {
            is: true,
            then: Joi.string().valid('rate', 'ratio').required().messages({
                'any.required': 'Autonomous payout Type is required when autonomous payment is enabled',
                'number.base': 'Autonomous payout Type must be a valid number',
            })
        }),

    disb_date_from: Joi.string().trim().allow(null, '').optional()
        .custom((value, helpers) => {
            if (value === undefined || value === null || value === "") return null;
            const m = moment(value, "YYYY-MM-DD", true);
            if (!m.isValid()) {
                return helpers.message(
                    "Disbursement start date must be a valid calendar date in YYYY-MM-DD format (e.g. 2026-03-23)."
                );
            }
            const minStr = getMinimumAllowedAutonomousDisbDateFrom();
            if (value < minStr) {
                return helpers.message(
                    `Disbursement start date cannot be earlier than ${minStr}.`
                );
            }
            return value;
        })
        .when('is_autonomous_enabled', {
            is: true,
            then: Joi.string().trim().required().messages({
                'any.required': 'Disbursement date from is required when autonomous payment is enabled',
            })
        }),
    disb_date_to: Joi.string().trim().allow(null, '').optional()
        .custom((value, helpers) => {
            if (value === undefined || value === null || value === "") return null;
            const m = moment(value, "YYYY-MM-DD", true);
            if (!m.isValid()) {
                return helpers.message(
                    "Disbursement end date must be a valid calendar date in YYYY-MM-DD format (e.g. 2026-12-31)."
                );
            }
            return value;
        })
        .when('is_autonomous_enabled', {
            is: true,
            then: Joi.string().trim().allow(null, '').optional().messages({})
        }),
}).custom((value, helpers) => {
    const { is_autonomous_enabled, disb_date_from, disb_date_to } = value;
    if (is_autonomous_enabled && disb_date_from && disb_date_to) {
        if (disb_date_from > disb_date_to) {
            return helpers.error('any.invalid', { message: 'Disbursement date from cannot be after disbursement date to' });
        }
    }
    return value;
}).messages({
    'any.invalid': '{{#message}}'
});

exports.sendSetPayoutReminderEmail = Joi.object({
    loan_type: Joi.string().optional(),
    application_id: Joi.string().optional()
}).and('loan_type', 'application_id');

exports.getLedgerDetails = Joi.object({
    i_vendor_id: Joi.string().required(),
    Claim_month: Joi.string().optional().allow("", null),
    Page_index: Joi.number().required()
})
exports.getLedger = Joi.object({
    dsa_mobile_number: Joi.number().optional().allow(null, ""),
    cc_emails: Joi.string().allow(null, '').optional()
        .custom((value, helpers) => {
            if (!value || value.trim() === '') {
                return value;
            }
            const emails = value.split(',').map(email => email.trim()).filter(email => email.length > 0);
            const emailSet = new Set();
            const duplicates = [];

            for (const email of emails) {
                const emailLower = email.toLowerCase();
                if (emailSet.has(emailLower)) {
                    duplicates.push(email);
                } else {
                    emailSet.add(emailLower);
                }
            }

            if (duplicates.length > 0) {
                return helpers.error('string.duplicateEmails', {
                    duplicates: duplicates.join(', ')
                });
            }

            const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            for (const email of emails) {
                if (!basicEmailRegex.test(email)) {
                    return helpers.error('string.invalidEmailFormat');
                }

                const domainPart = email.split('@')[1];
                if (!domainPart) {
                    return helpers.error('string.invalidEmailFormat');
                }

                const domainLabels = domainPart.split('.');
                for (const label of domainLabels) {
                    if (label.length === 0) {
                        return helpers.error('string.invalidEmailFormat');
                    }
                    if (label.startsWith('-') || label.endsWith('-')) {
                        return helpers.error('string.invalidEmailFormat');
                    }
                    if (!/[a-zA-Z0-9]/.test(label)) {
                        return helpers.error('string.invalidEmailFormat');
                    }
                }
            }

            return value;
        })
        .messages({
            'string.invalidEmailFormat': 'Please enter valid email addresses',
            'string.duplicateEmails': 'Duplicate email addresses found. Please remove duplicates'
        }),
    claim_month: Joi.string().optional().allow("", null),
    is_company: Joi.boolean().optional().allow(null, ""),
    company_id: Joi.string().when('is_company', {
        is: true,
        then: Joi.string().required(),
        otherwise: Joi.string().optional().allow(null, "")
    })
})
exports.saveDsaPayoutDeal = Joi.object({
    deal: Joi.string().optional().allow(null, ""),
    utm_main_source: Joi.string().required().messages({
        'string.empty': 'UTM Main Source is required',
        'any.required': 'UTM Main Source is required'
    }),
    payout_capping: Joi.number().min(1).max(100).when('utm_main_source', {
        is: 'crm',
        then: Joi.optional(),
        otherwise: Joi.required().messages({
            'any.required': 'Payout Capping is required',
            'number.min': 'Payout Capping must be at least 1',
            'number.max': 'Payout Capping must be at most 100'
        })
    }),
    bank_ids: Joi.array().optional(),
    product_ids: Joi.array().optional(),
    referral_dsa_id: Joi.string().required().messages({
        'string.empty': 'Referral DSA ID is required',
        'any.required': 'Referral DSA ID is required'
    }),
    select_all_banks: Joi.boolean().optional().allow(null, ""),
    select_all_products: Joi.boolean().optional().allow(null, ""),
});
exports.getDsaDealDescription = Joi.object({
    dsa_id: Joi.string().required()
});

/** @deprecated Discarded — do not extend. Prefer `saveDsaAutonomousPaymentSettings` and future replacements for same-day billing flags. Kept only for legacy clients. */
exports.saveDsaDiscountDetails = Joi.object({
    dsa_id: Joi.string().required().messages({
        'string.empty': 'DSA ID is required',
        'any.required': 'DSA ID is required'
    }),
    is_same_day_billing_enabled: Joi.boolean().required().allow(0, 1).messages({
        'any.required': 'Same day billing setting is required'
    })
});

exports.saveMouAgreement = Joi.object({
    dsa_id: Joi.string().allow(null, "").optional(),
    mou_filename: Joi.string().required().messages({
        'string.empty': 'MOU filename is required',
        'any.required': 'MOU filename is required'
    }),
    mou_signature_image_filename: Joi.string().required().messages({
        'string.empty': 'Signature image is required',
        'any.required': 'Signature image is required'
    }),
    company_id: Joi.string().allow(null, "").optional(),
    company_mou_filename: Joi.string().allow(null, "").optional(),
    consent_type: Joi.string().optional().default("mou_agreement"),
    description: Joi.string().optional(),
    ip: Joi.string().allow(null, "").optional()
});