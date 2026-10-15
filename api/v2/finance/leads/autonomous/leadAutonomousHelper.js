const { jsonDifference } = require("../../../../helpers/commonhelper");
const ApplicationLogServices = require("../../../../services/application-log-services");

/**
 * Context for lead autonomous status update (body already validated by route `reqValidator`).
 * @param {import("express").Request} req
 */
function buildLeadAutonomousContext(req) {
    const { fresh_lead_id, same_day_billing, to_be_billed, payout_type, rate, ratio } = req.body;
    return {
        req,
        fresh_lead_id,
        same_day_billing,
        to_be_billed,
        payout_type,
        rate,
        ratio,
        pt: String(payout_type || "").toLowerCase()
    };
}

/**
 * Application log for vendor_payout_type / same_day_billing / to_be_billed (matches v1).
 * @param {object} context — must include `lead`, `pt`, `same_day_billing`, `to_be_billed`, `req`
 */
async function recordLeadAutonomousAudit(context) {
    const { req, lead, same_day_billing, to_be_billed, pt } = context;
    const prevData = {
        vendor_payout_type: lead?.vendor_payout_type || "",
        same_day_billing: !!lead?.same_day_billing,
        to_be_billed: !!lead?.to_be_billed
    };
    const newData = {
        vendor_payout_type: pt,
        same_day_billing: !!same_day_billing,
        to_be_billed: !!to_be_billed
    };
    const difference = jsonDifference({ ...prevData }, { ...newData });
    if (difference.length) {
        await ApplicationLogServices.bulkCreate(difference, lead?.id, "lead_claim_update", req?.loggedInUser?.id);
    }
}

module.exports = {
    buildLeadAutonomousContext,
    recordLeadAutonomousAudit
};
