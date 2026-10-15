const repo = require('./leadReferenceRepository');
const { getPayoutRoleRule, maskCrossTeamPayoutDetails } = require('./payoutMasking');

/**
 * Fetches the source lead's multi-funded/duplicate matches (Lead Reference
 * Comparison), masking each matched lead's payout fields the viewer isn't
 * allowed to see (see payoutMasking.js). Returns:
 * - null if fresh_lead_id doesn't resolve to a lead, or its product can't be resolved
 * - an array of matched lead rows otherwise (possibly empty)
 */
const getLeadFormReference = async (fresh_lead_id, viewer) => {
    const roleRule = await getPayoutRoleRule(viewer?.role);

    const sourceLead = await repo.findSourceLead(fresh_lead_id);
    if (!sourceLead) {
        return null;
    }

    const {
        customer_first_name,
        customer_last_name,
        disbursement_month,
        netsuite_bank_id,
        netsuite_vendor_id,
        netsuite_product_id,
        loan_reference_id,
        loan_apac_ref_los_number,
        disbursement_amount,
        id,
        city,
        dsa_id
    } = sourceLead;

    const productData = await repo.findProductMainProduct(netsuite_product_id);
    if (!productData || !productData.main_product) {
        return null;
    }

    const product_loan_type = productData.main_product
        .toLowerCase()
        .replace(/\s+/g, '_');

    let finalResult = [];

    /**
     * =========================================================
     * PERSONAL LOAN MULTI FUNDED REFERENCES
     * =========================================================
     */
    if (product_loan_type == "personal_loan") {
        const personalLoanMatches = await repo.findPersonalLoanMultiFundedReferences({
            customer_first_name,
            customer_last_name,
            disbursement_month,
            netsuite_bank_id,
            netsuite_vendor_id,
            city,
            id
        });

        if (personalLoanMatches.length) {
            finalResult.push(...personalLoanMatches);
        }
    }

    /**
     * =========================================================
     * COMMON DUPLICATE REFERENCES
     * =========================================================
     */

    if (!disbursement_amount || !netsuite_bank_id || !disbursement_month) {
        return maskCrossTeamPayoutDetails(finalResult, viewer, roleRule);
    }

    const commonDuplicateMatches = await repo.findCommonDuplicateReferences({
        customer_first_name,
        customer_last_name,
        loan_reference_id,
        loan_apac_ref_los_number,
        disbursement_amount,
        netsuite_bank_id,
        disbursement_month,
        id
    });

    if (commonDuplicateMatches.length) {
        for (let i = 0; i < commonDuplicateMatches.length; i++) {
            const db_row = commonDuplicateMatches[i];

            // avoid duplicate push
            const alreadyExists = finalResult.find(
                x => x.id == db_row.id
            );

            if (!alreadyExists) {
                finalResult.push(db_row);
            }
        }
    }

    return maskCrossTeamPayoutDetails(finalResult, viewer, roleRule);
};

module.exports = {
    getLeadFormReference
};
