let CareerControllerV1 = require(_pathconst.ControllersPath.CareerControllerV1);
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require("../../../helpers/acl-middleware/rbac-middleware.js");

// router.get("/getAllJobs", CareerControllerV1.getAllJobs);
router.get("/getJobs", CareerControllerV1.getJobsSearch);
router.post("/applyJob", CareerControllerV1.applyJob);
router.get("/getJobDetails", CareerControllerV1.getJobDetails);
router.post("/getCityFromState", AuthHelper.authorizeDsaCentralized, CareerControllerV1.getCityFromState);
router.post("/getCityFromStateCrm", AuthHelper.authorize, CareerControllerV1.getCityFromState);
router.get("/getAllCategories", CareerControllerV1.getAllCategory);
router.post("/getAllJobs", AuthHelper.authorize, RBACMiddleware.authorize('career_jobs', 'read'), CareerControllerV1.getAllJobs);
router.post("/getAllJobApplicant", AuthHelper.authorize, RBACMiddleware.authorize('career_jobs', 'read'), CareerControllerV1.getAllJobApplicant);
router.post("/createOrEditJob", AuthHelper.authorize, RBACMiddleware.authorize('career_jobs', 'create'), CareerControllerV1.createOrEditJob);
router.post("/deleteJobById", AuthHelper.authorize, RBACMiddleware.authorize('career_jobs', 'delete'), CareerControllerV1.deleteJobById);
router.post("/getStates", AuthHelper.authorize, aclPermissions.getPermissions, CareerControllerV1.getStates);
router.post("/getCityFromStateUnauth", AuthHelper.externalAuth, CareerControllerV1.getCityFromState);

module.exports = router;