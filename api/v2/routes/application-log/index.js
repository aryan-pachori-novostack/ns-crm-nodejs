const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
const ApplicationLogControllerV2 = require("../../controllers/application-log");

router.get("/getMisUploadDashboard", AuthHelper.authorize, ApplicationLogControllerV2.getMisUploadDashboard);
router.get("/getRowLevelLogs", AuthHelper.authorize, ApplicationLogControllerV2.getRowLevelLogs);

module.exports = router;

