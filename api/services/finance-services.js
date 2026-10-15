const { QueryTypes } = require("sequelize");
const { _db2, _db3 } = require("../../models");
const { sanitizeBusinessCategory, matchesRegex, buildCcEmailString, parseCommaSeparatedStrings, isInCommaOrNewlineSeparatedList, formatEventName } = require("../helpers/commonhelper");
const { ADMIN_CLASS_ID, RULOANS_HO_ID, MAX_DISB_DATE_INTERVAL, DISABLE_CONFIRMATION_MAILS_PRODUCT_ID, inHouseCategory } = require("../helpers/constantdata/config");

const parseDisabledConfirmationMailProductIds = () => {
  return new Set(parseCommaSeparatedStrings(DISABLE_CONFIRMATION_MAILS_PRODUCT_ID));
};

/**
 * Returns whether banker confirmation mail + confirmation_required is allowed for a Netsuite product.
 * Disallows when product_id or its parent_product_id is in DISABLE_CONFIRMATION_MAILS_PRODUCT_ID.
 * @param {number|string} product_id
 * @returns {Promise<boolean>}
 */
exports.isConfirmationMailAllowedForProductId = async (product_id) => {
  const disabledSet = parseDisabledConfirmationMailProductIds();
  if (!disabledSet.size) return true;

  const productIdStr = (product_id ?? "").toString().trim();
  if (productIdStr && disabledSet.has(productIdStr)) return false;

  const query = `SELECT parent_product_id FROM ru_netsuite_products WHERE netsuite_product_id = ?`;
  const result = await _db2.query(query, { replacements: [productIdStr], type: QueryTypes.SELECT });
  const parentIdStr = (result?.[0]?.parent_product_id ?? "").toString().trim();
  if (parentIdStr && disabledSet.has(parentIdStr)) return false;

  return true;
};

/**
 * Check online lead based on product name and loan details
 * @param {string} product_name - Product name from netsuite (e.g., "HML")
 * @param {string} dsa_id - DSA ID to match
 * @param {string} loan_number - Loan reference ID to match
 * @param {string} apac_ref_los_number - APAC/REF/LOS number to match
 * @param {string} bank_id - Bank ID for additional validation
 * @param {string} product_id - Product ID for additional validation
 * @returns {Object} - { tableName: string, mainProduct: string, is_online_lead: boolean }
 */
exports.onlineLeadCheck = async (product_name, dsa_id, loan_number, apac_ref_los_number, bank_id, product_id) => {
  try {

    // Get primary ID from ru_bank_product_combinations using bank_id and product_id
    let bankProductQuery = `SELECT id FROM ru_bank_product_combinations WHERE bank_id = ? AND product_id = ?`;
    let bankProductBindParams = [bank_id, product_id];
    let bankProductData = await _db2.query(bankProductQuery, { replacements: bankProductBindParams, type: QueryTypes.SELECT });

    if (!bankProductData || bankProductData.length === 0) {
      return { tableName: null, mainProduct: null, is_online_lead: false, error: `Bank product combination not found for bank_id: ${bank_id}, product_id: ${product_id}` };
    }

    const bankProductPrimaryId = bankProductData[0].id;

    // Get primary ID from ru_loans_products where ns_bank_product_id = bankProductPrimaryId
    let loansProductQuery = `SELECT id FROM ru_loans_products WHERE ns_bank_product_id = ?`;
    let loansProductBindParams = [bankProductPrimaryId];
    let loansProductData = await _db3.query(loansProductQuery, { replacements: loansProductBindParams, type: QueryTypes.SELECT });

    if (!loansProductData || loansProductData.length === 0) {
      return { tableName: null, mainProduct: null, is_online_lead: false, error: `Loans product not found for ns_bank_product_id: ${bankProductPrimaryId}` };
    }


    // Get main_product from ru_netsuite_products
    let productQuery = `SELECT main_product FROM ru_netsuite_products WHERE netsuite_product_id = ?`;
    let productBindParams = [product_id];
    let productData = await _db2.query(productQuery, { replacements: productBindParams, type: QueryTypes.SELECT });

    if (!productData || productData.length === 0) {
      return { tableName: null, mainProduct: null, is_online_lead: false, error: `Product not found: ${product_id}` };
    }

    const mainProduct = productData[0].main_product;

    const convertToAlias = (str) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '');
    };

    // Map main_product to appropriate loan application tables using aliases
    const productTableMapping = {
      "home_loan": "ru_hl_applications",
      "agriculture_loan": "ru_lap_applications",
      "balance_pay": "ru_bl_applications",
      "business_loan": "ru_bl_applications",
      "other_secured": "ru_lap_applications",
      "credit_card": "ru_cc_applications",
      "account": "ru_cc_applications",
      "personal_loan": "ru_personal_loan_applications",
      "donation": "ru_personal_loan_applications",
      "educational_loan": "ru_education_loan_applications",
      "educational_institute_loan": "ru_education_loan_applications",
      "fixed_deposit": "ru_personal_loan_applications",
      "gold_loan": "ru_gold_loan_applications",
      "healthcare": "ru_personal_loan_applications",
      "general_insurance": "ru_personal_loan_applications",
      "health_insurance": "ru_personal_loan_applications",
      "life_insurance": "ru_personal_loan_applications",
      "loan_protection_plan": "ru_personal_loan_applications",
      "motor_insurance": "ru_car_loan_applications",
      "loan_against_property": "ru_lap_applications",
      "loan_against_security": "ru_lap_applications",
      "car_loan": "ru_car_loan_applications",
      "comm_vehicle_loan": "ru_car_loan_applications",
      "lap": "ru_lap_applications",
      "other_business": "ru_bl_applications",
      "working_capital": "ru_bl_applications"
    };

    const mainProductAlias = convertToAlias(mainProduct);

    const tableName = productTableMapping[mainProductAlias] || null;

    if (!tableName) {
      return { tableName: null, mainProduct: mainProduct, is_online_lead: false, error: `No table mapping found for product: ${mainProduct}` };
    }

    const loansProductPrimaryId = loansProductData[0].id;

    // Check loan application table for matching records
    let loanQuery = `SELECT COUNT(*) as count FROM ${tableName} 
                     WHERE dsa_id = ? 
                     AND (external_id = ? OR external_id = ?)
                     AND product_id = ?
                     AND sub_status = 'completed' 
                     AND status = 'disbursed'`;

    let loanBindParams = [dsa_id, loan_number, apac_ref_los_number, loansProductPrimaryId];
    let loanResult = await _db2.query(loanQuery, { replacements: loanBindParams, type: QueryTypes.SELECT });

    const is_online_lead = loanResult[0].count > 0;

    return {
      tableName: tableName,
      mainProduct: mainProduct,
      is_online_lead: is_online_lead,
      error: null
    };

  } catch (error) {
    return {
      tableName: null,
      mainProduct: null,
      is_online_lead: false,
      error: `Database error: ${error.message}`
    };
  }
};

const SHARING_PAYOUT_ZERO_PNL = 4;
const BACK_OFFICE_CHARGES = 16;
const PAYOUT_SHARING_CASE = 17;

/**
 * Categories a payout-sharing partner may carry, opposite the primary's 17.
 *
 * Kept in step with `api/v2/finance/leads/claims/payoutSharing.js`, which owns the same
 * set for the write path. Duplicated rather than imported because this module is required
 * BY that side of the tree and importing back would close a cycle.
 */
const SHARING_PARTNER_CATEGORIES = new Set([SHARING_PAYOUT_ZERO_PNL, BACK_OFFICE_CHARGES]);

const normalizePayoutType = (payoutType) => {
  if (payoutType == null || payoutType === '') return null;
  const normalized = String(payoutType).trim().toLowerCase();
  if (normalized === '1' || normalized === 'ratio') return 'ratio';
  if (normalized === '2' || normalized === 'rate') return 'rate';
  return null;
};

/**
 * Payout-sharing case: two leads that match the common duplicate criteria but are
 * intentionally allowed because payout is split across business categories / DSAs.
 *
 * All of the following must be true (used to exempt from multi-funded duplicate flag
 * and to exclude from blocking reference leads in getLeadFormReference):
 *
 * 1. Business categories are a valid payout-sharing pair:
 *    - 4  = Sharing Payout Zero PNL
 *    - 17 = Payout Sharing Case
 *    (either order on incoming vs existing lead)
 *
 * 2. Same underlying loan: loan_reference_id OR loan_apac_ref_los_number must match.
 *
 * 3. Same payout type (rate or ratio) but different payout value — each lead carries
 *    its share of the total payout.
 *
 * 4. Different dsa_id — payout is attributed to different DSAs, not the same partner.
 */
const isValidpayoutSharingCase = (incoming, existingLead) => {
  // 1. Business category pair: 17 (Payout Sharing Case) + one partner category.
  //    Partners are 4 (Sharing Payout Zero PNL) and 16 (Back Office Charges) — 16 was
  //    added when payout sharing became a first-class two-claim operation.
  const catA = Number(sanitizeBusinessCategory(incoming.business_categories));
  const catB = Number(sanitizeBusinessCategory(existingLead.business_categories));
  const isCategoryPair =
    (SHARING_PARTNER_CATEGORIES.has(catA) && catB === PAYOUT_SHARING_CASE) ||
    (catA === PAYOUT_SHARING_CASE && SHARING_PARTNER_CATEGORIES.has(catB));
  if (!isCategoryPair) return false;

  // 2. Same loan / APAC reference on both leads
  const loanMatch = incoming.loan_reference_id && existingLead.loan_reference_id
    && String(incoming.loan_reference_id) === String(existingLead.loan_reference_id);
  const apacMatch = incoming.loan_apac_ref_los_number && existingLead.loan_apac_ref_los_number
    && String(incoming.loan_apac_ref_los_number) === String(existingLead.loan_apac_ref_los_number);
  if (!loanMatch && !apacMatch) return false;

  // 3. Same payout type, different payout value (split payout)
  const incomingType = normalizePayoutType(incoming.payout_type);
  const existingType = normalizePayoutType(existingLead.vendor_payout_type);
  if (!incomingType || !existingType || incomingType !== existingType) return false;

  let incomingValue;
  let existingValue;
  if (incomingType === 'rate') {
    incomingValue = parseFloat(incoming.payout_rate);
    existingValue = parseFloat(existingLead.vendor_payout_rate);
  } else {
    incomingValue = parseFloat(incoming.payout_ratio);
    existingValue = parseFloat(existingLead.vendor_payout_ratio);
  }
  if (!Number.isFinite(incomingValue) || !Number.isFinite(existingValue)) return false;
  if (incomingValue === existingValue) return false;

  // 4. Different DSA — not the same partner claiming both shares
  const incomingDsaId = incoming.dsa_id;
  const existingDsaId = existingLead.dsa_id;
  if (incomingDsaId == null || existingDsaId == null) return false;
  if (String(incomingDsaId) === String(existingDsaId)) return false;

  return true;
};

exports.isValidpayoutSharingCase = isValidpayoutSharingCase;

exports.checkIfDuplcateLeadExist = async (data) => {
  let {
    first_name,
    last_name,
    disbursement_date_iso,
    disbursement_amount,
    city,
    netsuite_vendor_id,
    netsuite_product_id,
    netsuite_bank_id,
    loan_reference_id,
    loan_apac_ref_los_number,
    fresh_lead_id
  } = data;

  const activeLeadFilters = `
    and flc.is_deleted = false
    and flc.fresh_lead_status_id <> 3
    and flc.loan_status <> 'rejected'
  `;

  let query = ` select main_product from ru_netsuite_products where netsuite_product_id = ? `;

  let bindParams = [netsuite_product_id];

  let productData = await _db2.query(query, {
    replacements: bindParams,
    type: QueryTypes.SELECT
  });

  productData = productData[0];

  if (!productData || !productData.main_product) {
    return null;
  }

  const product_loan_type = productData.main_product
    .toLowerCase()
    .replace(/\s+/g, '_');

  // PERSONAL LOAN MULTI FUNDED CHECK

  if (product_loan_type == "personal_loan" && disbursement_date_iso) {

    const disbursement_month = disbursement_date_iso.split('-')[1];

    query = ` select flc.* , n.main_product 
              from ru_fresh_lead_claims flc 
              left join ru_netsuite_products n  
                on flc.netsuite_product_id = n.netsuite_product_id COLLATE utf8mb4_general_ci 
              where flc.customer_first_name = ? 
                and flc.customer_last_name = ? 
                and MONTH(flc.disbursement_date_iso) = ? 
                and flc.netsuite_bank_id != ? 
                and flc.netsuite_vendor_id = ? 
                and flc.city = ? 
                and flc.loan_status = "disbursed" 
                ${activeLeadFilters} `;

    bindParams = [
      first_name,
      last_name,
      disbursement_month,
      netsuite_bank_id,
      netsuite_vendor_id,
      city
    ];

    if (fresh_lead_id) {
      query += ` and flc.fresh_lead_id != ? `;
      bindParams.push(fresh_lead_id);
    }

    // useMaster: a claim written earlier in the same batch must be visible here,
    // and read replicas can lag behind the primary.
    let result = await _db2.query(query, {
      replacements: bindParams,
      type: QueryTypes.SELECT,
      useMaster: true
    });

    if (result.length) {

      for (let i = 0; i < result.length; i++) {

        if (result[i].main_product) {

          const loan_type = result[i].main_product
            .toLowerCase()
            .replace(/\s+/g, '_');

          if (loan_type == "personal_loan") {
            return result[i];
          }
        }
      }
    }

    return null;
  }

  // COMMON DUPLICATE CHECK
  // Covers Scenario 2 (same customer name + disb. month + disb. amt + bank) and Scenario 3 (same loan/APAC + disb. month + disb. amt + bank).
  // Scenario 1 (same loan/APAC + customer name + disb. date + disb. amt + bank + main/sub product + city)
  // is a superset: when Scenario 2 or 3 matches with full field alignment, Scenario 1 is satisfied as well.

  if (!disbursement_amount || !netsuite_bank_id || !disbursement_date_iso) {
    return null;
  }

  const disbursement_month = disbursement_date_iso.split('-')[1];

  const identityConditions = ['(flc.customer_first_name = ? and flc.customer_last_name = ?)'];
  bindParams = [first_name, last_name];

  if (loan_reference_id) {
    identityConditions.push('flc.loan_reference_id = ?');
    bindParams.push(loan_reference_id);
  }

  if (loan_apac_ref_los_number) {
    identityConditions.push('flc.loan_apac_ref_los_number = ?');
    bindParams.push(loan_apac_ref_los_number);
  }

  query = ` select flc.* 
            from ru_fresh_lead_claims flc 
            where flc.disbursement_amount = ? 
              and flc.netsuite_bank_id = ? 
              and MONTH(flc.disbursement_date_iso) = ? 
              and (${identityConditions.join(' or ')}) 
              ${activeLeadFilters} `;

  bindParams = [disbursement_amount, netsuite_bank_id, disbursement_month, ...bindParams];

  if (fresh_lead_id) {
    query += ` and flc.fresh_lead_id != ? `;
    bindParams.push(fresh_lead_id);
  }

  // useMaster: see the note on the personal-loan query above.
  let result = await _db2.query(query, {
    replacements: bindParams,
    type: QueryTypes.SELECT,
    useMaster: true
  });

  if (!result.length) return null;
  if (result.length > 1) return result[0];

  const existingLead = result[0];
  if (product_loan_type !== 'personal_loan' && isValidpayoutSharingCase(data, existingLead)) {
    return null;
  }
  return existingLead;
};

exports.checkIfLoanAndApacNumberIsValid = (regexPattern, loan_number, apac_ref_los_number) => {
  let loan_reference_id_regex = null;
  let apac_ref_los_number_regex = null;
  let error = null;


  // Get loan reference regex if it exists
  if (regexPattern && regexPattern.fields['loan_reference_id']) {
    loan_reference_id_regex = regexPattern.fields['loan_reference_id'];
  }

  // Get appropriate APAC/LOS regex based on form type
  if (regexPattern && regexPattern.fields['apac_ref_los_number']) {
    apac_ref_los_number_regex = regexPattern.fields['apac_ref_los_number'];
  }

  // Validate loan reference ID if regex exists and a value was actually supplied
  // (callers may pass only the field(s) actually being edited)
  let loan_reference_id_valid = true;
  if (loan_reference_id_regex && loan_number != null && loan_number !== '') {
    loan_reference_id_valid = false;
    for (let j = 0; j < loan_reference_id_regex.length; j++) {
      loan_reference_id_valid = (loan_reference_id_valid || matchesRegex(loan_number.toString().trim(), loan_reference_id_regex[j]));
    }
  }

  // Validate APAC/LOS number if regex exists and a value was actually supplied
  let apac_ref_los_number_valid = true;
  if (apac_ref_los_number_regex && apac_ref_los_number != null && apac_ref_los_number !== '') {
    apac_ref_los_number_valid = false;
    for (let j = 0; j < apac_ref_los_number_regex.length; j++) {
      apac_ref_los_number_valid = (apac_ref_los_number_valid || matchesRegex(apac_ref_los_number.toString().trim(), apac_ref_los_number_regex[j]));
    }
  }

  // Set error message if validation failed
  // if (!loan_reference_id_valid) {
  //   let sample = Array.isArray(regexPattern.fields['loan_reference_id_sample']) ? regexPattern.fields['loan_reference_id_sample'].join(",") : "";
  //   error = ` Invalid Loan Number Format/Value . ${sample ? "Example Sample: " + sample : ""} `;
  // } else if (!apac_ref_los_number_valid) {
  //   let sample = Array.isArray(regexPattern.fields['apac_ref_los_number_sample']) ? regexPattern.fields['apac_ref_los_number_sample'].join(",") : "";
  //   error = ` Invalid Loan Apac/Ref LOS Number Format/Value . ${sample ? "Example Sample: " + sample : ""} `;
  // }

  // Individual Error Message if Validation Fails for either Loan_Ref or Loan_number
  if (!loan_reference_id_valid || !apac_ref_los_number_valid) {
    let ref_sample = Array.isArray(regexPattern.fields['loan_reference_id_sample']) ? regexPattern.fields['loan_reference_id_sample'].join(", ") : "";

    let los_sample = Array.isArray(regexPattern.fields['apac_ref_los_number_sample']) ? regexPattern.fields['apac_ref_los_number_sample'].join(", ") : "";

    let invalidFields = [];

    if (!loan_reference_id_valid) invalidFields.push("Loan Number");
    if (!apac_ref_los_number_valid) invalidFields.push("APAC/Ref LOS Number");

    // error = `Invalid ${invalidFields.join(" and ")} format/value. Examples — Loan Number: ${ref_sample || 'N/A'}, APAC/Ref LOS: ${los_sample || 'N/A'}`;
    error = `Invalid ${invalidFields.join(" and ")} format/value. Examples - Loan Number: ${ref_sample || 'N/A'}, APAC/Ref LOS: ${los_sample || 'N/A'}`;
  }

  return { error };
}

//fetch dsa_id of lead form if not there
exports.updateFreshLeadDsaId = async (data, is_company = false) => {
  const { dsa_mobile_number, fresh_lead_id } = data
  let query = 'select dsa.dsa_id , k.ns_hierarchy , k.permanent_account_number from ru_direct_selling_agents dsa left join ru_dsa_kyc_data k on dsa.dsa_id = k.dsa_id where dsa.dsa_mobile_number = ? '
  let bindParams = [dsa_mobile_number]
  // useMaster: the DSA row may have been written moments earlier; replicas can lag.
  let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });
  result = result[0] || null
  if (result) {
    if (!is_company) {
      query = 'update ru_fresh_lead_claims set dsa_id = ? where fresh_lead_id = ?'
      bindParams = [result.dsa_id, fresh_lead_id]
      await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    }
    data.dsa_id = result.dsa_id;
    data.ns_hierarchy = result.ns_hierarchy;
    data.permanent_account_number = result.permanent_account_number;
  }
  return data;
}

exports.checkIfFreshLeadExist = async (data) => {
  let { loan_reference_id, apac_ref_los_number, netsuite_bank_id, netsuite_product_id, fresh_lead_id } = data;

  // Combine both parameters into a single array for both IN clauses
  const loanIdentifiers = [loan_reference_id, apac_ref_los_number];

  let query = ` select flc.*, d.dsa_mobile_number, d.business_head_code , k.ns_hierarchy , k.permanent_account_number from ru_fresh_lead_claims flc left join ru_direct_selling_agents d on flc.dsa_mobile_number = d.dsa_mobile_number left join ru_dsa_kyc_data k on k.dsa_id = d.dsa_id where (flc.loan_reference_id IN (?) or flc.loan_apac_ref_los_number IN (?)) and flc.netsuite_bank_id = ? and flc.netsuite_product_id = ? and flc.is_deleted = false and flc.fresh_lead_status_id <> 3 and flc.loan_status <> 'rejected' `;
  if (fresh_lead_id) {
    query += ` and flc.fresh_lead_id != ? `;
  };
  // Oldest first: validateBusinessCategory keys the second_allowed check on the
  // chronologically FIRST claim of the group (firstBusinessCategory[0]), per the
  // split-case spec — not on whichever claim happens to be newest.
  query += ` order by flc.id asc `;

  // Use the same array for both IN clauses
  let bindParams = [loanIdentifiers, loanIdentifiers, netsuite_bank_id, netsuite_product_id];
  if (fresh_lead_id) {
    bindParams.push(fresh_lead_id);
  }

  // useMaster: a split-case sibling written earlier in the same batch must be visible
  // here, and read replicas can lag behind the primary.
  let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });
  if (!result.length) {
    return null;
  }

  return result;
};


exports.validateBusinessCategory = async (firstClaim, secondClaim) => {

  const { firstBusinessCategory, dsa_ids, ns_hierarchy, business_head_codes } = firstClaim

  // case 0 is for empty business category in previous leads , as it matches no case
  const errorMsg0 = {
    isValid: false,
    message: "Empty Business Category in Previous Leads"
  };

  if (firstBusinessCategory.some((b) => b == "0")) {
    return errorMsg0
  }

  const errorMsg1 = {
    isValid: false,
    message: "Wrong Business Category in Previous Leads"
  };

  const errorMsg2 = {
    isValid: false,
    message: "Duplicate Claim – Already Claimed by Other Team."
  };

  let secondBusinessCategory = sanitizeBusinessCategory(secondClaim.business_categories);
  secondBusinessCategory = secondBusinessCategory?.toString() // manages number values 

  let case_id = 0;
  const isNotCaseOne = dsa_ids.some((dsa_id) => dsa_id !== secondClaim.dsa_id)
  const isNotCaseTwo = business_head_codes.some((code) => code != secondClaim.business_head_code)

  if (!isNotCaseOne) {
    case_id = 1
  }
  else if (!isNotCaseTwo) {
    case_id = 2
  }
  else {
    case_id = 3
  }

  const { getLeadCaseBusinessCategory } = require('../v1/controllers/mongo-db'); //temp fix for cirsular dependency 
  let { first_allowed, second_allowed } = await getLeadCaseBusinessCategory(case_id)
  if (!firstBusinessCategory.length) {
    if (first_allowed.includes(secondBusinessCategory)) return { isValid: true }
    return errorMsg2
  }

  if (firstBusinessCategory.some((b) => !first_allowed.includes((b)))) {
    return errorMsg1
  }

  let first_case = firstBusinessCategory[0]
  if (!second_allowed[first_case] || !second_allowed[first_case].includes(secondBusinessCategory)) {
    return errorMsg2
  }

  return { isValid: true };

}

exports.getFinanceRootPrivileges = async () => {
  query = ` select * from ru_settings where setting_key = 'finance_root_privileges' `;
  let data = await _db2.query(query, { type: QueryTypes.SELECT });
  return data[0] || null;
};

/**
 * Checks whether a phone belongs to a finance root (master) user.
 * Uses comma/newline separated list parsing via isInCommaOrNewlineSeparatedList.
 *
 * @param {string} phone
 * @returns {Promise<boolean>}
 */
exports.isFinanceRootUser = async (phone) => {
  if (!phone) return false;
  const rootValue = await exports.getFinanceRootPrivileges();
  const listString = rootValue?.setting_value;

  return isInCommaOrNewlineSeparatedList(listString, phone);
};

exports.getRequestAutonomousForVendorPrivileges = async () => {
  query = ` select * from ru_settings where setting_key = 'request_autonomous_for_vendor' `;
  let data = await _db2.query(query, { type: QueryTypes.SELECT });
  return data[0] || null;
};

/**
 * Checks whether an email is allow-listed for Request Autonomous For Vendor.
 * Reads comma/newline separated emails from ru_settings.request_autonomous_for_vendor.
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
exports.hasRequestAutonomousForVendorPrivilege = async (email) => {
  if (!email) return false;
  const value = await exports.getRequestAutonomousForVendorPrivileges();
  const listString = value?.setting_value;
  return isInCommaOrNewlineSeparatedList(listString, email);
};

const APPROVED_BANK_ACCOUNT_STATUSES = ['approved', 'active'];

const additionalLeadFormValidation = async (data) => {
  const { class_id, partner_id, account_number, account_status } = data
  const errors = []

  if (!class_id) {
    errors.push('NS hierarchy is not synced')
  } else if (class_id == ADMIN_CLASS_ID) {
    errors.push('Admin NS hierarchy detected')
  }

  if (partner_id == RULOANS_HO_ID) {
    errors.push('Ruloans HO partner detected')
  }

  // account_number alone isn't enough — the preferred-bank-account join picks the "best
  // available" row even when nothing is approved (falls back to most-recently-updated),
  // so a DSA with only a pending/rejected account would otherwise pass this check.
  if (!account_number) {
    errors.push('Bank account is not synced')
  } else if (!APPROVED_BANK_ACCOUNT_STATUSES.includes(String(account_status || '').toLowerCase())) {
    errors.push('Bank account is not approved')
  }

  if (errors.length > 0) {
    return { isValid: false, message: `Validation failed: ${errors.join(', ')}` }
  }
  return { isValid: true }
};

exports.additionalLeadFormValidation = additionalLeadFormValidation;

/**
 * Validation when enabling Auto ERP: reuses lead-form rules, then PAN + payout capping.
 * Returns a single combined message for API responses.
 */
exports.autoErpValidation = async (dsaDetails) => {
  const {
    class_id,
    partner_id,
    account_number,
    account_status,
    authbridge_pan_verification_status,
    assigning_payout_percentage,
  } = dsaDetails || {}

  const leadResult = await additionalLeadFormValidation({
    class_id,
    partner_id,
    account_number,
    account_status,
  })

  const errors = []
  if (!leadResult?.isValid && leadResult?.message) {
    const prefix = 'Validation failed: '
    const m = leadResult.message
    errors.push(m.startsWith(prefix) ? m.slice(prefix.length) : m)
  }

  const panVerified = authbridge_pan_verification_status == 1
  if (!panVerified) {
    errors.push('PAN verification is not completed')
  }

  const cap = assigning_payout_percentage
  const capNum = cap === '' || cap == null ? NaN : Number(cap)
  if (Number.isNaN(capNum) || capNum <= 0) {
    errors.push('Payout capping must be greater than 0')
  }

  if (errors.length > 0) {
    return { isValid: false, message: `Validation failed: ${errors.join(', ')}` }
  }
  return { isValid: true }
};

exports.checkNsContestIdExists = async (ns_contest_id, type = 'lead_form_contest', disbursement_date = null) => {
  if (!ns_contest_id) {
    return { isValid: true }; // If ns_contest_id is empty or null, no need to check
  }

  const query = `
            SELECT COUNT(*) as count, last_date_to_upload_claim, start_date, end_date
            FROM ru_events 
            WHERE type = ? 
            AND ns_contest_id = ?
        `;

  const [result] = await _db2.query(query, {
    replacements: [type, ns_contest_id],
    type: QueryTypes.SELECT
  });

  if (result.count === 0) {
    return { isValid: false, message: `Invalid ns_contest_id: ${ns_contest_id}. No matching contest found for type: ${type}` };
  }

  // Check if contest has expired
  if (result.last_date_to_upload_claim) {
    const currentDate = new Date().toISOString().slice(0, 10); // Get current date only (YYYY-MM-DD)        

    if (result.last_date_to_upload_claim < currentDate) {
      return { isValid: false, message: "This contest has been expired" };
    }
  }
  // Check if disbursement_date is within contest period
  if (disbursement_date && result.start_date && result.end_date) {
    // Format disbursement_date from ISO to YYYY-MM-DD
    const formattedDisbursementDate = new Date(disbursement_date).toISOString().slice(0, 10);

    if (formattedDisbursementDate < result.start_date || formattedDisbursementDate > result.end_date) {
      return { isValid: false, message: `Disbursement date must be between ${result.start_date} and ${result.end_date} for this contest.` };
    }
  }

  return { isValid: true };
};

exports.searchFreshLeadClaims = async (customer_first_name, customer_last_name, customer_full_name, netsuite_bank_id, netsuite_product_ids, loan_reference_id, loan_apac_ref_los_number, is_tentative_matched = 0) => {
  // Build IN clause for netsuite_product_ids
  const productPlaceholders = netsuite_product_ids.map(() => '?').join(',');

  // Build JOIN condition based on is_tentative_matched value
  let joinCondition;
  if (is_tentative_matched === 0) {
    // If is_tentative_matched is 0, search for both 0 and null
    joinCondition = `flc.fresh_lead_id = flcm.fresh_lead_id AND (flcm.is_tentative_matched = 0 OR flcm.is_tentative_matched IS NULL)`;
  } else {
    // If is_tentative_matched is 1, only search for 1
    joinCondition = `flc.fresh_lead_id = flcm.fresh_lead_id AND flcm.is_tentative_matched = 1`;
  }

  let query = ` SELECT flc.fresh_lead_id FROM ru_fresh_lead_claims flc 
                JOIN ru_fresh_lead_claims_meta flcm ON ${joinCondition}
                WHERE 
                  flc.netsuite_bank_id = ? AND 
                  flc.netsuite_product_id IN (${productPlaceholders}) AND 
                  (flc.loan_reference_id = ? OR 
                  flc.loan_apac_ref_los_number = ?) AND
                  flc.fresh_lead_status_id IN (0, 13) AND
                  flc.loan_status = "disbursed" AND
                  flc.is_deleted = 0 AND
                  flc.claim_pending_flag = 1 AND
                  flc.multi_funded_flag IN (-1, 2)
                  LIMIT 1
                  `;

  let bindParams = [
    netsuite_bank_id,
    ...netsuite_product_ids,
    loan_reference_id,
    loan_apac_ref_los_number
  ];

  let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
  const record = result[0] || null;
  return {
    is_matched: record !== null,
    fresh_lead_id: record ? record.fresh_lead_id : null
  };
};

const searchBankFiles = async (netsuite_bank_id, netsuite_product_id, loan_reference_id, loan_apac_ref_los_number, claimed = 0, existingBankFileId = null) => {
  const claimedCondition = existingBankFileId ? `(lead_claimed = ? OR bank_file_id = ?)` : `lead_claimed = ?`;
  const query = ` SELECT bank_file_id FROM ru_dsa_bank_files WHERE
    bank_internal_id  = ? AND
    (product_internal_id = ? OR sub_product_internal_id = ?) AND
    (loan_number = ? OR
    apac_loan_number = ?) AND
    ${claimedCondition} AND
    created_at >= DATE_SUB(NOW(), INTERVAL 180 DAY)
    LIMIT 1
    `;

  const bindParams = [
    netsuite_bank_id,
    netsuite_product_id,
    netsuite_product_id,
    loan_reference_id,
    loan_apac_ref_los_number,
    claimed
  ];
  if (existingBankFileId) {
    bindParams.push(existingBankFileId);
  }

  // useMaster: a bank file claimed earlier in the same batch must be visible here.
  const result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });
  const record = result[0] || null;
  return {
    is_matched: record !== null,
    bank_file_id: record ? record.bank_file_id : null
  };
};

const searchTentativeBankFiles = async (netsuite_bank_id, netsuite_product_id, loan_reference_id, loan_apac_ref_los_number, claimed = 0, existingBankFileId = null) => {
  const claimedCondition = existingBankFileId ? `(claimed = ? OR bank_file_id = ?)` : `claimed = ?`;
  const query = ` SELECT bank_file_id FROM ru_dsa_tentative_bank_files WHERE
    netsuite_bank_id = ? AND
    (netsuite_product_id = ? OR netsuite_sub_product_id = ?) AND
    (loan_number = ? OR
    apac_loan_number = ?) AND
    ${claimedCondition} AND
    created_at >= DATE_SUB(NOW(), INTERVAL 180 DAY)
    LIMIT 1
    `;

  const bindParams = [
    netsuite_bank_id,
    netsuite_product_id,
    netsuite_product_id,
    loan_reference_id,
    loan_apac_ref_los_number,
    claimed
  ];
  if (existingBankFileId) {
    bindParams.push(existingBankFileId);
  }

  // useMaster: a bank file claimed earlier in the same batch must be visible here.
  const result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });
  const record = result[0] || null;
  return {
    is_matched: record !== null,
    bank_file_id: record ? record.bank_file_id : null
  };
};

const noBankFileMatchResult = (previous_bank_file_id = null, previous_tentative_bank_file_id = null) => ({
  is_matched: false,
  match_source: null,
  is_tentative_matched: 0,
  tentative_bank_file_id: null,
  is_bank_file_matched: 0,
  bank_file_id: null,
  previous_bank_file_id,
  previous_tentative_bank_file_id
});

const ALLOWED_BANK_FILE_MATCH_BUSINESS_CATEGORIES = new Set([11, 21, inHouseCategory, 17, 9]);

const isBankFileMatchAllowedForBusinessCategory = (business_categories) => {
  const category = Number(business_categories);
  return ALLOWED_BANK_FILE_MATCH_BUSINESS_CATEGORIES.has(category);
};

// Banks whose cases always need document verification by the CC team (9884 = SBI):
// never matched to main/tentative bank files, never marked banker-processed by n8n, never autonomous.
const MANUAL_REVIEW_BANK_IDS = new Set([9884]);

const isManualReviewBank = (netsuite_bank_id) => MANUAL_REVIEW_BANK_IDS.has(Number(netsuite_bank_id));
exports.isManualReviewBank = isManualReviewBank;

const getBankCategoryByBankProduct = async (bank_id, product_id) => {
  const [row] = await _db2.query(
    `SELECT bank_category FROM ru_bank_product_combinations WHERE bank_id = ? AND product_id = ? LIMIT 1`,
    { replacements: [bank_id, product_id], type: QueryTypes.SELECT }
  );
  return String(row?.bank_category || '').trim().toLowerCase();
};
exports.getBankCategoryByBankProduct = getBankCategoryByBankProduct;

const BANK_FILE_MATCH_EXCLUDED_CATEGORIES = new Set(['cat c', 'cat d']);

/**
 * Leads that must never be auto-matched to a main or tentative bank file:
 * manual-review banks (SBI) and CAT C / CAT D bank-product combinations.
 */
const isBankFileMatchExcluded = async (netsuite_bank_id, netsuite_product_id) => {
  if (isManualReviewBank(netsuite_bank_id)) return true;
  const bankCategory = await getBankCategoryByBankProduct(netsuite_bank_id, netsuite_product_id);
  return BANK_FILE_MATCH_EXCLUDED_CATEGORIES.has(bankCategory);
};
exports.isBankFileMatchExcluded = isBankFileMatchExcluded;

/**
 * Search main bank files first, then tentative bank files as fallback.
 * Returns meta-ready fields for ru_fresh_lead_claims_meta.
 */
exports.matchLeadBankFile = async (netsuite_bank_id, netsuite_product_id, loan_reference_id, loan_apac_ref_los_number, business_categories, claimed = 0, for_update = false, fresh_lead_id = null) => {
  let previous_bank_file_id = null;
  let previous_tentative_bank_file_id = null;
  if (for_update && fresh_lead_id) {
    const previousMatchQuery = `SELECT bank_file_id, tentative_bank_file_id FROM ru_fresh_lead_claims_meta WHERE fresh_lead_id = ?`;
    const [previousMatch] = await _db2.query(previousMatchQuery, { replacements: [fresh_lead_id], type: QueryTypes.SELECT, useMaster: true });
    previous_bank_file_id = previousMatch?.bank_file_id || null;
    previous_tentative_bank_file_id = previousMatch?.tentative_bank_file_id || null;
  }

  if (!isBankFileMatchAllowedForBusinessCategory(business_categories)) {
    return noBankFileMatchResult(previous_bank_file_id, previous_tentative_bank_file_id);
  }

  if (!loan_reference_id && !loan_apac_ref_los_number) {
    return noBankFileMatchResult(previous_bank_file_id, previous_tentative_bank_file_id);
  }

  // Manual-review banks (SBI) and CAT C / CAT D products are never matched against main or tentative bank files
  if (await isBankFileMatchExcluded(netsuite_bank_id, netsuite_product_id)) {
    return noBankFileMatchResult(previous_bank_file_id, previous_tentative_bank_file_id);
  }

  const mainMatch = await searchBankFiles(
    netsuite_bank_id,
    netsuite_product_id,
    loan_reference_id,
    loan_apac_ref_los_number,
    claimed,
    previous_bank_file_id
  );

  if (mainMatch.is_matched) {
    return {
      is_matched: true,
      match_source: 'main',
      is_tentative_matched: 0,
      tentative_bank_file_id: null,
      is_bank_file_matched: 1,
      bank_file_id: mainMatch.bank_file_id,
      previous_bank_file_id,
      previous_tentative_bank_file_id
    };
  }

  const tentativeMatch = await searchTentativeBankFiles(
    netsuite_bank_id,
    netsuite_product_id,
    loan_reference_id,
    loan_apac_ref_los_number,
    claimed,
    previous_tentative_bank_file_id
  );

  if (tentativeMatch.is_matched) {
    return {
      is_matched: true,
      match_source: 'tentative',
      is_tentative_matched: 1,
      tentative_bank_file_id: tentativeMatch.bank_file_id,
      is_bank_file_matched: 0,
      bank_file_id: null,
      previous_bank_file_id,
      previous_tentative_bank_file_id
    };
  }

  return noBankFileMatchResult(previous_bank_file_id, previous_tentative_bank_file_id);
};

/**
 * Mark the matched bank file row as claimed and link it to the lead.
 * @param {Object} bankFileMatchResult - Result from matchLeadBankFile
 * @param {string} fresh_lead_id
 */
exports.claimMatchedBankFileSource = async (bankFileMatchResult, fresh_lead_id) => {
  if (!bankFileMatchResult?.is_matched || !fresh_lead_id) {
    return;
  }

  if (bankFileMatchResult.match_source === 'main' && bankFileMatchResult.bank_file_id) {
    const query = `UPDATE ru_dsa_bank_files SET lead_claimed = 1, fresh_lead_id = ? WHERE bank_file_id = ?`;
    await _db2.query(query, {
      replacements: [fresh_lead_id, bankFileMatchResult.bank_file_id],
      type: QueryTypes.UPDATE
    });
    return;
  }

  if (bankFileMatchResult.match_source === 'tentative' && bankFileMatchResult.tentative_bank_file_id) {
    const query = `UPDATE ru_dsa_tentative_bank_files SET claimed = 1, fresh_lead_id = ? WHERE bank_file_id = ?`;
    await _db2.query(query, {
      replacements: [fresh_lead_id, bankFileMatchResult.tentative_bank_file_id],
      type: QueryTypes.UPDATE
    });
  }
};

/**
 * Release a previously-matched bank file source (main and/or tentative) back to unclaimed.
 * Mirrors updateTentativeBankFileMatch's unlink SQL (lead-services.js), with an extra
 * fresh_lead_id guard so a row is only released if it's still owned by this claim.
 * @param {String|null} previous_bank_file_id
 * @param {String|null} previous_tentative_bank_file_id
 * @param {String} fresh_lead_id
 */
exports.releaseMatchedBankFileSource = async (previous_bank_file_id, previous_tentative_bank_file_id, fresh_lead_id) => {
  if (previous_bank_file_id) {
    const query = `UPDATE ru_dsa_bank_files SET lead_claimed = 0, fresh_lead_id = NULL WHERE bank_file_id = ? AND fresh_lead_id = ?`;
    await _db2.query(query, {
      replacements: [previous_bank_file_id, fresh_lead_id],
      type: QueryTypes.UPDATE
    });
  }

  if (previous_tentative_bank_file_id) {
    const query = `UPDATE ru_dsa_tentative_bank_files SET claimed = 0, fresh_lead_id = NULL WHERE bank_file_id = ? AND fresh_lead_id = ?`;
    await _db2.query(query, {
      replacements: [previous_tentative_bank_file_id, fresh_lead_id],
      type: QueryTypes.UPDATE
    });
  }
};

/**
 * Upsert function to insert or update is_tentative_matched and tentative_bank_file_id 
 * in ru_fresh_lead_claims_meta table based on fresh_lead_id
 * @param {String} fresh_lead_id - The fresh lead ID to search for
 * @param {Number} is_tentative_matched - 1 if matched, 0 if not matched
 * @param {String|null} tentative_bank_file_id - The bank file ID if matched, null otherwise
 * @returns {Promise<Object>} - Result object with success status
 */
exports.upsertTentativeMatchMeta = async (fresh_lead_id, is_tentative_matched, tentative_bank_file_id = null) => {
  const now = new Date();

  const query = `
    INSERT INTO ru_fresh_lead_claims_meta 
      (fresh_lead_id, is_tentative_matched, tentative_bank_file_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      is_tentative_matched = VALUES(is_tentative_matched),
      tentative_bank_file_id = VALUES(tentative_bank_file_id),
      updated_at = VALUES(updated_at)
  `;

  const bindParams = [
    fresh_lead_id,
    is_tentative_matched,
    tentative_bank_file_id,
    now,
    now
  ];

  await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

  return {
    success: true,
    fresh_lead_id,
    is_tentative_matched,
    tentative_bank_file_id
  };
};

/**
 * Insert or update ru_fresh_lead_claims_meta. Centralizes meta persistence for lead forms.
 * @param {Object} params
 * @param {string} params.fresh_lead_id
 * @param {boolean} params.confirmation_required
 * @param {string|null} params.cc_email - raw from request; will be sanitized for storage
 * @param {string|null} params.banker_email - for sanitization
 * @param {string|null} params.user_email - loggedInUser.userEmail for sanitization
 * @param {number|null} params.banker_id
 * @param {number|null} params.asm_id
 * @param {string|null} params.expected_billing_month
 * @param {number} params.is_tentative_matched
 * @param {string|null} params.tentative_bank_file_id
 * @param {number} [params.is_bank_file_matched]
 * @param {string|null} [params.bank_file_id]
 * @param {number} params.is_online_lead
 * @param {boolean} params.isInsert - true for INSERT, false for UPDATE
 * @param {Object} [params.bankFileMatchResult] - Result from matchLeadBankFile; claims source row when matched
 */
exports.insertOrUpdateLeadMeta = async (params) => {
  const cc_email_sanitized = buildCcEmailString(params.cc_email, {
    remove: ["cc@ruloans.com", params.banker_email, params.user_email]
  }) || null;

  const is_tentative_matched = params.is_tentative_matched ? 1 : 0;
  const tentative_bank_file_id = params.tentative_bank_file_id || null;
  const is_bank_file_matched = params.is_bank_file_matched ? 1 : 0;
  const bank_file_id = params.bank_file_id || null;
  const expected_billing_month = exports.deriveBillingMonthFromIso(params.expected_billing_month);
  const now = new Date();

  if (params.isInsert) {
    const query = `INSERT INTO ru_fresh_lead_claims_meta(fresh_lead_id, confirmation_required, cc_email, banker_id, asm_id, expected_billing_month, is_tentative_matched, tentative_bank_file_id, is_bank_file_matched, bank_file_id, is_online_lead, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const bindParams = [
      params.fresh_lead_id,
      params.confirmation_required ? 1 : 0,
      cc_email_sanitized,
      params.banker_id,
      params.asm_id,
      expected_billing_month,
      is_tentative_matched,
      tentative_bank_file_id,
      is_bank_file_matched,
      bank_file_id,
      params.is_online_lead ? 1 : 0,
      now,
      now
    ];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
  } else {
    const query = `UPDATE ru_fresh_lead_claims_meta SET confirmation_required=?, cc_email=?, banker_id=?, asm_id=?, expected_billing_month=?, is_tentative_matched=?, tentative_bank_file_id=?, is_bank_file_matched=?, bank_file_id=?, is_online_lead=?, mail_status = CASE WHEN confirmation_required = 1 AND ? = 0 THEN 'EMAIL_CLOSED' ELSE mail_status END, mail_closed_at = CASE WHEN confirmation_required = 1 AND ? = 0 THEN ? ELSE mail_closed_at END, updated_at=? WHERE fresh_lead_id=?`;
    const bindParams = [
      params.confirmation_required ? 1 : 0,
      cc_email_sanitized,
      params.banker_id,
      params.asm_id,
      expected_billing_month,
      is_tentative_matched,
      tentative_bank_file_id,
      is_bank_file_matched,
      bank_file_id,
      params.is_online_lead ? 1 : 0,
      params.confirmation_required ? 1 : 0,
      params.confirmation_required ? 1 : 0,
      now,
      now,
      params.fresh_lead_id
    ];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
  }

  if (params.bankFileMatchResult?.is_matched) {
    await exports.claimMatchedBankFileSource(params.bankFileMatchResult, params.fresh_lead_id);
  }
};

/**
 * When fresh_lead_status_id moves to 0 (pending): confirmation_required=0;
 * if confirmation was required (mail was sent), mark mail as EMAIL_CLOSED.
 * @param {string|string[]} fresh_lead_ids
 */
exports.syncMetaOnStatusZero = async (fresh_lead_ids) => {
  const ids = Array.isArray(fresh_lead_ids) ? fresh_lead_ids : [fresh_lead_ids];
  if (!ids.length) return;

  const now = new Date();
  const query = `
    UPDATE ru_fresh_lead_claims_meta
    SET confirmation_required = 0,
        mail_status = 'EMAIL_CLOSED',
        mail_closed_at = ?,
        updated_at = ?
    WHERE fresh_lead_id IN (?)
  `;
  await _db2.query(query, { replacements: [now, now, ids], type: QueryTypes.UPDATE });
};

/**
 * Persist successful banker outbound email metadata.
 * @param {string} fresh_lead_id
 * @param {string} mail_thread_id - Provider message/thread id
 * @param {{ preserveThread?: boolean }} [options]
 */
exports.updateLeadMailMetaOnSendSuccess = async (fresh_lead_id, mail_thread_id, options = {}) => {
  if (!fresh_lead_id) return;
  const now = new Date();
  const { preserveThread = false } = options;

  if (preserveThread) {
    const query = `
      UPDATE ru_fresh_lead_claims_meta
      SET mail_status = 'EMAIL_SENT',
          mail_failure_reason = NULL,
          updated_at = ?
      WHERE fresh_lead_id = ?
    `;
    await _db2.query(query, {
      replacements: [now, fresh_lead_id],
      type: QueryTypes.UPDATE
    });
    return;
  }

  const query = `
    UPDATE ru_fresh_lead_claims_meta
    SET mail_thread_id = ?,
        mail_status = 'EMAIL_SENT',
        mail_sent_at = ?,
        mail_failure_reason = NULL,
        updated_at = ?
    WHERE fresh_lead_id = ?
  `;
  await _db2.query(query, {
    replacements: [mail_thread_id || null, now, now, fresh_lead_id],
    type: QueryTypes.UPDATE
  });
};

/**
 * Persist failed banker outbound email metadata (no thread id).
 * @param {string} fresh_lead_id
 * @param {string} [failureReason]
 */
/**
 * After CRM user replies on an existing banker thread: keep thread id and EMAIL_RECEIVED.
 * @param {string} fresh_lead_id
 */
exports.updateLeadMailMetaOnCrmReply = async (fresh_lead_id) => {
  if (!fresh_lead_id) return;
  const now = new Date();
  const query = `
    UPDATE ru_fresh_lead_claims_meta
    SET mail_status = 'EMAIL_RECEIVED',
        mail_failure_reason = NULL,
        updated_at = ?
    WHERE fresh_lead_id = ?
  `;
  await _db2.query(query, {
    replacements: [now, fresh_lead_id],
    type: QueryTypes.UPDATE
  });
};

exports.updateLeadMailMetaOnSendFailure = async (fresh_lead_id, failureReason) => {
  if (!fresh_lead_id) return;
  const now = new Date();
  const reason = (failureReason || '').toString().slice(0, 500) || null;
  const query = `
    UPDATE ru_fresh_lead_claims_meta
    SET mail_status = 'EMAIL_FAILED',
        mail_failed_at = ?,
        mail_failure_reason = ?,
        updated_at = ?
    WHERE fresh_lead_id = ?
  `;
  await _db2.query(query, {
    replacements: [now, reason, now, fresh_lead_id],
    type: QueryTypes.UPDATE
  });
};

const PRODUCT_CATEGORY_BUSINESS_CATEGORY_MAP = {
  insurance_lpp: 9,
  insurance_other: 10,
};

const OTHER_BUSINESS_CATEGORY = 12;
const OTHER_BUSINESS_ALLOWED_PRODUCT_IDS = new Set(["645", "715", "720", "1222"]);

/**
 * Enforces business_categories when product category is insurance_lpp or insurance_other,
 * and restricts Other Business (12) to specific product IDs.
 * @param {Object} params
 * @param {number|string} params.netsuite_product_id
 * @param {number|string} params.business_categories
 * @returns {Promise<Object>} { isValid: boolean, message: string|null }
 */
exports.validateProductBusinessCategory = async ({ netsuite_product_id, business_categories }) => {
  const productIdStr = (netsuite_product_id ?? "").toString().trim();
  if (!productIdStr) return { isValid: true, message: null };

  const businessCategoryNum = Number(business_categories);
  if (
    businessCategoryNum === OTHER_BUSINESS_CATEGORY &&
    !OTHER_BUSINESS_ALLOWED_PRODUCT_IDS.has(productIdStr)
  ) {
    return {
      isValid: false,
      message: `Other Business (12) Business Category is not allowed for this product`,
    };
  }

  const { findProductNameById } = require("./lead-services");
  const product = await findProductNameById(productIdStr);
  if (!product) {
    return { isValid: false, message: `Product not found: ${productIdStr}` };
  }

  const normalizedCategory = formatEventName(product.category);
  const requiredBusinessCategory = PRODUCT_CATEGORY_BUSINESS_CATEGORY_MAP[normalizedCategory];
  if (requiredBusinessCategory == null) {
    return { isValid: true, message: null };
  }

  if (businessCategoryNum !== requiredBusinessCategory) {
    return {
      isValid: false,
      message: `For ${product.product_name} product, business category must be ${product.category || ''} / (${requiredBusinessCategory})`,
    };
  }

  return { isValid: true, message: null };
};

/**
 * Payout rate/ratio rules first; product business category rules after (skipped for valid in-house).
 * @param {Object} params
 * @param {number|string} params.netsuite_product_id
 * @param {number|string} params.business_categories
 * @param {string} params.payout_type
 * @param {number} params.payout_ratio
 * @param {number} params.payout_rate
 * @returns {Promise<Object>} { isValid: boolean, message: string|null }
 */
exports.validateLeadPayoutAndBusinessCategory = async (params) => {
  const payoutResult = exports.validatePayoutDetails({
    business_categories: params.business_categories,
    payout_type: params.payout_type,
    payout_ratio: params.payout_ratio,
    payout_rate: params.payout_rate,
  });
  if (!payoutResult.isValid) return payoutResult;

  const rateRatioLimitResult = await exports.validatePayoutRateRatioLimits({
    netsuite_product_id: params.netsuite_product_id,
    payout_type: params.payout_type,
    payout_ratio: params.payout_ratio,
    payout_rate: params.payout_rate,
    isFinanceRoot: params.isFinanceRoot,
  });
  if (!rateRatioLimitResult.isValid) return rateRatioLimitResult;

  if (Number(params.business_categories) === inHouseCategory) {
    return { isValid: true, message: null };
  }

  return exports.validateProductBusinessCategory({
    netsuite_product_id: params.netsuite_product_id,
    business_categories: params.business_categories,
  });
};

/**
 * The bank/product payout reference row — `avg_achievment` (sic, the column really is
 * spelled that way) and `max_payout_capping`.
 *
 * Exists so the payout-sharing pair cap can read `avg_achievment` **directly**.
 * `validateVendorPayoutNew` also returns it, but it early-returns
 * `{ payout_collide: true, avg_achievment: 0 }` for any DSA with no
 * `assigning_payout_percentage` (`dsa-services.js:9177-9182`) — sourcing the cap from
 * there would silently make it `0` and reject every pair for those DSAs.
 *
 * Also returns the covering period's `max_payout_amount` — the per-period maximum
 * disbursement amount, see `getMaxDisbursementAmountMessage`.
 *
 * @returns {Promise<{avg_achievment: number, max_payout_capping: number|null, max_payout_amount: number|null}|null>}
 */
exports.getBankProductCombination = async (bank_id, product_id, disb_date) => {
  const query = ` SELECT d.avg_achievment, bpc.max_payout_capping, d.max_payout_amount
    FROM ru_bank_product_combinations bpc
    LEFT JOIN LATERAL (
      SELECT d1.avg_achievment, d1.max_payout_amount
      FROM ru_bank_product_combination_details d1
      WHERE d1.bank_product_combinations_id = bpc.bank_product_combinations_id
        AND (d1.applicable_from IS NULL OR d1.applicable_from <= ?)
        AND (d1.applicable_till IS NULL OR d1.applicable_till >= ?)
      ORDER BY d1.applicable_from DESC, d1.id DESC
      LIMIT 1
    ) d ON true
    WHERE bpc.bank_id = ? AND bpc.product_id = ? `;
  const [row] = await _db2.query(query, {
    replacements: [disb_date, disb_date, bank_id, product_id],
    type: QueryTypes.SELECT
  }) || [];
  return row || null;
};

/**
 * Disbursement amount vs the bank/product's `max_payout_amount` for the period covering
 * the disbursement date. NULL/0 means no limit is configured. Shared by every claim entry
 * point and the ERP gate; callers map the result to their own error type.
 *
 * Skips (returns null) when the amount, bank, product or date is missing — the ERP gate
 * always has a date (`LeadDisbursementDateValidator`) and is the backstop.
 *
 * @returns {Promise<string|null>} User-facing message if the amount exceeds the limit; null otherwise.
 */
exports.getMaxDisbursementAmountMessage = async ({ netsuite_bank_id, netsuite_product_id, disbursement_amount, disbursement_date_iso }) => {
  const amount = Number(disbursement_amount);
  if (!Number.isFinite(amount) || !netsuite_bank_id || !netsuite_product_id || !disbursement_date_iso) {
    return null;
  }

  const combination = await exports.getBankProductCombination(netsuite_bank_id, netsuite_product_id, disbursement_date_iso);
  const maxAmount = Number(combination?.max_payout_amount);
  if (!(maxAmount > 0) || amount <= maxAmount) {
    return null;
  }

  const formatInr = (n) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return `Maximum Disbursement Amount for this product is ${formatInr(maxAmount)} only.`;
};

const MAX_PAYOUT_RATE = 5;
const RATE_CAP_EXEMPT_CATEGORIES = new Set(['insurance_other']);

exports.validatePayoutRateRatioLimits = async ({ netsuite_product_id, payout_type, payout_ratio, payout_rate, isFinanceRoot = false }) => {
  if (isFinanceRoot) {
    return { isValid: true, message: null };
  }

  const payoutTypeLower = payout_type?.toLowerCase();

  if (payoutTypeLower === 'ratio') {
    const ratioNum = parseFloat(payout_ratio);
    if (ratioNum > 0 && ratioNum < 1) {
      return { isValid: false, message: `Payout Ratio cannot be between 0.01% and 0.99%.` };
    }
    return { isValid: true, message: null };
  }

  if (payoutTypeLower === 'rate') {
    const rateNum = parseFloat(payout_rate);
    if (rateNum > MAX_PAYOUT_RATE) {
      const { findProductNameById } = require("./lead-services");
      const product = await findProductNameById(netsuite_product_id.toString().trim());
      const normalizedCategory = formatEventName(product?.category);
      if (normalizedCategory && !RATE_CAP_EXEMPT_CATEGORIES.has(normalizedCategory)) {
        return { isValid: false, message: `Payout Rate cannot exceed ${MAX_PAYOUT_RATE}%.` };
      }
    }
  }

  return { isValid: true, message: null };
};

/**
 * Validate payout details based on business category and payout type
 * @param {Object} params
 * @param {Number|String} params.business_categories
 * @param {String} params.payout_type
 * @param {Number} params.payout_ratio
 * @param {Number} params.payout_rate
 * @returns {Object} { isValid: boolean, message: string|null }
 */
exports.validatePayoutDetails = ({ business_categories, payout_type, payout_ratio, payout_rate }) => {
  /**
   * Rule 1 — In-house (inHouseCategory): ALL three values are locked.
   *   • Payout Type must be "Rate"
   *   • Payout Rate must be exactly 0
   *   No other combination is valid for this category.
   *
   * Rule 2 — All other categories:
   *   • Rate and Ratio can never be zero; must be > 0.
   */
  const businessCategoryNum = Number(business_categories);
  const payoutTypeLower = payout_type?.toLowerCase();

  // ── Rule 1: In-house category ────────────────────────────────────────────
  if (businessCategoryNum === inHouseCategory) {
    if (payoutTypeLower !== 'rate') {
      return { isValid: false, message: `In-house business category must use Payout Type: Rate.` };
    }
    if (parseFloat(payout_rate) !== 0) {
      return { isValid: false, message: `In-house business category must have Payout Rate set to 0.` };
    }
    return { isValid: true, message: null };
  }

  // ── Rule 2: All other categories — zero is never allowed ─────────────────
  if (payoutTypeLower === 'ratio') {
    if (!payout_ratio || !parseFloat(payout_ratio) || parseFloat(payout_ratio) <= 0) {
      return { isValid: false, message: `Payout Ratio is required and must be greater than 0%.` };
    }
  }

  if (payoutTypeLower === 'rate') {
    if (!payout_rate || !parseFloat(payout_rate) || parseFloat(payout_rate) <= 0) {
      return { isValid: false, message: `Payout Rate is required and must be greater than 0.` };
    }
  }

  return { isValid: true, message: null };
};

exports.validateDisbursementDate = (disbursement_date) => {
  if (!disbursement_date) return { isValid: true };

  const disbursementDate = new Date(disbursement_date);
  disbursementDate.setHours(0, 0, 0, 0);

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  // Calculate the difference in milliseconds
  const diffTime = Math.abs(currentDate - disbursementDate);
  // Convert to days
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > MAX_DISB_DATE_INTERVAL) {
    return {
      isValid: false,
      message: `Disbursement date should not be more than ${MAX_DISB_DATE_INTERVAL} days old`
    };
  }

  return { isValid: true };
};

exports.isPddClearingDateStale = (pdd_clearing_date) => {
  if (!pdd_clearing_date) return false;

  const pddDate = new Date(pdd_clearing_date);
  pddDate.setHours(0, 0, 0, 0);

  const now = new Date();
  const lastMonthFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return pddDate < lastMonthFirst;
};

exports.validateReconciliationDiscrepancies = async ({
  loan_number, application_no, disbursement_date, pdd_clearing_date,
  netsuite_bank_id, netsuite_product_id,
}) => {
  if (!loan_number) return { isValid: false, message: 'Loan number missing in reconciliation data' };
  if (!application_no) return { isValid: false, message: 'APAC/Application number missing in reconciliation data' };

  // Regex format check intentionally not duplicated here — updateLeadByReconciliation
  // (called right after this by the only caller, autoProgressLeadFromReconciliation)
  // already runs checkIfLoanAndApacNumberIsValid before writing these fields.

  // Disbursement date check disabled: this data comes from banker confirmation emails, not manual entry
  // const dateCheck = exports.validateDisbursementDate(disbursement_date);
  // if (!dateCheck.isValid) return { isValid: false, message: dateCheck.message };

  if (exports.isPddClearingDateStale(pdd_clearing_date)) {
    return { isValid: false, message: `PDD clearing date (${pdd_clearing_date}) is before the 1st of last month` };
  }

  return { isValid: true, message: null };
};

// Format + conditional-mandatory validation for the MANUAL banker-confirmation save path
// (updateLeadByReconciliation controller only — NOT used by autoProgressLeadFromReconciliation,
// which stays on validateReconciliationDiscrepancies above per the earlier decision to keep the
// automated and manual paths separate).
exports.validateManualReconciliationSave = ({
  claim_confirmation, loan_number, application_no, loan_amount, ns_audit_remark, expected_billing_month
}) => {
  const hasValue = (v) => String(v ?? '').trim() !== '';

  if (hasValue(loan_amount)) {
    const cleaned = String(loan_amount).replace(/,/g, '').replace(/\s/g, '').replace(/[^\d.-]/g, '');
    if (cleaned === '' || Number.isNaN(Number(cleaned))) {
      return { isValid: false, message: 'Loan amount must be a number.' };
    }
  }

  const normalized = formatEventName(claim_confirmation) || '';

  if (normalized === 'verified' || normalized === 'verified_with_exception') {
    if (!loan_number || !application_no) {
      return { isValid: false, message: 'Loan Number and Application/APAC Number are required when Claim Confirmation is Verified or Verified with Exception' };
    }
  }
  if (normalized === 'verified') {
    if (!expected_billing_month) {
      return { isValid: false, message: 'PDD Clearing Date is required when Claim Confirmation is Verified' };
    }
  }
  if (normalized === 'custom_remark') {
    if (!ns_audit_remark) {
      return { isValid: false, message: 'Audit remark is required when Claim Confirmation is Custom Remark' };
    }
  }
  return { isValid: true, message: null };
};

exports.deriveBillingMonthFromIso = (billing_date_iso) => {
  if (!billing_date_iso) return null;

  const str = String(billing_date_iso).trim();
  if (/^[A-Za-z]{3,9}\s+\d{4}$/.test(str)) return str;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const billingDate = new Date(billing_date_iso);
  billingDate.setHours(0, 0, 0, 0);

  if (Number.isNaN(billingDate.getTime())) return null;

  const monthName = monthNames[billingDate.getMonth()];
  const year = billingDate.getFullYear();

  return `${monthName} ${year}`;
};

exports.deriveClaimMonthFromDisbDate = (disbursement_date_iso) => {
  if (!disbursement_date_iso) return null;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const disbursementDate = new Date(disbursement_date_iso);
  disbursementDate.setHours(0, 0, 0, 0);

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  let targetDate;

  // If disbursement date is in current month & year
  if (
    disbursementDate.getMonth() === currentDate.getMonth() &&
    disbursementDate.getFullYear() === currentDate.getFullYear()
  ) {
    targetDate = currentDate;
  } else {
    // Previous month relative to CURRENT DATE
    targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
  }

  const monthName = monthNames[targetDate.getMonth()];
  const year = targetDate.getFullYear();

  return `${monthName} ${year}`;
};

exports.compareDisbursementAmount = ({ leadAmount, bankAmount }) => {
  const parseAmount = (value) => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
      const normalized = value.trim().replace(/,/g, "");
      if (!normalized) return null;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  // Preserve legacy behavior: if there's no bank amount to compare against, skip the check.
  if (bankAmount === null || bankAmount === undefined || bankAmount === "") {
    return { isValid: true, message: null };
  }

  const normalizedLeadAmount = parseAmount(leadAmount);
  const normalizedBankAmount = parseAmount(bankAmount);

  if (normalizedLeadAmount === null || normalizedBankAmount === null) {
    return {
      isValid: false,
      message: "Invalid disbursement amount for bank file comparison"
    };
  }

  if (normalizedLeadAmount > normalizedBankAmount) {
    return {
      isValid: false,
      message: `Disbursement amount mismatch found with matched bank file. Lead Amount: ${normalizedLeadAmount} , Bank File Amount: ${normalizedBankAmount}`
    };
  }
  return {
    isValid: true,
    message: null
  };
};