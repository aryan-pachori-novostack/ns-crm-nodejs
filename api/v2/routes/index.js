const express = require("express");
const router = new express.Router();

router.use('/lead', require('./lead'));
router.use('/dsa', require('./dsa'));
router.use('/picklist-values', require('./picklist-values'));
router.use('/application-log', require('./application-log'));

module.exports = router;
