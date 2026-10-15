let ProductControllerV1 = require(_pathconst.ControllersPath.ProductControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
const express = require("express");
const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

router.post("/getAllProduct", AuthHelper.authorize, RBACMiddleware.authorize('products_products', 'read'), ProductControllerV1.getAllProduct);
router.post("/createProduct", AuthHelper.authorize, RBACMiddleware.authorize('products_products', ['create', 'update']), ProductControllerV1.createProduct);
router.post("/getAllLoanTypes", AuthHelper.authorize, ProductControllerV1.getAllLoanTypes);
router.post("/getCriteria", AuthHelper.authorize, RBACMiddleware.authorize('products_bulk_upload_rm', 'read'), ProductControllerV1.getCriteria);
router.post("/getCriteriaByProductId", AuthHelper.externalPassportAuth, ProductControllerV1.getCriteriaByProductId);
router.post("/createCriteria", AuthHelper.authorize, RBACMiddleware.authorize('products_products', 'create'), ProductControllerV1.createCriteria);
router.post("/editCriteria", AuthHelper.authorize, RBACMiddleware.authorize('products_products', 'update'), ProductControllerV1.editCriteria);
router.post("/deleteCriteria", AuthHelper.authorize, RBACMiddleware.authorize('products_products', 'delete'), ProductControllerV1.deleteCriteria);
router.post("/getContent", AuthHelper.authorize, RBACMiddleware.authorize('products_bulk_upload_rm', 'read'), ProductControllerV1.getContent);
router.post("/createContent", AuthHelper.authorize, RBACMiddleware.authorize('products_products', ['create', 'update']), ProductControllerV1.createContent);
router.post("/deleteContent", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.deleteContent);
router.post("/getServiceablePincodes", AuthHelper.authorize, RBACMiddleware.authorize('products_products_pincodes', 'read'), ProductControllerV1.getServiceablePincodes);
router.post("/editServiceablePincodes", AuthHelper.authorize, RBACMiddleware.authorize('products_products_pincodes', 'update'), ProductControllerV1.editServiceablePincodes);
router.post("/addServiceablePincodes", AuthHelper.authorize, RBACMiddleware.authorize('products_products_pincodes', 'create'), ProductControllerV1.addServiceablePincodes);
router.post("/addNewLender", AuthHelper.authorize, RBACMiddleware.authorize('products_products', 'create'), ProductControllerV1.addNewLender);
router.post("/deleteServiceablePincode", AuthHelper.authorize, RBACMiddleware.authorize('products_products_pincodes', 'delete'), ProductControllerV1.deleteServiceablePincode);
router.post("/getDocuments", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.getDocuments);
router.post("/getDocumentsForProduct", AuthHelper.authorize, RBACMiddleware.authorize('products_bulk_upload_rm', 'read'), ProductControllerV1.getDocumentsForProduct);
router.post("/getDocumentsMetaforProduct", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.getDocumentsMetaforProduct);
router.post("/getProductRequirement", AuthHelper.authorize, RBACMiddleware.authorize('products_bulk_upload_rm', 'read'), ProductControllerV1.getProductRequirement);
router.post("/getProductMetaForRequirement", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.getProductMetaForRequirement);
router.post("/getProductByLoanTypeId", ProductControllerV1.getProductByLoanTypeId);
router.post("/getProductForRm", AuthHelper.authorize, RBACMiddleware.authorize('products_bulk_upload_rm', 'read'), ProductControllerV1.getProductForRm);

//Insert

router.post("/createDocumentsForProduct", AuthHelper.authorize, RBACMiddleware.authorize('products_products', ['create', 'update']), ProductControllerV1.createDocumentsForProduct);
router.post("/createDocumentsMetaforProduct", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.createDocumentsMetaforProduct);
router.post("/createProductMetaForRequirement", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.createProductMetaForRequirement);
router.post("/createProductForRequirement", AuthHelper.authorize, RBACMiddleware.authorize('products_products', ['create', 'update']), ProductControllerV1.createProductForRequirement);
router.post("/csvToServicablePincode", ProductControllerV1.csvToServicablePincode);

// Delete

router.post("/deleteDocumentsForProduct", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.deleteDocumentsForProduct);
router.post("/deleteDocumentsMetaForProduct", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.deleteDocumentsMetaForProduct);
router.post("/deleteProductMetaForRequirement", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.deleteProductMetaForRequirement);
router.post("/deleteRequirementsForProduct", AuthHelper.authorize, aclPermissions.getPermissions, ProductControllerV1.deleteRequirementsForProduct);
router.post("/getLoanTypesPaginated", AuthHelper.authorize, RBACMiddleware.authorize('products_loan_types', 'read'), ProductControllerV1.getLoanTypesPaginated);
router.post("/deleteLoanTypeById", AuthHelper.authorize, RBACMiddleware.authorize('products_loan_types', 'delete'), ProductControllerV1.deleteLoanTypeById);
router.post("/createLoanType", AuthHelper.authorize, RBACMiddleware.authorize('products_loan_types', 'create'), ProductControllerV1.createLoanType);
router.post("/updatePincodeCsv", AuthHelper.authorize, RBACMiddleware.authorize('products_products', 'update'), ProductControllerV1.updatePincodeCsv);
router.post("/getProductAuditLogs", AuthHelper.authorize, RBACMiddleware.authorize('products_products', 'read'), ProductControllerV1.getProductAuditLogs);

module.exports = router;