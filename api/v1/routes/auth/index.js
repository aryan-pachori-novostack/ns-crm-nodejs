const express = require("express");
const router = express.Router();
const UserControllerV1 = require(_pathconst.ControllersPath.UserControllerV1);

router.get("/check-device", UserControllerV1.checkDevice);

module.exports = router;
