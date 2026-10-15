let TagControllerV1 = require(_pathconst.ControllersPath.TagControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
router.post("/getTag", AuthHelper.authorize, aclPermissions.getPermissions, TagControllerV1.get);
router.post("/addTag", AuthHelper.authorize, aclPermissions.getPermissions, TagControllerV1.create);
router.post("/removeTag", AuthHelper.authorize, aclPermissions.getPermissions, TagControllerV1.deleteTag);
router.post("/getTagsForLead", AuthHelper.authorize, aclPermissions.getPermissions, TagControllerV1.getLeadTag);
router.post("/modifyTag", AuthHelper.authorize, aclPermissions.getPermissions, TagControllerV1.modifyTag);

module.exports = router;