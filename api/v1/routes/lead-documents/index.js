
let LeadDocumentControllerV1 = require(_pathconst.ControllersPath.LeadDocumentControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");


const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);



router.post("/createLeadDocument", AuthHelper.authorize, aclPermissions.getPermissions, LeadDocumentControllerV1.create);
router.post("/getLeadDocumentType", AuthHelper.authorize, aclPermissions.getPermissions, LeadDocumentControllerV1.getLeadDocumentType);
router.post("/getLeadDocuments", AuthHelper.authorize, aclPermissions.getPermissions, LeadDocumentControllerV1.getLeadDocuments);


module.exports = router;