
let LeadLogControllerV1 = require(_pathconst.ControllersPath.LeadLogControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");


const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);



router.post("/getLeadLog",AuthHelper.authorize, aclPermissions.getPermissions, LeadLogControllerV1.get);




module.exports = router;