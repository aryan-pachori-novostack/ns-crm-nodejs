let Joi = require("joi");

const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const msmeRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
let pan_regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
let personal_pan_regex = /^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/;
let pincode_regex = /^[1-9][0-9]{5}$/;
let adhaar_regex = /^[2-9]{1}[0-9]{11}$/;
let phone_regex = /^[6-9]\d{9}$/;
let company_pan_regex = /^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$/;
let string_regex = /^[A-Za-z\s]+$/;
let numeric_regex = /^\d+$/;

exports.addDsaBasicDetails = Joi.object({
    "company_pan": Joi.string()
        .pattern(company_pan_regex)
        .message('Invalid company PAN number format')
        .allow(null, ''),

    "partner_code": Joi.string()
        .pattern(phone_regex)
        .message('Invalid mobile partner code')
        .required(),

    "role_in_company": Joi.string().allow(null, ''),
    "profession": Joi.string().allow(null, ''),
    "company_pan_image": Joi.string().allow(null, ""),

    "first_name": Joi.string()
        .pattern(string_regex)
        .message('First Name should contains alphabets only')
        .required(),

    "middle_name": Joi.string()
        .pattern(string_regex)
        .message('Middle Name should contains alphabets only')
        .allow(null, ""),

    "last_name": Joi.string()
        .pattern(string_regex)
        .message('Last Name should contains alphabets only')
        .required(),

    "email": Joi.string().email().required()
        .messages({
            'string.empty': 'Email is required',
            'string.email': 'Please enter a valid email address',
            'any.required': 'Email is required',
        }),
    "gender": Joi.string().valid("male", "female", "others").required(),
    "dob": Joi.string().required(),
    "dsa_id": Joi.string().allow(null, ""),
    "type": Joi.string().allow(null, ""),
    "business_type": Joi.string().allow(null, ""),
    "company_name": Joi.string().allow(null, ""),
});

exports.addDsaKyc = Joi.object({
    "dsa_id": Joi.string().allow(null, ""),
    "pan_number": Joi.string()
        .pattern(personal_pan_regex)
        .message('Invalid Personal PAN format')
        .required(),

    "aadhar_number": Joi.string()
        .pattern(adhaar_regex)
        .message('Invalid Aadhaar number format')
        .required(),

    "pan": Joi.string().required(),
    "aadhar_front": Joi.string().required(),
    "aadhar_back": Joi.string().required(),
    "selfie": Joi.string().required(),
});

exports.addCompanyDetails = Joi.object({
    "dsa_id": Joi.string().allow(null, ""),
    phone: Joi.string()
        .pattern(phone_regex)
        .message('Invalid mobile')
        .allow(null, ""),

    // pan_number: Joi.string()
    //     .pattern(pan_regex)
    //     .message('Invalid PAN number format')
    //     .required(),

    gstin: Joi.string()
        .pattern(gstRegex)
        .allow(null, "")
        .messages({
            'string.pattern.base': 'GST number format is invalid',
            'string.empty': 'GST number is required'
        }),

    msme_no: Joi.string()
        .pattern(msmeRegex)
        .allow(null, "")
        .messages({
            'string.pattern.base': 'MSME/Udyam number format is invalid',
            'string.empty': 'MSME/Udyam number is required'
        }),

    short_name: Joi.string().allow(null, ""),
    date_of_incorp: Joi.string().required(),
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
        .message('Invalid postal code format')
        .required(),

    house_number: Joi.string().required(),
    area: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    type: Joi.string().valid("dsa", "company", "billing").required(),
    company_id: Joi.string().allow(null, ""),
});

exports.addAddressDetails = Joi.array().items(addAddressDetailsItems).required();

exports.switchBusinessMode = Joi.object({
    business_mode: Joi.string().valid("company", "individual").required(),
    "dsa_id": Joi.string().allow(null, ""),
});

exports.uploadDocumentsCentralized = Joi.object({
    "folder": Joi.string().valid("companyDocuments", "dsaDocuments").required(),
    "doc_name": Joi.string().valid("dsa_pan", "dsa_aadhar_front", "dsa_aadhar_back", "dsa_selfie", "gst_doc", "msme_doc", "pal_doc", "partnership_deed_doc", "board_resolution", "company_pan_image", "share_holder", "coi", "cheque_image").required(),
    "doc": Joi.allow(null, "")
});

exports.addDsaPhone = Joi.object({
    phone: Joi.string()
        .pattern(phone_regex)
        .message('Invalid mobile number format')
        .required(),

    otp: Joi.number().allow(null, ""),
});

exports.getDsaSteps = Joi.object({
    dsa_id: Joi.string().required(),
});

exports.getOwnedCompanyByPan = Joi.object({
    "pan": Joi.string()
        .pattern(company_pan_regex)
        .message('Invalid company PAN number format')
        .required()
});

exports.getRuloansCustomers = Joi.object({
    pageNumber: Joi.number().default(0),
    pageSize: Joi.number().default(100),
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
    call_status: Joi.number().allow(null, ''),
    call_created_order: Joi.string().allow(null, ''),
    forChannelManager: Joi.boolean().allow(null, ''),
    previous_partner_name_col: Joi.alternatives().try(
        Joi.number().valid(0, 1),
        Joi.string().valid("").allow(null)
    ),
    partnerNameFilter: Joi.string().allow(null, ''),
    old_new_dsa: Joi.number().valid(0, 1).optional(),
    old_new_dsa_filter: Joi.string().valid("New", "Old").insensitive().allow(null, ''),
    creditCardSubmited: Joi.number().allow(null, ''),
    loanSubmited: Joi.number().allow(null, ''),
    lntLoanSubmitted: Joi.number().allow(null, ''),
    allow_duplicates: Joi.boolean().allow(null, ''),
    assignDateStartFilter: Joi.string().allow(null, ''),
    assignDateEndFilter: Joi.string().allow(null, ''),
    query: Joi.string().allow(null, ''),
    user_type: Joi.string().allow(null, ''),
    userFilter: Joi.string().pattern(/^[0-9]+$/).allow(null, ""),
    joiningDateStartFilter: Joi.string().allow(null, ''),
    joiningDateEndFilter: Joi.string().allow(null, ''),
    statusUpdateDateStartFilter: Joi.string().allow(null, ''),
    statusUpdateDateEndFilter: Joi.string().allow(null, ''),
    callPendingStartFilter: Joi.string().allow(null, ''),
    callPendingEndFilter: Joi.string().allow(null, ''),
    signUpStepsFiltersStart: Joi.number().allow(null),
    signUpStepsFiltersEnd: Joi.number().allow(null),
});