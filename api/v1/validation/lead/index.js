let Joi = require("joi");
const { join } = require("path");
const { Sequelize } = require("../../../../models");
const { filtersJoiObject } = require("../../../helpers/commonhelper");

const create = Joi.object({
  mobile: Joi.string().required(),
  prefix: Joi.string().allow(null, ""),
  user_fname: Joi.string().required(),
  user_mname: Joi.string().allow("", null),
  user_lname: Joi.string().required(),
  email: Joi.string().required(),
  source: Joi.string().allow(null, ""),
  lead_source: Joi.number().allow(null, ""),
  status: Joi.number().allow(null, ""),
  assigned_to: Joi.string().required().allow(null, ''),
  pan: Joi.string().required(),
  is_fresh_lead: Joi.boolean().allow(null, ""),
  profession: Joi.number().allow(null, ""),
  category: Joi.number().allow(null, ""),
  alt_mobile: Joi.string().allow(null, ""),
  channel_manager: Joi.string().required(),
  potential: Joi.number().allow(null, ""),
  dob: Joi.string().required(),
  lead_type: Joi.number().allow(null, ""),
  payout_percentage: Joi.number().required(),
  has_done_loan_buisness: Joi.boolean(),
  year_loan_buisness: Joi.number().allow(null, ""),
  has_coonector_code: Joi.boolean().allow(null, ""),
  has_reapplied: Joi.boolean().allow(null, ""),
  secondary_email: Joi.string().allow(""),
  address_home: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    pincode: Joi.string().required()
  }).required(),
  address_buisness: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    pincode: Joi.string().required(),
  }).required(),
});

const createPan = Joi.object({
  isUpdated: Joi.boolean().allow(),
  step: Joi.number().required(),
  mobile: Joi.number().required(),
  pan: Joi.string().allow(null, ""),
  email: Joi.string().required(),
  leadId: Joi.string().allow(""),
  prefix: Joi.number().allow(null, ""),
  user_fname: Joi.string().required(),
  user_mname: Joi.string().allow(null, ""),
  user_lname: Joi.string().required(),
});

const createLead = Joi.object({
  isUpdated: Joi.boolean().required(),
  leadId: Joi.string().required(),
  step: Joi.number().required(),
  potential: Joi.number().allow("", null),
  lead_source: Joi.number().allow("", null),
  status: Joi.number().required(),
  sub_status: Joi.number().allow(null, ""),
  assigned_to: Joi.string().required(),
  channel_manager: Joi.string().allow("", null),
  profession: Joi.number().allow("", null),
  category: Joi.number().allow("", null),
  alt_mobile: Joi.string().allow("", null),
  dob: Joi.string().allow("", null),
  lead_type: Joi.number().allow("", null),
});

const createAddress = Joi.object({
  isUpdated: Joi.boolean().required(),
  leadId: Joi.string().required(),
  step: Joi.number().required(),
  address_home: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    pincode: Joi.string().required()
  }).required(),
  address_buisness: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    pincode: Joi.string().required(),
  }).required(),
});

const createCustomInformation = Joi.object({
  // id, lead_id, has_done_loan_buisness, year_loan_buisness, has_coonector_code, has_reapplied, secondary_email, loan_type, have_office, is_office_rented, number_of_staff, heard_of_ruloans, where_you_heard, monthly_disbursement, purpose_of_joining, bank_leave_duration, previous_loan_type, previous_bank_verticle,
  isUpdated: Joi.boolean().required(),
  leadId: Joi.string().required(),
  step: Joi.number().required(),
  has_done_loan_buisness: Joi.boolean().allow("", null),
  year_loan_buisness: Joi.number().allow("", null),
  has_coonector_code: Joi.boolean().allow("", null),
  secondary_email: Joi.string().allow("", null),
  loan_type: Joi.string().allow("", null),
  have_office: Joi.boolean().allow("", null),
  is_office_rented: Joi.boolean().allow("", null),
  number_of_staff: Joi.number().allow("", null),
  heard_of_ruloans: Joi.boolean().allow("", null),
  where_you_heard: Joi.string().allow("", null),
  monthly_disbursement: Joi.number().allow("", null),
  purpose_of_joining: Joi.string().allow("", null),
  bank_leave_duration: Joi.number().allow("", null),
  previous_bank_verticle: Joi.number().allow("", null),
  previous_bank_department: Joi.number().allow("", null),
  previous_loan_type: Joi.number().allow("", null),
  has_reapplied: Joi.boolean().allow("", null),
});

const createPayoutInformation = Joi.object({
  // current_payout_pl, current_payout_bl, current_payout_hl, current_payout_lap, current_payout_ncl, current_payout_car_refinance, current_payout_od_cc, current_payout_gl, current_payout_project_loan, current_payout_el, current_payout_msme_loan,   
  isUpdated: Joi.boolean().required(),
  leadId: Joi.string().required(),
  step: Joi.number().required(),
  current_payout_pl: Joi.string().allow(null, ""),
  current_payout_bl: Joi.string().allow(null, ""),
  current_payout_hl: Joi.string().allow(null, ""),
  current_payout_lap: Joi.string().allow(null, ""),
  current_payout_ncl: Joi.string().allow(null, ""),
  current_payout_ucl: Joi.string().allow(null, ""),
  current_payout_car_refinance: Joi.string().allow(null, ""),
  current_payout_od_cc: Joi.string().allow(null, ""),
  current_payout_gl: Joi.string().allow(null, ""),
  current_payout_project_loan: Joi.string().allow(null, ""),
  current_payout_el: Joi.string().allow(null, ""),
  current_payout_msme_loan: Joi.string().allow(null, ""),
  current_payout_working_loan: Joi.string().allow(null, ""),
  payout_percentage: Joi.number().allow(null, ""),
});

const createCrmUser = Joi.object({
  // is_crm_user
  isUpdated: Joi.boolean().allow(),
  leadId: Joi.string(),
  step: Joi.number().required(),
  is_crm_user: Joi.boolean().required(),
});

const deleteLead = Joi.object({
  id: Joi.string().required()
})

const createExternalPan = Joi.object({
  leadId: Joi.string().required(),
  step: Joi.number().required(),
  mobile: Joi.number().required(),
  pan: Joi.string().required(),
  email: Joi.string().required(),
  user_fname: Joi.string().required(),
  user_mname: Joi.string().allow(null, ""),
  user_lname: Joi.string().required(),
  profession: Joi.string().required(), //additional information
  utm_source: Joi.string().required(),
  utm_campaign: Joi.string().required(),
  utm_medium: Joi.string().required(),
  utm_content: Joi.string().required(),
  utm_term: Joi.string().required(),

});

const createExternalLead = Joi.object({
  leadId: Joi.string().required(),
  step: Joi.number().required(),
  have_office: Joi.boolean().allow(null, ""),
  year_loan_buisness: Joi.number().allow(null, ""),
  file_process_method: Joi.string().allow(null, ""),
  file_process_with_whom: Joi.string().allow(null, ""),
  previous_bank_verticle: Joi.string().allow(null, ""),
  previous_bank_department: Joi.string().allow(null, ""),
})

const update = Joi.object({
  id: Joi.string().required(),
  mobile: Joi.string().required(),
  prefix: Joi.string().allow(null, ""),
  user_fname: Joi.string().required(),
  user_mname: Joi.string().allow("", null),
  user_lname: Joi.string().required(),
  email: Joi.string().required(),
  source: Joi.string().allow(null, ""),
  lead_source: Joi.number().allow(null, ""),
  status: Joi.number().allow(null, ""),
  assigned_to: Joi.string().required(),
  pan: Joi.string().required(),
  is_fresh_lead: Joi.boolean().allow(null, ""),
  profession: Joi.number().allow(null, ""),
  category: Joi.number().allow(null, ""),
  alt_mobile: Joi.string().allow(null, ""),
  channel_manager: Joi.string().required(),
  potential: Joi.number().allow(null, ""),
  dob: Joi.string().required(),
  lead_type: Joi.number().allow(null, ""),
  payout_percentage: Joi.number().required(),
  has_done_loan_buisness: Joi.boolean(),
  year_loan_buisness: Joi.number().allow(null, ""),
  has_coonector_code: Joi.boolean().allow(null, ""),
  has_reapplied: Joi.boolean().allow(null, ""),
  secondary_email: Joi.string().allow(null, ""),
  address_home: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    pincode: Joi.string().required()
  }).required(),
  address_buisness: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    pincode: Joi.string().required(),
  }),
});

const lead = Joi.object({
  id: Joi.string().required()
});

const updateAssignee = Joi.object({
  leadId: Joi.string().allow(null, ""),
  assignTo: Joi.string().required(),
  leadIdArray: Joi.array().allow(null, ""),
});

const leads = Joi.object({
  pageNumber: Joi.number().allow(null, ""),
  pageSize: Joi.number().allow(null, ""),
  startDateFilter: Joi.string().allow(null, ''),
  endDateFilter: Joi.string().allow(null, ''),
  user_fname: Joi.string().allow(null, ''),
  user_mname: Joi.string().allow(null, ''),
  user_lname: Joi.string().allow(null, ''),
  email: Joi.string().allow(null, ''),
  assigned_to: Joi.string().allow(null, ''),
  channel_manager: Joi.string().allow(null, ''),
  is_fresh_lead: Joi.boolean().allow(null, ''),
  mobile: Joi.string().allow(null, ''),
  pan: Joi.string().allow(null, ''),
  lead_type: Joi.string().allow(null, ''),
  lead_source: Joi.string().allow(null, ''),
  status: Joi.string().allow(null, ''),
  utm_campaign: Joi.string().allow(null, ''),
  utm_term: Joi.string().allow(null, ''),
  utm_content: Joi.string().allow(null, ''),
  utm_medium: Joi.string().allow(null, ''),
  assignDateStartFilter: Joi.string().allow(null, ''),
  assignDateEndFilter: Joi.string().allow(null, ''),
  assigned_to_name: Joi.string().allow(null, ''),
  state: Joi.string().allow(null, ''),
  city: Joi.string().allow(null, ''),
  profession: Joi.string().allow(null, ''),
  is_export: Joi.boolean().allow(null, '')
});

const followLead = Joi.object({
  leadId: Joi.string().required(),
  userId: Joi.string().required()
})

const getStaredLeadForUser = Joi.object({
  userId: Joi.string().required()
})

const getLeadPayouts = Joi.object({
  pageNumber: Joi.number().allow(null, ""),
  pageSize: Joi.number().allow(null, ""),
  leadId: Joi.string().allow(null, ""),
  phone: Joi.string().allow(null, ""),
  search: Joi.string().allow(null, ""),
  bank_name_filter: Joi.string().allow(null, ""),
  main_product_filter: Joi.string().allow(null, ""),
  sub_product_filter: Joi.string().allow(null, ""),
  payout_percentage_lead_filter: Joi.string().allow(null, ""),
  ratio_filter: Joi.string().allow(null, ""),
})

const downloadLeadList = Joi.object({
  pageNumber: Joi.number().allow(null, ""),
  pageSize: Joi.number().allow(null)
})


const updateLeadPayout = Joi.object({
  id: Joi.string().required().pattern(/^[0-9]+$/),
  payout_percentage: Joi.number().min(0).max(100).required(),
  payoutLock: Joi.boolean().required()
})

const getLeadReport = Joi.object({
  startDateFilter: Joi.string().required(),
  endDateFilter: Joi.string().required(),
  pageNumber: Joi.number().allow(null, ""),
  pageSize: Joi.number().allow(null, ""),
  type: Joi.string().allow("channle_partners", "leads"),
});

const getLeadFormDetailsById = Joi.object({
  id: Joi.string().required()
});

const getLeadFormRemarks = Joi.object({
  id: Joi.string().required()
});

const updateLeadFormRemark = Joi.object({
  id: Joi.string().required(),
  remark_type: Joi.string().valid('vendor_remark', 'user_remark', 'reject_reason', 'claim_confirmation', 'audit_remark', 'claim_confirmation_remark').required(),
  value: Joi.string().allow(null, '')
});

const getLeadForms = Joi.object({
  pageNumber: Joi.number().allow(null, ""),
  pageSize: Joi.number().allow(null, ""),
  filterModel: Joi.object().unknown(true).allow(null),
  sortBy: Joi.string().allow(null, ""),
  sortDirection: Joi.string().allow(null, ""),
  logicOperator: Joi.string().allow(null, ""),
  status: Joi.valid(13, 0, 1, 3, "approved", "wip", "not_found", "error", "claim_pending", "", null, "multi_funded_pending", "multi_funded_confirmed", "consolidated", "payout_pending", "claimed_instant_claim", "unclaimed_instant_claim", "instant_claim", "banker_pending", "banker_confirmed", "banker_partial_match", "banker_failed", "banker_processed", "banker_on_hold", "banker_consolidated_ai_status"),
  fresh_lead_id: Joi.array().allow(null, ""),
  search: Joi.string().allow(null, ""),
  createdDateStartFilter: Joi.string().allow(null, ""),
  createdDateEndFilter: Joi.string().allow(null, ""),
  claim_month_filter: Joi.string().allow(null, ""),
  loan_reference_id_filter: Joi.string().allow(null, ""),
  loan_apac_ref_los_number_filter: Joi.string().allow(null, ""),
  customer_full_name_filter: Joi.string().allow(null, ""),
  disbursement_date_iso_filter: Joi.string().allow(null, ""),
  disbursement_amount_filter: Joi.string().allow(null, ""),
  bank_name_filter: Joi.string().allow(null, ""),
  product_name_filter: Joi.string().allow(null, ""),
  vendor_payout_rate_filter: Joi.string().allow(null, ""),
  vendor_payout_ratio_filter: Joi.string().allow(null, ""),
  vendor_payout_amount_filter: Joi.string().allow(null, ""),
  /* pf_collected_filter: Joi.string().allow(null, ""),
  loan_type_filter: Joi.string().allow(null, ""),
  payout_collide_filter: Joi.string().allow(null, ""), */
  dsa_name_filter: Joi.string().allow(null, ""),
  /* city_filter: Joi.string().allow(null, ""),
  customer_company_name_filter: Joi.string().allow(null, ""),
  fresh_lead_id_filter: Joi.string().allow(null, ""), */
  upload_file_name_filter: Joi.string().allow(null, ""),
  updatedDateStartFilter: Joi.string().allow(null, ""),
  updatedDateEndFilter: Joi.string().allow(null, ""),
  /* requestDateStartFilter: Joi.string().allow(null, ""),
  requestDateEndFilter: Joi.string().allow(null, ""), */
  vendor_payout_type_filter: Joi.string().allow(null, ""),
  /* created_by_filter: Joi.string().allow(null, ""), */
  is_split_case_filter: Joi.string().allow(null, ""),
  /* loan_status_filter: Joi.string().allow(null, ""), */
  reject_reason_filter: Joi.string().allow(null, ""),
  only_disbursed: Joi.boolean().allow(null, ""),
  netsuite_vendor_id_filter: Joi.string().allow(null, ""),
  platform_filter: Joi.string().allow(null, ""),
  form_type_filter: Joi.string().allow(null, ""),
  sort_order: Joi.string().allow(null, ""),
  sort_field: Joi.string().allow(null, ""),
  /* netsuite_bank_id: Joi.string().allow(null, ""),
  netsuite_product_id: Joi.string().allow(null, ""), */
  /* remark_filter: Joi.string().allow(null, ""), */
  user_remark_filter: Joi.string().allow(null, ""),
  /* customer_pan_filter: Joi.string().allow(null, ""), */
  dsa_pan_filter: Joi.string().allow(null, ""),
  is_export: Joi.boolean().allow(null, ""),
  export_title: Joi.string().allow(null, ""),
  moduleName: Joi.string().allow(null, ""),
  /* bh_name_filter: Joi.string().allow(null, ""), */
  dsa_mobile_filter: Joi.string().allow(null, ""),
  near_by_search: Joi.boolean().allow(null, ""),
  dsa_mobile_number: Joi.string().allow(null, ""),
  business_category_filter: Joi.string().allow(null, ""),
  current_hierarchy_crm_filter: Joi.string().allow(null, ""),
  /* class_id_filter: Joi.string().allow(null, ""),
  partner_name_filter: Joi.string().allow(null, ""),
  ns_contest_id_filter: Joi.number().allow(null, ""), */
  current_hierarchy_path_filter: Joi.string().allow(null, ""),
  is_tentative_matched_filter: Joi.boolean().allow(null, ""),
  bank_file_matched_filter: Joi.boolean().allow(null, ""),
  is_same_day_billing_enabled_filter: Joi.boolean().allow(null, ""),
  /* is_online_lead_filter: Joi.boolean().allow(null, ""), */
  ai_status_filter: Joi.string().allow(null, ""),
  count_only: Joi.boolean().allow(null, ""),
  data_only: Joi.boolean().allow(null, ""),
  fresh_lead_id_filter: Joi.string().allow(null, "")
});

const sendLeadFormToErp = Joi.object({
  isSelectAll: Joi.boolean().required(),
  id: Joi.array().required(),
  skipVerification: Joi.boolean().optional(),
  /** When true, skips partner email format / OTP verification checks before PAN/ERP. */
  skipEmailVerification: Joi.boolean().optional(),
  /** Lead IDs that skip partner email verification but still proceed to PAN/ERP on this run. */
  skipEmailCheckLeadIds: Joi.array().items(Joi.string().uuid()).optional(),
});

const verifyPanViaAuthBridgeV2 = Joi.object({
  fresh_lead_id: Joi.string().required(),
  force_retry: Joi.boolean().optional(),
});

const pushDSAToNS = Joi.object({
  dsa_id: Joi.string().required(),
  user_type: Joi.string().allow(null, ""),
});

const getProductOrBankDropdown = Joi.object({
  type: Joi.string().required(),
  bank_id: Joi.string().allow(null, ""),
  product_id: Joi.string().allow(null, ""),
  pageSize: Joi.number().allow(null, ""),
  pageNumber: Joi.number().allow(null, ""),
  search: Joi.string().allow(null, ""),
  active_only: Joi.alternatives().try(
    Joi.number().valid(0, 1),
    Joi.string().valid("0", "1")
  ).optional().allow(null, ""),
});

const getNetsuiteBankList = filtersJoiObject.append({
  netsuite_bank_id_filter: Joi.string().allow(null, ""),
  bank_name_filter: Joi.string().allow(null, ""),
  startDateFilter: Joi.string().allow(null, ""),
  endDateFilter: Joi.string().allow(null, ""),
  bank_id: Joi.string().allow(null, ""),
  status_filter: Joi.string().allow(null, "")
});

/** Export Netsuite Banks — same filter contract as getNetsuiteBankList. Empty body = active only. */
const exportNetsuiteBankList = filtersJoiObject.append({
  netsuite_bank_id_filter: Joi.string().allow(null, ""),
  bank_name_filter: Joi.string().allow(null, ""),
  startDateFilter: Joi.string().allow(null, ""),
  endDateFilter: Joi.string().allow(null, ""),
  bank_id: Joi.string().allow(null, ""),
  status_filter: Joi.string().allow(null, ""),
});

const getNetsuiteProductList = filtersJoiObject.append({
  netsuite_product_id_filter: Joi.string().allow(null, ""),
  product_name_filter: Joi.string().allow(null, ""),
  main_product_filter: Joi.string().allow(null, ""),
  short_name_filter: Joi.string().allow(null, ""),
  remarks_filter: Joi.string().allow(null, ""),
  category_filter: Joi.string().allow(null, ""),
  status_filter: Joi.string().allow(null, ""),
  startDateFilter: Joi.string().allow(null, ""),
  endDateFilter: Joi.string().allow(null, ""),
  edit_product_id: Joi.string().allow(null, ""),
});

const createOrUpdateNetsuiteProduct = Joi.object({
  product_id: Joi.string().allow(null, ""),
  netsuite_product_id: Joi.string().required(),
  product_name: Joi.string().required(),
  main_product: Joi.string().allow(null, ""),
  short_name: Joi.string().allow(null, ""),
  remarks: Joi.string().allow(null, ""),
  category: Joi.string().allow(null, ""),
  status: Joi.string().required().valid("0", "1"),
  parent_product_id: Joi.number().allow(null, ""),
  parent_product_name: Joi.string().allow(null, "")
});

const setBankFileOnVcf = Joi.object({
  vendor_claimfile_internalid: Joi.string().required(),
  bank_id: Joi.number().required(),
  fresh_lead_id: Joi.string().required(),
});

const getLeadFormReference = Joi.object({
  fresh_lead_id: Joi.string().required()
});

const downloadLeadPayout = Joi.object({
  dsa_mobile_number: Joi.string().required()
})

const getDsaPayoutExternal = Joi.object({
  pageNumber: Joi.number().required(),
  pageSize: Joi.number().required(),
  bank_name_filter: Joi.string().allow(null, ''),
  main_product_filter: Joi.string().allow(null, ''),
  payout_percentage_filter: Joi.number().allow(null),
  payout_ratio_filter: Joi.number().allow(null),
  sub_product_filter: Joi.string().allow(null, ''),
  product_filter: Joi.string().allow(null, ''),
  login_code_filter: Joi.string().allow(null, ''),
})

const getAllBankProductCombination = filtersJoiObject.append({
  netsuite_product_id_filter: Joi.string().allow(null, ""),
  product_name_filter: Joi.string().allow(null, ""),
  main_product_filter: Joi.string().allow(null, ""),
  short_name_filter: Joi.string().allow(null, ""),
  remarks_filter: Joi.string().allow(null, ""),
  category_filter: Joi.string().allow(null, ""),
  status_filter: Joi.string().allow(null, ""),
  netsuite_bank_id_filter: Joi.string().allow(null, ""),
  bank_name_filter: Joi.string().allow(null, ""),
  search: Joi.string().allow(null, ""),
  id: Joi.number().allow(null, ""),
  login_code_filter: Joi.string().allow(null, ""),
  avg_achievment_filter: Joi.string().allow(null, ""),
  autonomous_payout_capping_filter: Joi.string().allow(null, ""),
  count_only: Joi.boolean().allow(null, ""),
})

const editBusinessCategory = Joi.object({
  fresh_lead_id: Joi.string().required(),
  new_business_category: Joi.string().required()
})

const updateLeadFormAutonomousStatus = Joi.object({
  fresh_lead_id: Joi.string().required(),
  same_day_billing: Joi.boolean().required(),
  to_be_billed: Joi.boolean().required().when('same_day_billing', {
    is: true,
    then: Joi.boolean().valid(true).required(),
    otherwise: Joi.boolean().required()
  }),
  payout_type: Joi.string().trim().lowercase().valid('rate', 'ratio').required(),
  rate: Joi.when('payout_type', {
    is: 'rate',
    then: Joi.number().required().min(0).max(100),
    otherwise: Joi.valid(null).optional()
  }),
  ratio: Joi.when('payout_type', {
    is: 'ratio',
    then: Joi.number().required().min(0),
    otherwise: Joi.valid(null).optional()
  })
})

const getLeadPayoutDefaults = Joi.object({
  dsa_id: Joi.string().required(),
  bank_id: Joi.number().optional(),
  product_id: Joi.number().optional(),
  bank_product_combinations_id: Joi.string().optional(),
  for_autonomous: Joi.boolean().default(false)
})
  // Either bank_product_combinations_id OR (bank_id + product_id) must be provided
  .or('bank_product_combinations_id', 'bank_id')
  .and('bank_id', 'product_id');

const updateTentativeBankFileMatch = Joi.object({
  fresh_lead_id: Joi.string().required(),
  bank_file_id: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  is_tentative_file_matched: Joi.boolean().required(),
  match_type: Joi.string().valid('main', 'tentative').default('tentative')
});

const getReconciliationMail = Joi.object({
  fresh_lead_id: Joi.string().required()
});

const getReconciliationMailTrail = Joi.object({
  fresh_lead_id: Joi.string().required()
});

const getMailTrailFromMailbox = Joi.object({
  fresh_lead_id: Joi.string().required()
});

const saveMailTrailFromMailbox = Joi.object({
  fresh_lead_id: Joi.string().required()
});

const downloadLatestMailTrailEml = Joi.object({
  fresh_lead_id: Joi.string().required()
});

const getLeadMailThreadReplyOptions = Joi.object({
  fresh_lead_id: Joi.string().required()
});

const replyMailThread = Joi.object({
  fresh_lead_id: Joi.string().required(),
  to: Joi.string().allow('', null).optional(),
  cc: Joi.string().allow('', null).optional(),
  subject: Joi.string().allow('', null).optional(),
  html: Joi.string().required()
});

const setLeadOnHold = Joi.object({
  fresh_lead_id: Joi.string().required(),
  vendor_remark: Joi.string().allow(null, '')
});

const listDsaLeads = Joi.object({
  bucket: Joi.string().allow('', null).optional(),
  pageNumber: Joi.number().integer().min(0).optional(),
  pageSize: Joi.number().integer().min(1).max(100).optional(),
  sortBy: Joi.string().allow('', null).optional(),
  sortDirection: Joi.string().valid('asc', 'desc').allow('', null).optional(),
  status: Joi.string().allow('', null).optional(),
  status_id: Joi.number().integer().allow(null).optional(),
  created_from: Joi.string().allow('', null).optional(),
  created_to: Joi.string().allow('', null).optional(),
  logActivityFromDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null).optional(),
  logActivityToDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null).optional(),
  partner_name: Joi.string().allow('', null).optional(),
  partner_id: Joi.string().allow('', null).optional(),
  utm_source: Joi.string().allow('', null).optional(),
  utm_medium: Joi.string().allow('', null).optional(),
  utm_campaign: Joi.string().allow('', null).optional(),
  search: Joi.string().allow('', null).optional(),
  logicOperator: Joi.string().valid('and', 'or').allow(null, '').optional(),
  filterModel: Joi.object().unknown(true).allow(null).optional()
});

const updateDsaLeadStatus = Joi.object({
  lead_id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  status: Joi.string().required()
});

const captureDsaLeadCallData = Joi.object({
  lead_id: Joi.number().integer().required(),
  type: Joi.string().valid('call', 'lead', 'both').required(),
  call_status: Joi.alternatives()
    .try(Joi.string(), Joi.number())
    .when(Joi.ref('type'), {
      is: Joi.valid('call', 'both'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  call_remarks: Joi.string().min(1).when(Joi.ref('type'), { is: Joi.any().valid('call', 'both'), then: Joi.required(), otherwise: Joi.optional() }),
  lead_status: Joi.string().min(1).when(Joi.ref('type'), { is: 'both', then: Joi.required(), otherwise: Joi.optional().allow('', null) }),
  lead_remarks: Joi.string().allow('', null).optional(),
  // Polymorphic entity support: 'customer' / application entity vs default 'dsa'
  entity: Joi.string().valid('dsa', 'customer').allow('', null).optional(),
  entity_type: Joi.string().allow('', null).optional(),
  entity_id: Joi.alternatives().try(Joi.string(), Joi.number()).allow('', null).optional()
});

const getLeadEntriesByLeadId = Joi.object({
  lead_id: Joi.number().integer().required(),
  pageNumber: Joi.number().integer().min(0).optional(),
  pageSize: Joi.number().integer().min(1).max(100).optional(),
  filterModel: Joi.object().unknown(true).allow(null).optional(),
  logicOperator: Joi.string().valid("and", "or").allow(null, "").optional()
});

const getCallLogsByLeadId = Joi.object({
  lead_id: Joi.number().integer().required(),
  entity: Joi.string().valid('dsa', 'customer').allow('', null).optional(),
  entity_type: Joi.string().allow('', null).optional()
});

const getLeadLogsByLeadId = Joi.object({
  lead_id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  pageNumber: Joi.number().integer().min(0).optional(),
  pageSize: Joi.number().integer().min(1).max(100).optional(),
  event: Joi.string().allow('', null).optional(),
  entity: Joi.string().valid('dsa', 'customer').allow('', null).optional(),
  entity_type: Joi.string().allow('', null).optional()
});

const updateLeadRemarks = Joi.object({
  lead_id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  lead_remarks: Joi.string().allow('', null).optional()
});

const assignLeadSalesPerson = Joi.object({
  leadIdArray: Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number())).min(1).required(),
  crmId: Joi.string().required(),
  // 'dsa' (default) -> updates ru_dsa_leads; 'customer' -> updates loan_applications
  type: Joi.string().valid('dsa', 'customer').default('dsa').optional()
});

const activationDashboardMetrics = Joi.object({
  period: Joi.string().valid('day', 'mtd').optional(),
  fromDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  refresh: Joi.boolean().optional()
});

module.exports = {
  create,
  lead,
  leads,
  deleteLead,
  update,
  followLead,
  getStaredLeadForUser,
  getLeadPayouts,
  downloadLeadList,
  updateLeadPayout,
  createLead,
  createPan,
  createAddress,
  createCustomInformation,
  createPayoutInformation,
  createCrmUser,
  updateAssignee,
  createExternalPan,
  createExternalLead,
  getLeadReport,
  getLeadFormDetailsById,
  getLeadFormRemarks,
  updateLeadFormRemark,
  getLeadForms,
  sendLeadFormToErp,
  verifyPanViaAuthBridgeV2,
  pushDSAToNS,
  getProductOrBankDropdown,
  getNetsuiteBankList,
  exportNetsuiteBankList,
  setBankFileOnVcf,
  getNetsuiteProductList,
  createOrUpdateNetsuiteProduct,
  getLeadFormReference,
  downloadLeadPayout,
  getDsaPayoutExternal,
  getAllBankProductCombination,
  editBusinessCategory,
  updateLeadFormAutonomousStatus,
  getLeadPayoutDefaults,
  updateTentativeBankFileMatch,
  getReconciliationMail,
  getReconciliationMailTrail,
  getMailTrailFromMailbox,
  saveMailTrailFromMailbox,
  downloadLatestMailTrailEml,
  getLeadMailThreadReplyOptions,
  replyMailThread,
  setLeadOnHold,
  listDsaLeads,
  updateDsaLeadStatus,
  captureDsaLeadCallData,
  getLeadEntriesByLeadId,
  getCallLogsByLeadId,
  getLeadLogsByLeadId,
  updateLeadRemarks,
  assignLeadSalesPerson,
  activationDashboardMetrics
};