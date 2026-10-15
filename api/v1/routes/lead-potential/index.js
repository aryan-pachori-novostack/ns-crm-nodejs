
let LeadPotentialControllerV1 = require(_pathconst.ControllersPath.LeadPotentialControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");


const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);



router.post("/getLeadPotential",AuthHelper.authorize, aclPermissions.getPermissions, LeadPotentialControllerV1.get);




module.exports = router;