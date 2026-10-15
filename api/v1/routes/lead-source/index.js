
let LeadSourceControllerV1 = require(_pathconst.ControllersPath.LeadSourceControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");


const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);



router.post("/getLeadSource",AuthHelper.authorize, aclPermissions.getPermissions, LeadSourceControllerV1.get);




module.exports = router;