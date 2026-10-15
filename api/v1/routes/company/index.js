let CompanyControllerV1 = require(_pathconst.ControllersPath.CompanyControllerV1);
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js')

router.post("/getAllCompany", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), CompanyControllerV1.getAllCompany);
router.post("/getCompanyDetailsById", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), CompanyControllerV1.getCompanyDetailsById);
router.post("/getAllCompanyDocuments", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'read'), CompanyControllerV1.getAllCompanyDocuments);

module.exports = router;