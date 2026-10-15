let ReportControllerV1 = require(_pathconst.ControllersPath.ReportControllerV1);
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

const isExportQuery = (req) => req.query?.export === 'true' || req.query?.export === true;

// get-dsa-lead-response-time-report is shared by two distinct FE pages -- "Lead SP
// Assignment" and "Lead Assignment To Call" (see src/pages/new-reports/lead-sp-assignment
// and lead-assignment-to-call) -- same query shape, but each has its own seeded
// rbac_modules alias (lead_assignment_to_call_report was added later, specifically so the
// two could be granted/exported independently). The FE sends which page it is via
// req.query.moduleName; whitelisted here so a client can't pass an arbitrary alias.
// Unmapped/absent falls back to lead_sp_assignment_report (previous behavior).
const LEAD_RESPONSE_TIME_EXPORT_ALIASES = new Set(['lead_assignment_to_call_report']);
const resolveLeadResponseTimeExportAlias = (req) => {
    const moduleName = req?.query?.moduleName;
    return LEAD_RESPONSE_TIME_EXPORT_ALIASES.has(moduleName) ? moduleName : 'lead_sp_assignment_report';
};

router.get("/get-business-report", AuthHelper.authorize, RBACMiddleware.authorize('applications_reports_application', 'read'), ReportControllerV1.getBusinessReport);
router.get("/get-sales-report", AuthHelper.authorize, RBACMiddleware.authorize('dsa_reports_dsa_sales_report', 'read'), ReportControllerV1.getSalesReport);
router.get("/get-dsa-lead-response-time-report", AuthHelper.authorize, RBACMiddleware.authorize('lead_sp_assignment_report', 'read'), ExportMiddleware.authorizeExport(resolveLeadResponseTimeExportAlias, isExportQuery), ReportControllerV1.dsaLeadResponseTimeReport);
router.get("/get-customer-lead-assign-to-call-report", AuthHelper.authorize, RBACMiddleware.authorize('customer_lead_assign_to_call_report', 'read'), ExportMiddleware.authorizeExport('customer_lead_assign_to_call_report', isExportQuery), ReportControllerV1.customerLeadAssignToCallReport);

module.exports = router;