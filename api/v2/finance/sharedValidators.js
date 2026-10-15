const { SAME_DAY_BILLING_TIME } = require("../../helpers/constantdata/config");
const { PERSONAL_LOAN_NETSUITE_ID } = require("./FinanceConfig");
const LeadService = require("../../services/lead-services");

const PERSONAL_LOAN_MAX_DISBURSEMENT = 9999999;
const PERSONAL_LOAN_HIGH_AMOUNT_MESSAGE =
    "Personal loans with higher loan amounts are not eligible for the autonomous process";

/**
 * Same-day billing window rule shared by ERP and autonomous lead pipelines.
 * Callers map the result to domain errors (ErpError, AutonomousError, etc.).
 *
 * @param {boolean} sameDayBillingRequested
 * @returns {string|null} User-facing message if blocked after cutoff; null if allowed.
 */
function getSameDayBillingPostCutoffMessage(sameDayBillingRequested) {
    if (!sameDayBillingRequested) {
        return null;
    }
    const currentHour = new Date().getHours();
    if (currentHour < SAME_DAY_BILLING_TIME) {
        return null;
    }
    const time = new Date();
    time.setHours(SAME_DAY_BILLING_TIME, 0, 0);
    const formattedTime = time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
    return `Same day billing is not available post ${formattedTime}`;
}

/**
 * @param {string|number|null|undefined} netsuiteProductId
 * @param {object|null|undefined} productRow — row from `ru_netsuite_products` (e.g. `findProductNameById`)
 * @returns {boolean}
 */
function isPersonalLoanProduct(netsuiteProductId, productRow) {
    const pilId = String(PERSONAL_LOAN_NETSUITE_ID);
    if (netsuiteProductId != null && String(netsuiteProductId) === pilId) {
        return true;
    }
    if (!productRow) {
        return false;
    }
    const parentId = productRow.parent_product_id;
    if (parentId != null && String(parentId) === pilId) {
        return true;
    }
    const main = productRow.main_product;
    if (typeof main === "string" && main.toLowerCase().replace(/\s+/g, "_") === "personal_loan") {
        return true;
    }
    return false;
}

/**
 * Personal loan + same-day / to-be-billed: disbursement must not exceed 7 digits (9,999,999).
 * Callers map the result to domain errors (ErpError, AutonomousError, etc.).
 *
 * @param {string|number|null|undefined} netsuite_product_id
 * @param {string|number|null|undefined} disbursement_amount
 * @param {boolean} sameDayBilling
 * @param {boolean} toBeBilled
 * @returns {Promise<string|null>} User-facing message if blocked; null if allowed.
 */
async function getPersonalLoanDisbursementAmountMessage(
    netsuite_product_id,
    disbursement_amount,
    sameDayBilling,
    toBeBilled
) {
    if (!sameDayBilling && !toBeBilled) {
        return null;
    }
    const amountNum = Number(disbursement_amount);
    if (!Number.isFinite(amountNum) || amountNum <= PERSONAL_LOAN_MAX_DISBURSEMENT) {
        return null;
    }

    let productRow = null;
    if (netsuite_product_id != null && String(netsuite_product_id) !== String(PERSONAL_LOAN_NETSUITE_ID)) {
        productRow = await LeadService.findProductNameById(netsuite_product_id);
    }

    const isPl = isPersonalLoanProduct(netsuite_product_id, productRow);
    if (!isPl) {
        return null;
    }
    return PERSONAL_LOAN_HIGH_AMOUNT_MESSAGE;
}

module.exports = {
    getSameDayBillingPostCutoffMessage,
    getPersonalLoanDisbursementAmountMessage
};
