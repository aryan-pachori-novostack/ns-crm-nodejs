
let ListFiltersControllerV1 = require(_pathconst.ControllersPath.ListFiltersControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/createListFilters",AuthHelper.authorize, RBACMiddleware.authorize('tools_list_filters', ['create', 'update']), ListFiltersControllerV1.create);
router.post("/getListFilters",AuthHelper.authorize, ListFiltersControllerV1.getAllFilters);
router.post("/deleteFilterById",AuthHelper.authorize, RBACMiddleware.authorize('tools_list_filters', 'delete'), ListFiltersControllerV1.deleteFilterById);

module.exports = router;