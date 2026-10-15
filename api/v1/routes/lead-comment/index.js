let LeadCommentControllerV1 = require(_pathconst.ControllersPath.LeadCommentControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
router.post("/createLeadComment", AuthHelper.authorize, aclPermissions.getPermissions, LeadCommentControllerV1.create);
router.post("/updateLeadComment", AuthHelper.authorize, aclPermissions.getPermissions, LeadCommentControllerV1.update);
router.post("/deleteLeadComment", AuthHelper.authorize, aclPermissions.getPermissions, LeadCommentControllerV1.deleteComment);
router.post("/getAllComments", AuthHelper.authorize, aclPermissions.getPermissions, LeadCommentControllerV1.getAllComments);


module.exports = router;