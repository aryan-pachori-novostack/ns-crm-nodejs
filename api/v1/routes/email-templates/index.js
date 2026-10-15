let EmailControllerV1 = require(_pathconst.ControllersPath.EmailControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');

const express = require("express");


const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/createEmail", AuthHelper.authorize, RBACMiddleware.authorize('marketing_email', 'create'), EmailControllerV1.createEmail);
router.post("/updateEmail", AuthHelper.authorize, RBACMiddleware.authorize('marketing_email', 'update'), EmailControllerV1.updateEmail);
router.post("/deleteEmail", AuthHelper.authorize, RBACMiddleware.authorize('marketing_email', 'delete'), EmailControllerV1.deleteEmail);
router.post("/getAllEmail", AuthHelper.authorize, RBACMiddleware.authorize('marketing_email', 'read'), EmailControllerV1.getAll);
router.post("/getEmailById", AuthHelper.authorize, RBACMiddleware.authorize('marketing_email', 'read'), EmailControllerV1.getById);
router.post("/getTemplateFields", AuthHelper.authorize, aclPermissions.getPermissions, EmailControllerV1.getTemplateFields);
router.post("/getWhatsappTemplates", AuthHelper.authorize, RBACMiddleware.authorize('marketing_whatsapp', 'read'), EmailControllerV1.getWhatsappTemplates);
router.post("/getWhatsappTemplateByName", AuthHelper.authorize, RBACMiddleware.authorize('marketing_whatsapp', 'read'), EmailControllerV1.getWhatsappTemplateByName);
module.exports = router;