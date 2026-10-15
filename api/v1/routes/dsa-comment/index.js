let DsaCommentControllerV1 = require(_pathconst.ControllersPath.DsaCommentControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');

const express = require("express");


const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/getComment", AuthHelper.authorize, RBACMiddleware.authorize(["dsa_channel_partners","customers_customers"], 'read'), DsaCommentControllerV1.getComment);
router.post("/createComment", AuthHelper.authorize, RBACMiddleware.authorize(["dsa_channel_partners","customers_customers"], 'create'), DsaCommentControllerV1.createComment);

module.exports = router;