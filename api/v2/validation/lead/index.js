let Joi = require("joi");

const getLeadForms = Joi.object({
  pageNumber: Joi.number().allow(null, ""),
  pageSize: Joi.number().allow(null, ""),
  status: Joi.number(),
  fresh_lead_id: Joi.array().required(),
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
  payout_collide_filter: Joi.string().allow(null, ""),
  dsa_name_filter: Joi.string().allow(null, ""),
  city_filter: Joi.string().allow(null, ""),
  customer_company_name_filter: Joi.string().allow(null, ""),
  fresh_lead_id_filter: Joi.string().allow(null, ""),
  upload_file_name_filter: Joi.string().allow(null, ""),
  updatedDateStartFilter: Joi.string().allow(null, ""),
  updatedDateEndFilter: Joi.string().allow(null, ""),
  requestDateStartFilter: Joi.string().allow(null, ""),
  requestDateEndFilter: Joi.string().allow(null, ""),
  vendor_payout_type_filter: Joi.string().allow(null, ""),
  created_by_filter: Joi.string().allow(null, ""),
  is_split_case_filter: Joi.string().allow(null, ""),
  loan_status_filter: Joi.string().allow(null, ""),
  reject_reason_filter: Joi.string().allow(null, ""),
  netsuite_vendor_id_filter: Joi.string().allow(null, ""),
  sort_order: Joi.string().allow(null, ""),
  sort_field: Joi.string().allow(null, ""),
  is_export: Joi.boolean().allow(null, ""),
  export_title: Joi.string().allow(null, ""),
  form_type: Joi.array().items(
    Joi.string().valid('lead_form', 'customer_lead_form', 'upload_excel', 'instant_claim')
  ),
  claim_status: Joi.string().valid(null, "0", "1"),
  loan_status: Joi.string().valid(null, "disbursed", "login", "approved", "rejected", "not_interested"),
  loan_type_filter: Joi.string().allow(null, ""),
  ns_contest_id_filter: Joi.string().allow(null, ""),
});

const getPayoutsDigitalThroughApp = Joi.object({
  dsa_id: Joi.string().required(),
});

const editPayoutsDigitalThroughApp = Joi.object({
  dsa_id: Joi.string().required(),
  reqObj: Joi.array().required(),
});

const downloadLeadPayout = Joi.object({
  id: Joi.string().required(),
});

const sendLeadFormAutoErp = Joi.object({
  id: Joi.array().required()
})

module.exports = {
  getLeadForms,
  getPayoutsDigitalThroughApp,
  editPayoutsDigitalThroughApp,
  downloadLeadPayout,
  sendLeadFormAutoErp
}