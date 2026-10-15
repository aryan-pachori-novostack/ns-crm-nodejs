let B2CLeadControllerV1 = require(_pathconst.ControllersPath.B2CLeadControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');
const express = require("express");
const router = express.Router();

const isExportBody = (req) => {
    const { is_export } = req.body || {};
    return is_export === true || is_export === 'true' || is_export === 1;
};
const cors = require('cors');
const allowedDomains = ['https://www.ruloans.com', 'https://ruloans.com', 'https://ruconnect.in', 'https://ruloans-git-uat-ruloans.vercel.app', 'https://b2c-uat-web.vercel.app'];

// CORS middleware for specific routes
const corsOptions = {
  origin: async function (origin, callback) {
    if (!origin || allowedDomains.indexOf(origin) !== -1 || process.env.ENVIRONMENT == "dev") {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    };
  }
};
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/getB2cLeads", AuthHelper.authorize, aclPermissions.getPermissions, B2CLeadControllerV1.getB2cLeads);
router.post("/getB2cLeadsById", AuthHelper.authorize, aclPermissions.getPermissions, B2CLeadControllerV1.getB2cLeadsById);
router.post("/getAllHyperlinkContent", AuthHelper.authorize, RBACMiddleware.authorize('content_hyperlink_content', 'read'), B2CLeadControllerV1.getAllHyperlinkContent);
router.post("/insertHyperlinkContent", AuthHelper.authorize, RBACMiddleware.authorize('content_hyperlink_content', ['create', 'update']), B2CLeadControllerV1.insertHyperlinkContent);
router.post("/deleteHyperlinkContent", AuthHelper.authorize, RBACMiddleware.authorize('content_hyperlink_content', 'delete'), B2CLeadControllerV1.deleteHyperlinkContent);
router.post("/insertHyperlinkContentExtended", AuthHelper.authorize, RBACMiddleware.authorize('content_hyperlink_content', ['create', 'update']), B2CLeadControllerV1.insertHyperlinkContentExtended);
router.post("/getHyperlinkContentExtended", AuthHelper.authorize, RBACMiddleware.authorize('content_hyperlink_content', 'read'), B2CLeadControllerV1.getHyperlinkContentExtended);
router.post("/deleteHyperlinkContentExtended", AuthHelper.authorize, RBACMiddleware.authorize('content_hyperlink_content', 'delete'), B2CLeadControllerV1.deleteHyperlinkContentExtended);
router.post("/getHyperlinkLocationExternal", AuthHelper.externalB2CAuth, cors(corsOptions),B2CLeadControllerV1.getHyperlinkLocationExternal);
router.post("/getHyperlinkDataExternal", AuthHelper.externalB2CAuth, cors(corsOptions), B2CLeadControllerV1.getHyperlinkDataExternal);
router.post("/getHyperlinkLocation", AuthHelper.authorize, RBACMiddleware.authorize('content_hyperlink_content', 'read'), B2CLeadControllerV1.getHyperlinkLocation);
router.post("/getB2cUserQueries", AuthHelper.authorize, RBACMiddleware.authorize('customers_customer_queries', 'read'), ExportMiddleware.authorizeExport('customers_customer_queries', isExportBody), B2CLeadControllerV1.getB2cUserQueries);
router.post("/copyHyperLinkContent", AuthHelper.authorize, RBACMiddleware.authorize('content_hyperlink_content', 'create'), B2CLeadControllerV1.copyHyperLinkContent);

module.exports = router;