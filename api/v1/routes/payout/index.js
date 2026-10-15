let PayoutControllerV1 = require(_pathconst.ControllersPath.PayoutControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
router.post("/getBankForPayout",AuthHelper.authorize, aclPermissions.getPermissions, PayoutControllerV1.getBank);
router.post("/getProductGroupForPayout",AuthHelper.authorize, aclPermissions.getPermissions, PayoutControllerV1.getProductGroup);
router.post("/getMainProductForPayout",AuthHelper.authorize, aclPermissions.getPermissions, PayoutControllerV1.getMainProduct);
router.post("/getProductForPayout",AuthHelper.authorize, aclPermissions.getPermissions, PayoutControllerV1.getProduct);
router.post("/getPayout",AuthHelper.authorize, aclPermissions.getPermissions, PayoutControllerV1.getPayout);
router.post("/getBankForPayoutExternal",AuthHelper.authorizeDsa, PayoutControllerV1.getBank);
router.post("/getProductGroupForPayoutExternal",AuthHelper.authorizeDsa, PayoutControllerV1.getProductGroup);
router.post("/getMainProductForPayoutExternal",AuthHelper.authorizeDsa, PayoutControllerV1.getMainProduct);
router.post("/getProductForPayoutExternal",AuthHelper.authorizeDsa, PayoutControllerV1.getProduct);
router.post("/getPayoutExternal",AuthHelper.authorizeDsa, PayoutControllerV1.getPayout);


module.exports = router;