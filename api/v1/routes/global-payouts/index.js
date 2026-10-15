let GlobalPayoutControllerV1 = require(_pathconst.ControllersPath.GlobalPayoutControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require("../../../helpers/acl-middleware/rbac-middleware.js");
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');

const express = require("express");


const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

const isExportBody = (req) => {
    const { is_export } = req.body || {};
    return is_export === true || is_export === 'true' || is_export === 1;
};

router.post("/createPayouts", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_payouts', 'create'), GlobalPayoutControllerV1.createPayouts);
router.post("/updatePayouts", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_payouts', 'update'), GlobalPayoutControllerV1.updatePayouts);
router.post("/deletePayouts", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_payouts', 'delete'), GlobalPayoutControllerV1.deletePayouts);
router.post("/deleteAllPayouts", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_payouts', 'delete'), GlobalPayoutControllerV1.deleteAllPayouts);
router.post("/getAllPayouts", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_payouts', 'read'), ExportMiddleware.authorizeExport('finance_meta_data_payouts', isExportBody), GlobalPayoutControllerV1.getAllPayouts);
router.post("/uploadPayout", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_payouts', 'create'), GlobalPayoutControllerV1.uploadPayout);
router.post("/findGlobalPayoutsId", AuthHelper.authorize, aclPermissions.getPermissions, GlobalPayoutControllerV1.findGlobalPayoutsId);
router.post("/findGlobalPayoutsIdExternal", AuthHelper.authorizeDsa, GlobalPayoutControllerV1.findGlobalPayoutsId);
router.post("/findPayoutRateForDsa", AuthHelper.authorizeDsaCentralized, GlobalPayoutControllerV1.findGlobalPayoutByBankName);


module.exports = router;