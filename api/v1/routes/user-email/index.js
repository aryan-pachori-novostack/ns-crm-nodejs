let UserEmailControllerV1 = require(_pathconst.ControllersPath.UserEmailControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
router.post("/sendEmail", AuthHelper.authorize,  UserEmailControllerV1.sendEmail);
router.post("/getEmails", AuthHelper.authorize,  UserEmailControllerV1.getEmails);


module.exports = router;