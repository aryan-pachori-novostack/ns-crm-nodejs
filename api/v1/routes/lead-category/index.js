
let LeadCategoryControllerV1 = require(_pathconst.ControllersPath.LeadCategoryControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");


const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);



router.post("/getLeadCategory",AuthHelper.authorize, aclPermissions.getPermissions, LeadCategoryControllerV1.get);




module.exports = router;