let PicklistValuesControllerV2 = require(_pathconst.ControllersPath.PicklistValuesControllerV2);

const express = require("express");

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.get("/get-picklist-values", AuthHelper.authorizeDsaCentralized, PicklistValuesControllerV2.getPicklistValuesExternal);
router.get("/get-picklist-values-by-key-id", AuthHelper.authorizeDsaCentralized, PicklistValuesControllerV2.getPicklistValuesByKeyId);

module.exports = router;