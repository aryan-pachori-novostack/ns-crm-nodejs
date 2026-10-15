var ResHelper = require(_pathconst.FilesPath.ResHelper);
const { callNsApi } = require("../../../helpers/commonhelper");
const { logger } = require("../../../helpers/logger");
const NetsuiteValidationV1 = require(_pathconst.ReqModelsPath.NetsuiteValidationV1);
let DSAService = require(_pathconst.ServicesPath.DSAService);
let CompanyServices = require(_pathconst.ServicesPath.CompanyServices);



const updateDetailsFromNS = async (req, res, next) => {
    try {
      
        const { error } = NetsuiteValidationV1.updateDetailsFromNS.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 401, {}, "");
        }
        let { dsaMobileNumber, dsaId, is_company = false } = req.body;
        let dsaDetails
        let companyDetails
        let vendor_pan_number
        let dsa_mobile_number
        let company_id = null;
        let user_type = "Channel Partner";

        if (is_company) {
            companyDetails = await CompanyServices.getCompanyDetailsByKey(dsaId, 'company_id');
            if (!companyDetails) {
                return ResHelper.apiResponse(res, false, "Company details not found", 401, {}, "");
            }

            if (!companyDetails.permanent_account_number) {
                return ResHelper.apiResponse(res, false, "Company pan number not found", 401, {}, "");
            }
            vendor_pan_number = companyDetails?.permanent_account_number;
            dsa_mobile_number = companyDetails?.dsa_mobile_number || "";
            company_id = companyDetails?.dsa_id;
            dsaId = companyDetails?.registered_by_id;
            user_type = "Company";
        }
        else {
            dsaDetails = await DSAService.getDsaKycById(dsaId);
            if (!dsaDetails) {
                return ResHelper.apiResponse(res, false, "DSA kyc data not found", 401, {}, "");
            }

            if (!dsaDetails.permanent_account_number) {
                return ResHelper.apiResponse(res, false, "DSA pan number not found", 401, {}, "");
            }
            vendor_pan_number = dsaDetails?.permanent_account_number;
            dsa_mobile_number = dsaDetails?.dsa_mobile_number || "";
        }

        const result = await DSAService.updateDsaNsHierarchy(vendor_pan_number, dsaId, !is_company)

        if (!result.isValid) {
            return ResHelper.apiResponse(res, false, "Failed to Sync Data from NS", 404, {}, "");
        }

        const { data } = result;

        const { internalid } = data;
        const bankDetailsList = Array.isArray(data?.Bank_Details) ? data.Bank_Details : [];

        const resObj = {
            ns_hierarchy: data?.class,
        };

        const { syncedCount, skipped, removedCount } = await DSAService.syncDsaBankDetailsFromNs(dsaId, {
            bankDetailsList,
            internalid,
            dsa_mobile_number,
            user_type,
            company_id: company_id || null,
        });

        if (!syncedCount) {
            if (is_company && skipped.length) {
                return ResHelper.apiResponse(res, false, "Bank account already synced with the registered DSA", 409, { ...resObj, skipped }, "");
            }
            if (removedCount) {
                return ResHelper.apiResponse(res, false, "Bank account removed from NetSuite; CRM record deleted", 404, { ...resObj, removedCount }, "");
            }
            return ResHelper.apiResponse(res, false, "Bank details not found", 404, resObj, "");
        }

        ResHelper.apiResponse(res, true, "Success", 200, { ...resObj, skipped, removedCount }, "");
    }
    catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

module.exports = {
    updateDetailsFromNS
}