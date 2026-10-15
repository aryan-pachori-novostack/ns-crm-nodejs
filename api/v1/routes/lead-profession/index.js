
let LeadProfessionControllerV1 = require(_pathconst.ControllersPath.LeadProfessionControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");


const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);



router.post("/getLeadProfession",AuthHelper.authorize, aclPermissions.getPermissions, LeadProfessionControllerV1.get);




module.exports = router;