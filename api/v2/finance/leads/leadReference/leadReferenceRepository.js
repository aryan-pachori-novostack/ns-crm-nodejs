const { QueryTypes } = require('sequelize');
const { _db2 } = require('../../../../../models');

const LEAD_REFERENCE_MATCH_SELECT = `
    flc.id,
    flc.fresh_lead_id,
    flc.is_deleted,
    CASE WHEN flc.user_type = 'company' THEN rc.name ELSE d.full_name END AS dsa_name,
    CASE WHEN flc.user_type = 'company' THEN rc.pan ELSE kyc.permanent_account_number END AS dsa_pan,
    flc.customer_first_name,
    flc.customer_last_name,
    flc.loan_reference_id,
    flc.loan_apac_ref_los_number,
    flc.claim_month,
    flc.disbursement_amount,
    flc.disbursement_date_iso,
    flc.bank_name,
    flc.netsuite_bank_id,
    flc.product_name,
    flc.city,
    flc.business_categories,
    flc.dsa_id,
    flc.vendor_payout_type,
    flc.vendor_payout_rate,
    flc.vendor_payout_ratio,
    flc.current_hierarchy_crm,
    flc.current_hierarchy_path,
    flc.created_at,
    flc.loan_status
`;

const LEAD_REFERENCE_DSA_JOINS = `
    LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = flc.dsa_id
    LEFT JOIN ru_dsa_kyc_data kyc ON d.dsa_id = kyc.dsa_id
    LEFT JOIN ru_companies rc ON flc.user_type = 'company' AND rc.company_id = flc.dsa_id
`;

const ACTIVE_LEAD_FILTERS = `
    and flc.is_deleted = false
    and flc.fresh_lead_status_id <> 3
    and flc.loan_status <> 'rejected'
`;

/** The source lead being viewed (the "Current Lead" column). */
const findSourceLead = async (fresh_lead_id) => {
    const query = ` select flc.id, flc.fresh_lead_id , flc.netsuite_vendor_id , flc.city , MONTH(flc.disbursement_date_iso) as disbursement_month , flc.netsuite_bank_id , flc.netsuite_product_id , flc.customer_first_name , flc.customer_last_name , flc.loan_reference_id , flc.loan_apac_ref_los_number , flc.disbursement_amount , flc.loan_status , flc.business_categories , flc.dsa_id , flc.vendor_payout_type , flc.vendor_payout_rate , flc.vendor_payout_ratio
                  from ru_fresh_lead_claims flc
                  where flc.fresh_lead_id = ? `;

    const result = await _db2.query(query, {
        replacements: [fresh_lead_id],
        type: QueryTypes.SELECT
    });

    return result[0] || null;
};

/** Used to derive product_loan_type (e.g. "personal_loan") for the source lead. */
const findProductMainProduct = async (netsuite_product_id) => {
    const query = ` select main_product
              from ru_netsuite_products
              where netsuite_product_id = ? `;

    const result = await _db2.query(query, {
        replacements: [netsuite_product_id],
        type: QueryTypes.SELECT
    });

    return result[0] || null;
};

/** Personal-loan multi-funded matches: same customer/month/city/vendor, different bank, disbursed. */
const findPersonalLoanMultiFundedReferences = async ({
    customer_first_name,
    customer_last_name,
    disbursement_month,
    netsuite_bank_id,
    netsuite_vendor_id,
    city,
    id
}) => {
    const query = ` select ${LEAD_REFERENCE_MATCH_SELECT}
              from ru_fresh_lead_claims flc
              left join ru_netsuite_products n
                on flc.netsuite_product_id = n.netsuite_product_id COLLATE utf8mb4_general_ci
              ${LEAD_REFERENCE_DSA_JOINS}
              where flc.customer_first_name = ?
                and flc.customer_last_name = ?
                and MONTH(flc.disbursement_date_iso) = ?
                and flc.netsuite_bank_id != ?
                and flc.netsuite_vendor_id = ?
                and flc.loan_status = "disbursed"
                ${ACTIVE_LEAD_FILTERS}
                and flc.city = ?
                and flc.id != ?
                and LOWER(REPLACE(n.main_product, ' ', '_')) = 'personal_loan' `;

    const bindParams = [
        customer_first_name,
        customer_last_name,
        disbursement_month,
        netsuite_bank_id,
        netsuite_vendor_id,
        city,
        id
    ];

    return _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.SELECT
    });
};

/** Common duplicate matches: same amount/bank/month, same customer name or matching loan reference/APAC number. */
const findCommonDuplicateReferences = async ({
    customer_first_name,
    customer_last_name,
    loan_reference_id,
    loan_apac_ref_los_number,
    disbursement_amount,
    netsuite_bank_id,
    disbursement_month,
    id
}) => {
    const identityConditions = ['(flc.customer_first_name = ? and flc.customer_last_name = ?)'];
    let identityBindParams = [customer_first_name, customer_last_name];

    if (loan_reference_id) {
        identityConditions.push('flc.loan_reference_id = ?');
        identityBindParams.push(loan_reference_id);
    }

    if (loan_apac_ref_los_number) {
        identityConditions.push('flc.loan_apac_ref_los_number = ?');
        identityBindParams.push(loan_apac_ref_los_number);
    }

    const query = ` select ${LEAD_REFERENCE_MATCH_SELECT}
          from ru_fresh_lead_claims flc
          ${LEAD_REFERENCE_DSA_JOINS}
          where flc.disbursement_amount = ?
            and flc.netsuite_bank_id = ?
            and MONTH(flc.disbursement_date_iso) = ?
            and (${identityConditions.join(' or ')})
            ${ACTIVE_LEAD_FILTERS}
            and flc.id != ? `;

    const bindParams = [disbursement_amount, netsuite_bank_id, disbursement_month, ...identityBindParams, id];

    return _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.SELECT
    });
};

module.exports = {
    LEAD_REFERENCE_MATCH_SELECT,
    LEAD_REFERENCE_DSA_JOINS,
    findSourceLead,
    findProductMainProduct,
    findPersonalLoanMultiFundedReferences,
    findCommonDuplicateReferences
};
