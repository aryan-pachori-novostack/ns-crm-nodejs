let NetsuiteControllerV1 = require(_pathconst.ControllersPath.NetsuiteControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

const express = require("express");

const router = express.Router();


router.post("/updateDetailsFromNSExternal", AuthHelper.authorizeDsaCentralized, NetsuiteControllerV1.updateDetailsFromNS);
router.post("/updateDetailsFromNS", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), NetsuiteControllerV1.updateDetailsFromNS);

module.exports = router;