let BillsControllerV1 = require(_pathconst.ControllersPath.BillsControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js')
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

// getExpenses serves Vendor Bills / Analytics / Office Expenses from one endpoint,
// distinguished by req.body.category -- export permission is checked against
// whichever specific module this particular export request actually targets.
const authorizeGetExpensesExport = (req, res, next) => {
    if (req.body?.type !== 'Export') return next();
    const moduleAlias = req.body?.category === 'invoices'
        ? 'finance_invoices_invoices'
        : req.body?.category === 'analytics'
            ? 'finance_invoices_analytics'
            : 'finance_invoices_office_expenses';
    return ExportMiddleware.authorizeExport(moduleAlias)(req, res, next);
};

router.post("/createBillsExternal", AuthHelper.authorizeDsaCentralized, BillsControllerV1.createBills);
router.post("/updateBillStatusExternal", AuthHelper.authorizeDsaCentralized, BillsControllerV1.updateBillStatus);
router.post("/getExpensesExternal", AuthHelper.authorizeDsaCentralized, BillsControllerV1.getExpenses);
router.post("/getInvoicesExternal", AuthHelper.authorizeDsaCentralized, BillsControllerV1.getInvoices);
router.post("/getExpenseItemsExternal", AuthHelper.authorizeDsaCentralized, BillsControllerV1.getExpenseItems);
router.post("/getExpensesForEditExternal", AuthHelper.authorizeDsaCentralized, BillsControllerV1.getExpensesForEdit);
router.post("/getConsolidatedExpensesExternal", AuthHelper.authorizeDsaCentralized,BillsControllerV1.getConsolidatedExpenses);
router.post("/getInvoiceDetailsExternal", AuthHelper.authorizeDsaCentralized, BillsControllerV1.getInvoiceDetails);
router.post("/getInvoiceCompanyandBankDetailsExternal", AuthHelper.authorizeDsaCentralized, BillsControllerV1.getInvoiceCompanyandBankDetails);
router.post("/createBills", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.createBills);
router.post("/updateBillStatus", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.updateBillStatus);
router.post("/getExpenses", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), authorizeGetExpensesExport, BillsControllerV1.getExpenses);
router.post("/getExpenseItems", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getExpenseItems);
router.post("/deleteExpense", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.deleteExpense);
router.post("/deleteExpenseItems", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.deleteExpenseItems);
router.post("/getBbpsPayments", AuthHelper.authorize, RBACMiddleware.authorize('applications_bbps_recharge', 'read'), ExportMiddleware.authorizeExport('applications_bbps_recharge', (req) => req.body?.is_export === true), BillsControllerV1.getBbpsPayments);
router.post("/getBbpsPaymentCategoryWise", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_recharge', 'read'), BillsControllerV1.getBbpsPaymentCategoryWise);
router.post("/getBbpsPaymentDateWise", AuthHelper.authorize, RBACMiddleware.authorize('applications_bbps_recharge', 'read'), BillsControllerV1.getBbpsPaymentDateWise);
router.post("/getSimilarBills", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getSimilarBills);
router.post("/getVendorDetailsByExpenseId", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getVendorDetailsByExpenseId);
router.post("/mapDsaToVendorInvoices", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.mapDsaToVendorInvoices);
router.post("/getExpensesForEdit", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getExpensesForEdit);
router.post("/getConsolidatedExpenses", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getConsolidatedExpenses);
router.post("/getInvoiceDetails", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getInvoiceDetails);
router.post("/getInvoiceCompanyandBankDetails", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getInvoiceCompanyandBankDetails);
router.post("/getActivityLogs", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getActivityLogs);
router.post("/rejectInvoice", AuthHelper.authorize, aclPermissions.getPermissions, BillsControllerV1.rejectInvoice);
router.post("/rejectInvoiceExternal", AuthHelper.authorizeDsaCentralized,  BillsControllerV1.rejectInvoice);
router.post("/updateInvoiceContact", AuthHelper.authorize, aclPermissions.getPermissions, BillsControllerV1.updateInvoiceContact);
router.post("/updateInvoiceContactExternal", AuthHelper.authorizeDsaCentralized, BillsControllerV1.updateInvoiceContact);
router.post("/sendBulkInvoiceEmail", AuthHelper.authorize, aclPermissions.getPermissions, BillsControllerV1.sendBulkInvoiceEmail);
router.post("/sendBulkInvoiceEmailExternal", AuthHelper.externalAuth, BillsControllerV1.sendBulkInvoiceEmail);
router.post("/markItAsRead", AuthHelper.authorizeDsaCentralized, BillsControllerV1.markItAsRead);
router.post("/getAnalytics", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getAnalyticsData);
router.post("/addFavourite", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.addFavourite);
router.post("/removeFavourite", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.removeFavourite);
router.post("/getFavourites", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.getFavourites);
router.post("/setReminder", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.setReminder);
router.post("/checkReminders", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.checkReminders);
router.post("/dismissReminder", AuthHelper.authorize, RBACMiddleware.authorize(['finance_invoices_invoices', 'finance_invoices_analytics', 'finance_invoices_office_expenses'], 'read'), BillsControllerV1.dismissReminder);
module.exports = router;