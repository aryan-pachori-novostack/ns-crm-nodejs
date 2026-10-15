
let LeadControllerV2 = require(_pathconst.ControllersPath.LeadControllerV2);
let LeadErpController = require(_pathconst.ControllersPath.LeadErpController);
let LeadValidationV2 = require(_pathconst.ReqModelsPath.LeadValidationV2);
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
const reqValidator = require('../../../helpers/request-validator.js');
const safe = require('../../../helpers/safe.js');
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/getLeadForms", AuthHelper.authorizeDsa, LeadControllerV2.getLeadForms);
router.get("/getPayoutsDigitalThroughApp", AuthHelper.authorize, LeadControllerV2.getPayoutsDigitalThroughApp);
router.post("/editPayoutsDigitalThroughApp", AuthHelper.authorize, RBACMiddleware.authorize('dsa_channel_partners', 'update'), LeadControllerV2.editPayoutsDigitalThroughApp);
router.post("/downloadLeadPayout", AuthHelper.authorizeDsaCentralized, LeadControllerV2.downloadLeadPayout);

// Same ERP submit flow as SSE, but JSON response (for schedulers).
router.post(
    "/autoErpHandler",
    AuthHelper.externalAuth,
    reqValidator(LeadValidationV2?.sendLeadFormAutoErp, "body"),
    safe(LeadErpController?.autoErpHandler)
);

module.exports = router;