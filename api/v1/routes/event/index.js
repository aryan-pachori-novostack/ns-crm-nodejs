let EventControllerV1 = require(_pathconst.ControllersPath.EventControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const express = require("express");
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/getEvents", AuthHelper.authorize, RBACMiddleware.authorize(["finance_invoices_invoices","finance_invoices_office_expenses","marketing_events"], 'read'), EventControllerV1.getEvents);
router.post("/getEventsExternal", AuthHelper.authorizeDsa, EventControllerV1.getEvents);
router.post("/createOrEditEvent", AuthHelper.authorize, RBACMiddleware.authorize('marketing_events', ['create', 'update']), EventControllerV1.createOrEditEvent);
router.post("/createOrEditEventRewards", AuthHelper.authorize, RBACMiddleware.authorize('marketing_events', ['create', 'update']), EventControllerV1.createOrEditEventRewards);
router.post("/createOrEditEventMedia", AuthHelper.authorize, RBACMiddleware.authorize('marketing_events', ['create', 'update']), EventControllerV1.createOrEditEventMedia);
router.post("/createOrEditEventEligibility", AuthHelper.authorize, RBACMiddleware.authorize('marketing_events', ['create', 'update']), EventControllerV1.createOrEditEventEligibility);
router.post("/hardDeleteFromType", AuthHelper.authorize, RBACMiddleware.authorize('marketing_events', 'delete'), EventControllerV1.hardDeleteFromType);
router.post("/getWinnersForContest", AuthHelper.authorize, RBACMiddleware.authorize('marketing_events', 'read'), EventControllerV1.getWinnersForContest);
router.get("/contests/:event_id", AuthHelper.authorizeDsaCentralizedOrByass, EventControllerV1.getContestForDsa);
router.get("/contests", EventControllerV1.getContestForDsa);

module.exports = router;