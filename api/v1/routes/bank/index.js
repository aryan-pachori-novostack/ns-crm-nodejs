let BankControllerV1 = require(_pathconst.ControllersPath.BankControllerV1);
const aclPermissions = require('../../../helpers/acl-middleware/acl-helper.js');

const express = require("express");
const RBACMiddleware = require('../../../helpers/acl-middleware/rbac-middleware.js');
const ExportMiddleware = require('../../../helpers/acl-middleware/export-middleware.js');

const router = express.Router();
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);

const isExportBody = (req) => {
    const { is_export } = req.body || {};
    return is_export === true || is_export === 'true' || is_export === 1;
};
router.post("/getBankForBankDetail", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'read'), BankControllerV1.getBank);
router.post("/getBankForBankDetailExternal", AuthHelper.authorizeDsa, BankControllerV1.getBank);
router.post("/getProductForBankDetail", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'read'), BankControllerV1.getProduct);
router.post("/getProductForBankDetailExternal", AuthHelper.authorizeDsa, BankControllerV1.getProduct);
router.post("/getMarketTypeForBankDetail", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'read'), BankControllerV1.getMarketType);
router.post("/getMarketTypeForBankDetailExternal", AuthHelper.authorizeDsa, BankControllerV1.getMarketType);
router.post("/getStateForBankDetail", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'read'), BankControllerV1.getState);
router.post("/getStateForBankDetailExternal", AuthHelper.authorizeDsa, BankControllerV1.getState);
router.post("/getCityForBankDetail", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'read'), BankControllerV1.getCity);
router.post("/getCityForBankDetailExternal", AuthHelper.authorizeDsa, BankControllerV1.getCity);
router.post("/getBankDetail", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'read'), ExportMiddleware.authorizeExport('finance_finance_tools_find_banks', isExportBody), BankControllerV1.getBankDetail);
router.post("/getBankDetailExternal", AuthHelper.authorizeDsa, BankControllerV1.getBankDetail);
router.get("/get-bank-detail", AuthHelper.authorizeDsaCentralized, BankControllerV1.getBankDetail);
router.get("/confirmation-mail-allowed", AuthHelper.authorizeDsaCentralized, BankControllerV1.confirmationMailAllowed);
router.post("/getAllBanks", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_banks', 'read'), ExportMiddleware.authorizeExport('finance_meta_data_banks', isExportBody), BankControllerV1.getAllBanks);
router.post("/deleteBankById", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_banks', 'delete'), BankControllerV1.deleteBankById);
router.post("/getBankDetailById", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_banks', 'read'), BankControllerV1.getBankDetailById);
router.post("/createBank", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_banks', 'create'), BankControllerV1.createBank);
router.post("/getAllStates", AuthHelper.authorize, aclPermissions.getPermissions, BankControllerV1.getAllStates);
router.post("/getAllCityForState", AuthHelper.authorize, aclPermissions.getPermissions, BankControllerV1.getAllCityForState);
router.post("/uploadBank", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'create'), BankControllerV1.uploadBank);
router.post("/uploadBankFileData", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'create'), BankControllerV1.uploadBankFileData);
router.post("/deleteAllBanks", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_find_banks', 'delete'), BankControllerV1.deleteAllBanks);
router.post("/submitClaimBankFile", AuthHelper.authorize, aclPermissions.getPermissions, BankControllerV1.submitClaimBankFile);
router.post("/getBankFiles", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_bank_files', 'read'), BankControllerV1.getBankFiles);
router.post("/getBankFilesNearBySearch", AuthHelper.authorize, RBACMiddleware.authorize("finance", 'read'), BankControllerV1.getBankFilesNearBySearch);
router.post("/getTentativeBankFilesNearBySearch", AuthHelper.authorize, RBACMiddleware.authorize("finance", 'read'), BankControllerV1.getTentativeBankFilesNearBySearch);
router.post("/getBankFileLogs", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_bank_files', 'read'), BankControllerV1.getBankFileLogs);
router.post("/getBankFileDetail", AuthHelper.authorize, aclPermissions.getPermissions, BankControllerV1.getBankFileDetail);
router.post("/getStateForBankFiles", AuthHelper.authorize, RBACMiddleware.authorize('finance_finance_tools_bank_files', 'read'), BankControllerV1.getStateForBankFiles);
router.post("/getAllBranchSalePeople", AuthHelper.authorize, aclPermissions.getPermissions, BankControllerV1.getAllBranchSalePeople);
router.post("/deleteBranchSalePeopleById", AuthHelper.authorize, aclPermissions.getPermissions, BankControllerV1.deleteBranchSalePeopleById);
router.post("/createOrEditBranchSalePeople", AuthHelper.authorize, aclPermissions.getPermissions, BankControllerV1.createOrEditBranchSalePeople);
router.post("/addBankProductCombination", AuthHelper.authorize, RBACMiddleware.authorize(["finance_meta_data_netsuite_banks", "finance_meta_data_bank_product_combination"], 'create'), BankControllerV1.addBankProductCombination);
router.post("/addBankProductCombinationRegex", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'create'), BankControllerV1.addBankProductCombinationRegex);
router.post("/getBankProductCombinationRegex", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'read'), BankControllerV1.getBankProductCombinationRegex);
router.post("/getBankProductCombinationByBankId", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'read'), BankControllerV1.getBankProductCombinationByBankId);
router.post("/getMatchingProductsByLoanOrApac", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'read'), BankControllerV1.getMatchingProductsByLoanOrApac);
router.post("/getMatchingProductsByLoanOrApacExternal", AuthHelper.authorizeDsa, BankControllerV1.getMatchingProductsByLoanOrApac);
router.post("/createOrUpdateNetsuiteBank", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', ['create', 'update']), BankControllerV1.createOrUpdateNetsuiteBank);
router.post("/deleteNetsuiteBank", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'delete'), BankControllerV1.deleteNetsuiteBank);
router.post("/getNetsuiteBankById", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'read'), BankControllerV1.getNetsuiteBankById);
router.post("/getAllBankProductDetails", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_products', 'read'), BankControllerV1.getAllBankProductDetails);
router.post("/getAllBankProductDetailsExternal", AuthHelper.authorizeDsa, BankControllerV1.getAllBankProductDetails);
router.post("/getBankProductCombinationHistory", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_products', 'read'), BankControllerV1.getBankProductCombinationHistory);
router.post("/getBankProductCombinationHistoryExternal", AuthHelper.authorizeDsa, BankControllerV1.getBankProductCombinationHistory);
router.post("/udpateBankProductDetails", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'update'), BankControllerV1.updateBankProductGroDetails);
router.post("/updateBankProductStatus", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_netsuite_banks', 'update'), BankControllerV1.updateBankProductStatus);
router.post("/updateAutonomousPayoutCapping", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_bank_product_combination', 'update'), BankControllerV1.updateAutonomousPayoutCapping);
router.post("/updateMaxPayoutCapping", AuthHelper.authorize, RBACMiddleware.authorize('finance_meta_data_bank_product_combination', 'update'), BankControllerV1.updateMaxPayoutCapping);

// ── Bank Master ──────────────────────────────────────────────────────────────
router.post("/importBankMaster", AuthHelper.authorizeDsaCentralized, BankControllerV1.importBankMaster);
router.get("/getBankMasterDropdown", AuthHelper.authorizeDsaCentralized, BankControllerV1.getBankMasterDropdown);

module.exports = router;