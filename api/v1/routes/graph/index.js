let GraphControllerV1 = require(_pathconst.ControllersPath.GraphControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js')
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/getLeadFormGraph", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_graphs_lead_forms', 'read'), GraphControllerV1.getLeadFormGraph);
router.post("/getLeadFormGraphExternal", AuthHelper.authorizeDsaCentralized, GraphControllerV1.getLeadFormGraph);
router.post("/getLeadFormGraphMIS", AuthHelper.authorize, RBACMiddleware.authorize('dashboard_mis_lead_forms', 'read'), GraphControllerV1.getLeadFormGraphMIS);
router.post("/getLeadFormGraphMISExternal", AuthHelper.authorizeDsaCentralized, GraphControllerV1.getLeadFormGraphMIS);

module.exports = router;