const leadReferenceService = require('./leadReferenceService');

/**
 * Intended for `safe(handler, {envelope: 'v1'})`-wrapped routes: returns
 * `{ success, message, statusCode, data }`. Request body validation is done by
 * `reqValidator` in the route (LeadValidationV1.getLeadFormReference).
 *
 * Body:
 * - fresh_lead_id (required)
 */
exports.getLeadFormReference = async (req) => {
    const { fresh_lead_id } = req.body;
    const viewer = {
        dsa_id: req.loggedInUser?.dsa_id,
        role: req.loggedInUser?.role
    };
    const data = await leadReferenceService.getLeadFormReference(fresh_lead_id, viewer);
    return { success: true, message: "Success", statusCode: 200, data };
};
