const axios = require("axios");
const { logger } = require("../../../helpers/logger");
const { checkWhereInQueryString, jsonDifference, matchesRegex, CreateWhereQueryFilter, CustomOperatorHandlers, formatGetLeadFormsFilterClause } = require("../../../helpers/commonhelper");
const { getBankDetailsFieldMapping } = require("../../../helpers/apiFieldMappings");
const xlsx = require('xlsx');
const { findBankNameById } = require("../../../services/lead-services");
const { isFinanceRootUser, isConfirmationMailAllowedForProductId } = require("../../../services/finance-services");
let DSAService = require(_pathconst.ServicesPath.DSAService);
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let BankService = require(_pathconst.ServicesPath.BankService);
let BankDetailValidationV1 = require(_pathconst.ReqModelsPath.BankDetailValidationV1);
let { uploadBankQueue, uploadBankFileDataQueue } = require(_pathconst.FilesPath.Queue);
let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);
const LeadLogService = require(_pathconst.ServicesPath.LeadLogService);

const getBank = async (req, res, next) => {
    try {
        let banks = await BankService.getDistinctSingleProperty('bank_nbfc_name');
        ResHelper.apiResponse(res, true, "Success", 200, banks, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getBankDetail = async (req, res, next) => {
    try {
        req.body = (req.loggedInUser || req.dsa) ? req.body : req.query;
        const { error } = BankDetailValidationV1.getBankDetail.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, bankName, product, marketType, state, city, search, createdOn, updatedOn } = req.body;

            let where = "";
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (bankName) {
                where = checkWhereInQueryString(where);
                where += ` bank_nbfc_name like "%${bankName}%" `;
            };
            if (bankName?.replaceAll(" ", "")?.toLowerCase() == "centralbankofindia") {
                where = checkWhereInQueryString(where);
                where += ` ifsc_code is not null `;
            };
            if (product) {
                where = checkWhereInQueryString(where);
                where += ` product like "%${product}%" `;
            }
            if (marketType) {
                where = checkWhereInQueryString(where);
                where += ` market_and_sub_type like "%${marketType}%" `;
            }
            if (state) {
                where = checkWhereInQueryString(where);
                where += ` state like "%${state}%" `;
            }
            if (city) {
                where = checkWhereInQueryString(where);
                where += ` city like "%${city}%" `;
            }
            if (search) {
                where = checkWhereInQueryString(where);
                where += ` (ifsc_code like "%${search}%" or branch_address like "%${search}%" or product like "%${search}%" or city like "%${search}%" or state like "%${search}%" or pincode like "%${search}%") or bank_nbfc_name like "%${search}%" or location like "%${search}%" `;
            }
            if (createdOn) {
                where = checkWhereInQueryString(where);
                where += ` DATE(createdAt) = DATE("${createdOn}") `;
            }
            if (updatedOn) {
                where = checkWhereInQueryString(where);
                where += ` DATE(updatedAt) = DATE("${updatedOn}") `;
            }
            let payouts = await BankService.getBankDetail(where, [], pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, payouts, "");
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const confirmationMailAllowed = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.confirmationMailAllowed.validate(req.query);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const { product_id } = req.query;
        const is_confirmation_mail_allowed = await isConfirmationMailAllowedForProductId(product_id);
        return ResHelper.apiResponse(res, true, "Success", 200, { is_confirmation_mail_allowed }, "");
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllBanks = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getAllBanks.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { pageNumber, pageSize, bankNbfcFilter, productFilter, stateFilter, cityFilter, companyFilter, startDateFilter, endDateFilter, filterModel, logicOperator } = req?.body;

            // Legacy filters — unchanged behaviour 
            let where = "";
            if (bankNbfcFilter) {
                where = checkWhereInQueryString(where);
                where += `bank_nbfc_name like '%${bankNbfcFilter}%'`;
            }
            if (productFilter) {
                where = checkWhereInQueryString(where);
                where += `product like '%${productFilter}%'`;
            }
            if (stateFilter) {
                where = checkWhereInQueryString(where);
                where += `state like '%${stateFilter}%'`;
            }
            if (cityFilter) {
                where = checkWhereInQueryString(where);
                where += `city like '%${cityFilter}%'`;
            }
            if (companyFilter) {
                where = checkWhereInQueryString(where);
                where += `company like '%${companyFilter}%'`;
            }
            if (startDateFilter) {
                where = checkWhereInQueryString(where);
                where += `DATE(createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}")`;
            }

            // MUI X DataGrid filterModel — same pattern as getLeadForms
            let whereFilterQuery = "";
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, getBankDetailsFieldMapping, operatorHandlers);

                if (whereFilterArray && whereFilterArray.length > 0) {
                    const filters = whereFilterArray
                        .map((item) => {
                            const [field, op, val] = item;
                            return formatGetLeadFormsFilterClause(field, op, val);
                        })
                        .filter(Boolean);
                    const logicOp = logicOperator === 'or' ? ' OR ' : ' AND ';
                    whereFilterQuery = filters.join(logicOp);
                }
            }

            if (whereFilterQuery) {
                where = checkWhereInQueryString(where);
                where += `(${whereFilterQuery})`;
            }

            let payouts = await BankService.getAllBanks(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, payouts, "");
        }
    }
    catch (e) {
        logger.error(e)
        console.log(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getBankDetailById = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getBankDetailById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let payouts = await BankService.getBankDetailById(req?.body?.id);
            ResHelper.apiResponse(res, true, "Success", 200, payouts, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const deleteBankById = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getBankDetailById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let payouts = await BankService.deleteBankById(req?.body?.id);
            ResHelper.apiResponse(res, true, "Success", 200, payouts, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const createBank = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.createBank.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await BankService.createBank(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, [], "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getProduct = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getProduct.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bankName } = req.body;
            const isFiltered = bankName ? [['bank_nbfc_name', bankName]] : "";
            let products = await BankService.getDistinctSingleProperty('product', isFiltered);
            ResHelper.apiResponse(res, true, "Success", 200, products, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getMarketType = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getMarketType.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bankName, product } = req.body;
            let arr = [];
            if (bankName) { arr.push(['bank_nbfc_name', bankName]) };
            if (product) { arr.push(['product', product]) };
            let marketTypes = await BankService.getDistinctSingleProperty('market_and_sub_type', arr);
            ResHelper.apiResponse(res, true, "Success", 200, marketTypes, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const getState = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getState.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bankName, product, marketType } = req.body;
            let arr = [];
            if (bankName) { arr.push(['bank_nbfc_name', bankName]) };
            if (product) { arr.push(['product', product]) };
            if (marketType) { arr.push(['market_and_sub_type', marketType]) };
            let states = await BankService.getDistinctSingleProperty('state', arr);
            ResHelper.apiResponse(res, true, "Success", 200, states, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllStates = async (req, res, next) => {
    try {
        let states = await BankService.getDistinctSingleProperty('state');
        ResHelper.apiResponse(res, true, "Success", 200, states, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllCityForState = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getAllCityForState.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { state } = req.body;
            let cities = await BankService.getDistinctSingleProperty('city', [['state', state]]);
            ResHelper.apiResponse(res, true, "Success", 200, cities, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getCity = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getCity.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bankName, product, marketType, state } = req.body;
            let arr = [];
            if (bankName) { arr.push(['bank_nbfc_name', bankName]) };
            if (product) { arr.push(['product', product]) };
            if (marketType) { arr.push(['market_and_sub_type', marketType]) };
            if (state) { arr.push(['state', state]) };
            let payouts = await BankService.getDistinctSingleProperty('city', arr);
            ResHelper.apiResponse(res, true, "Success", 200, payouts, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

// const sendEmail = async (req,res,next) => {
//     emailQueue.add(null);
// }

const uploadBank = async (req, res, next) => {

    try {
        const { error } = BankDetailValidationV1.uploadBank.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let file = req.body.file;
            uploadBankQueue.add({ file: file });
            ResHelper.apiResponse(res, true, "success", 201, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const uploadBankFileData = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.uploadBankFile.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { base64, file_name } = req?.body;

            const isMaster = await isFinanceRootUser(req?.loggedInUser?.userPhone);

            if (!isMaster) {
                return ResHelper.apiResponse(res, false, "Permission Denied", 403, {}, "");
            }

            // Check if file already exists
            const fileExists = await LeadLogService.checkFileAlreadyExists(req.loggedInUser.id, file_name, 'bank_file_upload');
            if (fileExists) {
                return ResHelper.apiResponse(res, false, "Same file name already uploaded", 400, {}, "");
            }

            // Parse Excel
            const buf = Buffer.from(base64, 'base64');
            const sheet = await xlsx.read(buf, { type: 'buffer' });
            await xlsx.writeFile(sheet, "uploadBankFile.xlsx");
            const fileData = xlsx.readFile('uploadBankFile.xlsx');
            let sheetNames = fileData.SheetNames;
            const json = xlsx.utils.sheet_to_json(fileData.Sheets[sheetNames[0]]);

            // Size limit check
            /*  if (json?.length >= 5000) {
                 ResHelper.apiResponse(res, false, "Max upload size is 5000 rows.", 400, {}, "");
                 return;
             } */

            // Queue job
            uploadBankFileDataQueue.add({
                data: json,
                file_name: file_name,
                user: req.loggedInUser
            });

            ResHelper.apiResponse(res, true, "File upload queued successfully", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}

const deleteAllBanks = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.deleteAllBanks.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await BankService.deleteAllBanks();
            ResHelper.apiResponse(res, true, "success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const submitClaimBankFile = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.submitClaimBankFile.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { is_tentative = 0 } = req.body;
            const data = await BankService.submitClaimBankFile(req?.body?.id, req.loggedInUser.userPhone, is_tentative);
            const { id, ...rest } = data;
            if (req?.loggedInUser?.userPhone == "9987884000") {
                rest.dsaGlobalPayout = "20";
            };
            if (rest?.dsaGlobalPayout == 0) {
                let message = "Payout is not defined for your account. Please contact your BH.";
                ResHelper.apiResponse(res, false, message, 400, {}, "");
                return;
            };
            let options = {
                'method': 'POST',
                data: rest,
                'url': `${process.env.MS_URL}/api/dsa/claim/submit-claim-bank-file`,
                headers: {
                    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5IiwianRpIjoiMzQ0MmY4MTE0ZTNiODYzMDAxN2IwZGMxZDg5Njk1ZDM0NmU0N2FjYzZkOTcyODkxMmI1Y2RkNGIzMjQ2NzYzZjczOWI3YzQ0ZjI4ZTFkOTUiLCJpYXQiOjE2OTExNTczOTguNzQzMzY0LCJuYmYiOjE2OTExNTczOTguNzQzMzY4LCJleHAiOjE3MjI3Nzk3OTguNzI0MzksInN1YiI6IjY0MCIsInNjb3BlcyI6W119.lRuoXb0u-KiY7ae14G4fKj1w4W34PMj-ZBXO7y2JOPZtv10CG1pJ3lapymGuOfQu5PhwS0ya2H7eX_qNYCZCpRTEm4rq3o4SGXDwfM50Iou71P72Yug_n8gF-si-vf2acdVpw3YpEZuNoLEt1bERgbdUDrRqQcYKfWfoFbC9HfYVnS_97Dv7pZCKeoMJEg25M8dsczAW1jZBsJ1Fhks7Xg9ZfpOR-p98vkzJM2Zo0IfZjfyO2sYOskyySk9aNfqO4x2QIBfhluEuKJc0tvkEoprdeMYFPlvC6G9W5gdU9a0HIerw01WVlIyvDpoxm3LQcGdYcPcQI8qm3Pa03OmYP-G8Io5hngjymk3DsCiBCDUx7gxaP8dVsgMFCQguGYWwD7FbuAUCXDspqn21pt41O0LP3RrXt2H8nw5BBJ5AkPnclP0wMhJIA6cgRUXOPAgeQRMGNm3vwXSfvN__bFun5IU-QHN4UE33j03vB7xbICwEY1vdu6GDcyitoJSodq30YFQXrsNpESRKXJ_M2sBO_UaKsmYZKbGWY1YxAqB5swVH5BRnibxYq91Ejoo3IBywj9hG7bjsiFVsT9X1-i3FWakC8WAqzaY4l54onnZHar16CZOY7AbozBKsI4In3G2jjwG1aEH8tNPKAiGoeMNRwMxPKqaq8wOjMhAnnp43PGU',
                    'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
                    'app-version-code': '6',
                    'device-type': '1',
                    'Content-Type': 'application/json'
                },
                validateStatus: () => true,
            };
            axios(options)
                .then((response) => {
                    const { status, message, data } = response?.data || {};
                    console.log(response?.data);
                    if (Boolean(status)) {
                        BankService.updateClaimBankFile(id, is_tentative);
                        ResHelper.apiResponse(res, true, message, 200, response?.data, "");
                    } else {
                        ResHelper.apiResponse(res, false, message, 400, {}, "");
                    }
                })
                .catch((error) => {
                    throw new Error(error);
                });
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getStateForBankFiles = async (req, res, next) => {
    try {
        const data = await BankService.getStateForBankFiles();
        let state = [];
        let city = [];
        let bank_nbfc_name = [];
        let product = [];
        if (data?.length) {
            for (i = 0; i < data?.length; i++) {
                if (!state.includes(data[i]?.state) && data[i]?.state?.length) {
                    state.push(data[i]?.state);
                };
                if (!city.includes(data[i]?.city) && data[i]?.city?.length) {
                    city.push(data[i]?.city);
                };
            }
            state.sort();
            city.sort();
            //bank_nbfc_name.sort();
        }
        let bankData = await BankService.getBankForBankFiles();
        for (let i = 0; i < bankData.length; i++) {
            if (bankData[i].bank_nbfc_name && bankData[i].bank_nbfc_name[0] != " ") {
                bank_nbfc_name.push(bankData[i].bank_nbfc_name);
            }
        }

        let productData = await BankService.getProductForBankFiles();
        for (let i = 0; i < productData.length; i++) {
            if (productData[i].product && productData[i].product[0] != " ") {
                product.push(productData[i].product);
            }
        }
        product.sort()
        ResHelper.apiResponse(res, true, "success", 200, { state, city, bank_nbfc_name, product }, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getBankFiles = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.getBankFiles.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, apacLoanFilter, customerFirstNameFilter, customerLastNameFilter, bankNbfcFilter, disbursementDateFilter, disbursementAmountFilter, cityFilter, stateFilter, custometFullNameFilter, productFilter, loanFilter, is_tentative = 0 } = req.body;
            const allowSubmit = Boolean(loanFilter || apacLoanFilter || customerFirstNameFilter || customerLastNameFilter || custometFullNameFilter);
            if (!allowSubmit) {
                ResHelper.apiResponse(res, false, "Customer Name, Loan number or Apac Loan filter is required.", 400, {}, "");
                return;
            }
            if (!pageNumber) { pageNumber = 0 };
            if (!pageSize) { pageSize = 100 };

            let checkWhere = () => {
                if (where.includes("where")) {
                    where += " and "
                } else {
                    where += "where "
                }
            }

            let where = "";
            if (loanFilter) {
                checkWhere();
                where += `apac_loan_number like '%${loanFilter}%'`
            }
            if (apacLoanFilter) {
                checkWhere();
                where += `loan_number like '%${apacLoanFilter}%'`
            }
            if (customerFirstNameFilter) {
                checkWhere();
                where += `customer_first_name like '%${customerFirstNameFilter}%'`
            }
            if (customerLastNameFilter) {
                checkWhere();
                where += `customer_last_name like '%${customerLastNameFilter}%'`
            }
            if (bankNbfcFilter) {
                checkWhere();
                where += `bank_nbfc_name like '%${bankNbfcFilter}%'`
            }
            if (disbursementDateFilter) {
                checkWhere();
                where += `disbursement_date like '%${disbursementDateFilter}%'`
            }
            if (disbursementAmountFilter) {
                checkWhere();
                where += `disbursement_amount like '%${disbursementAmountFilter}%'`
            }
            if (cityFilter) {
                checkWhere();
                where += `city like '%${cityFilter}%'`
            }
            if (stateFilter) {
                checkWhere();
                where += `state like '%${stateFilter}%'`
            }
            if (custometFullNameFilter) {
                checkWhere();
                where += `customer_name like '%${custometFullNameFilter}%'`
            }
            if (productFilter) {
                checkWhere();
                where += `product like '%${productFilter}%'`
            }
            let payout_request = await BankService.getBankFiles(pageNumber * pageSize, pageSize, where, is_tentative);
            await ApplicationLogServices?.createExportLog(req, "post_bank_files");

            ResHelper.apiResponse(res, true, "Success", 200, payout_request, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

// Cross-matches a loan/apac search value against both loan_number and apac_loan_number columns
// (a loan sent under one identifier by the bank can land in either column). Drops null/empty
// values before building the IN list so we never emit `in ()` / `in (null)`.
const buildLoanApacWhereClause = (loanNumberFilter, apacNumberFilter) => {
    const values = [loanNumberFilter, apacNumberFilter].filter((v) => v !== null && v !== undefined && v !== "");
    if (!values.length) return "";
    const list = values.map((v) => `'${v}'`).join(",");
    return `(loan_number in (${list}) or apac_loan_number in (${list}))`;
};

const getBankFilesNearBySearch = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.getBankFilesNearBySearch.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        };

        let {
            pageNumber,
            pageSize,
            customerFirstNameFilter,
            customerLastNameFilter,
            bankNbfcFilter,
            cityFilter,
            stateFilter,
            custometFullNameFilter,
            nameFilter,
            productFilter,
            not_claimed,
            automation,
            is_tentative = 0
        } = req.body;
        custometFullNameFilter = custometFullNameFilter || nameFilter;

        if (!pageNumber) pageNumber = 0;
        if (!pageSize) pageSize = 10;

        // Default behavior: require at least 3 filters
        if (!automation) {
            let filledFields = [
                customerFirstNameFilter,
                customerLastNameFilter,
                bankNbfcFilter,
                cityFilter,
                stateFilter,
                custometFullNameFilter,
                productFilter,
            ].filter(Boolean).length;


            if (filledFields < 3) {
                ResHelper.apiResponse(res, false, "Please select at least 3 filters!", 400, {}, "");
                return;
            }

            let where = "";
            const checkWhere = () => {
                where += where.includes("where") ? " and " : "where ";
            };

            if (customerFirstNameFilter) {
                checkWhere();
                where += `customer_first_name like '%${customerFirstNameFilter}%'`;
            }
            if (customerLastNameFilter) {
                checkWhere();
                where += `customer_last_name like '%${customerLastNameFilter}%'`;
            }
            if (bankNbfcFilter) {
                checkWhere();
                where += `bank_nbfc_name like '%${bankNbfcFilter}%'`;
            }
            if (cityFilter) {
                checkWhere();
                where += `city like '%${cityFilter}%'`;
            }
            if (stateFilter) {
                checkWhere();
                where += `state like '%${stateFilter}%'`;
            }
            if (custometFullNameFilter) {
                checkWhere();
                where += `(customer_name like '%${custometFullNameFilter}%' or customer_first_name like '%${custometFullNameFilter}%' or customer_last_name like '%${custometFullNameFilter}%')`;
            }
            if (custometFullNameFilter) {
                checkWhere();
                where += `(customer_name like '%${custometFullNameFilter}%' or customer_first_name like '%${custometFullNameFilter}%' or customer_last_name like '%${custometFullNameFilter}%')`;
            }
            if (productFilter) {
                checkWhere();
                where += `product like '%${productFilter}%'`;
            }
            if (not_claimed) {
                checkWhere();
                where += `(claimed in ("No", "0", "") or claimed is null)`;
            }

            const payout_request = await BankService.getBankFiles(pageNumber * pageSize, pageSize, where, is_tentative);
            await ApplicationLogServices?.createExportLog(req, "post_bank_files");

            ResHelper.apiResponse(res, true, "Success", 200, payout_request, "");
            return;
        };

        // Automation logic: search using combinations of any 3 filters
        const filters = {
            customerFirstNameFilter: `customer_first_name like '%${customerFirstNameFilter}%'`,
            customerLastNameFilter: `customer_last_name like '%${customerLastNameFilter}%'`,
            bankNbfcFilter: `bank_nbfc_name like '%${bankNbfcFilter}%'`,
            cityFilter: `city like '%${cityFilter}%'`,
            stateFilter: `state like '%${stateFilter}%'`,
            custometFullNameFilter: `customer_name like '%${custometFullNameFilter}%'`,
            productFilter: `product like '%${productFilter}%'`,
        };

        const activeFilters = Object.entries(filters).filter(([key, value]) => req.body[key]);

        if (activeFilters.length < 3) {
            ResHelper.apiResponse(res, false, "Please provide enough data for automation!", 400, {}, "");
            return;
        };

        const filterKeys = activeFilters.map(([key]) => key);
        const combinations = getCombinations(filterKeys, 3);

        for (const combination of combinations) {
            let where = combination.map((key) => filters[key]).join(" and ");
            where += ` and (claimed in ("No", "0", "") or claimed is null) `;
            const payout_request = await BankService.getBankFiles(pageNumber * pageSize, pageSize, `where ${where}`, is_tentative);
            if (Boolean(payout_request?.bank_files?.length > 0)) {
                await ApplicationLogServices?.createExportLog(req, "post_bank_files");
                ResHelper.apiResponse(res, true, "Success", 200, { ...payout_request, combination }, "");
                return;
            }
        };
        ResHelper.apiResponse(res, false, "No results found for any combination of 3 filters.", 200, {}, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getTentativeBankFilesNearBySearch = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.getTentativeBankFilesNearBySearch.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            return;
        };

        let {
            pageNumber,
            pageSize,
            customerFirstNameFilter,
            customerLastNameFilter,
            netsuiteBankIdFilter,
            cityFilter,
            stateFilter,
            custometFullNameFilter,
            nameFilter,
            netsuiteProductIdFilter,
            loanNumberFilter,
            apacNumberFilter,
            not_claimed,
            automation,
            search_main
        } = req.body;
        custometFullNameFilter = custometFullNameFilter || nameFilter;
        const hasLoanApacFilter = Boolean(loanNumberFilter || apacNumberFilter);

        if (!pageNumber) pageNumber = 0;
        if (!pageSize) pageSize = 10;

        // Default behavior: require at least 3 filters
        if (!automation) {
            // Combine all name filters into a single OR condition
            const nameConditions = [];
            if (customerFirstNameFilter) {
                nameConditions.push(`customer_first_name like '%${customerFirstNameFilter}%'`);
            }
            if (customerLastNameFilter) {
                nameConditions.push(`customer_last_name like '%${customerLastNameFilter}%'`);
            }
            if (custometFullNameFilter) {
                nameConditions.push(`customer_name like '%${custometFullNameFilter}%'`);
                nameConditions.push(`customer_first_name like '%${custometFullNameFilter}%'`);
                nameConditions.push(`customer_last_name like '%${custometFullNameFilter}%'`);
            }
            const hasNameFilter = nameConditions.length > 0;

            // Count name filters as a single filter since they're combined into one OR condition
            let filledFields = [
                hasNameFilter,
                netsuiteBankIdFilter,
                cityFilter,
                stateFilter,
                netsuiteProductIdFilter,
                hasLoanApacFilter,
            ].filter(Boolean).length;

            if (filledFields < 3) {
                ResHelper.apiResponse(res, false, "Please select at least 3 filters!", 400, {}, "");
                return;
            }

            // search_main picks exactly one table to query — never both, to avoid doubling
            // query load. Default (falsy/absent) is tentative, matching pre-existing behavior.
            if (search_main) {
                // Search production (main) bank files, using the NetSuite-id equivalents of the
                // tentative filters (bank_internal_id/product_internal_id/sub_product_internal_id
                // hold the same NetSuite ids as netsuite_bank_id/netsuite_product_id/netsuite_sub_product_id).
                let whereMain = "";
                const checkWhereMain = () => {
                    whereMain += whereMain.includes("where") ? " and " : "where ";
                };
                if (hasNameFilter) {
                    checkWhereMain();
                    whereMain += `(${nameConditions.join(' or ')})`;
                }
                if (netsuiteBankIdFilter) {
                    checkWhereMain();
                    whereMain += `bank_internal_id = '${netsuiteBankIdFilter}'`;
                }
                if (cityFilter) {
                    checkWhereMain();
                    whereMain += `city like '%${cityFilter}%'`;
                }
                if (stateFilter) {
                    checkWhereMain();
                    whereMain += `state like '%${stateFilter}%'`;
                }
                if (netsuiteProductIdFilter) {
                    checkWhereMain();
                    whereMain += `(product_internal_id = '${netsuiteProductIdFilter}' or sub_product_internal_id = '${netsuiteProductIdFilter}')`;
                }
                if (hasLoanApacFilter) {
                    checkWhereMain();
                    whereMain += buildLoanApacWhereClause(loanNumberFilter, apacNumberFilter);
                }
                if (not_claimed) {
                    checkWhereMain();
                    whereMain += `(lead_claimed = 0 or lead_claimed is null)`;
                }

                const mainResult = await BankService.getBankFiles(pageNumber * pageSize, pageSize, whereMain, 0);
                await ApplicationLogServices?.createExportLog(req, "post_bank_files");
                ResHelper.apiResponse(res, true, "Success", 200, { ...mainResult, match_type: "main" }, "");
                return;
            }

            let where = "";
            const checkWhere = () => {
                where += where.includes("where") ? " and " : "where ";
            };

            // Add combined name filter condition
            if (hasNameFilter) {
                checkWhere();
                where += `(${nameConditions.join(' or ')})`;
            }
            if (netsuiteBankIdFilter) {
                checkWhere();
                where += `netsuite_bank_id = '${netsuiteBankIdFilter}'`;
            }
            if (cityFilter) {
                checkWhere();
                where += `city like '%${cityFilter}%'`;
            }
            if (stateFilter) {
                checkWhere();
                where += `state like '%${stateFilter}%'`;
            }
            if (netsuiteProductIdFilter) {
                checkWhere();
                where += `(netsuite_product_id = '${netsuiteProductIdFilter}' or netsuite_sub_product_id = '${netsuiteProductIdFilter}')`;
            }
            if (hasLoanApacFilter) {
                checkWhere();
                where += buildLoanApacWhereClause(loanNumberFilter, apacNumberFilter);
            }
            if (not_claimed) {
                checkWhere();
                where += `(claimed = 0 or claimed is null)`;
            }

            const payout_request = await BankService.getBankFiles(pageNumber * pageSize, pageSize, where, 1);
            await ApplicationLogServices?.createExportLog(req, "post_bank_files");
            ResHelper.apiResponse(res, true, "Success", 200, { ...payout_request, match_type: "tentative" }, "");
            return;
        };

        // Automation logic: search using combinations of any 3 filters
        // Combine all name filters into a single OR condition
        const nameConditions = [];
        if (customerFirstNameFilter) {
            nameConditions.push(`customer_first_name like '%${customerFirstNameFilter}%'`);
        }
        if (customerLastNameFilter) {
            nameConditions.push(`customer_last_name like '%${customerLastNameFilter}%'`);
        }
        if (custometFullNameFilter) {
            nameConditions.push(`customer_name like '%${custometFullNameFilter}%'`);
            nameConditions.push(`customer_first_name like '%${custometFullNameFilter}%'`);
            nameConditions.push(`customer_last_name like '%${custometFullNameFilter}%'`);
        }
        const nameFilterCombined = nameConditions.length > 0 ? `(${nameConditions.join(' or ')})` : null;

        // Built in lockstep: `filters` (tentative columns) and `mainFilters` (production columns)
        // always end up with the same active keys, since each block adds to both together — only
        // the underlying WHERE-fragment text differs where column names differ (bank/product ids).
        const filters = {};
        const mainFilters = {};

        if (nameFilterCombined) {
            filters.nameFilter = nameFilterCombined;
            mainFilters.nameFilter = nameFilterCombined;
        }
        if (netsuiteBankIdFilter) {
            filters.netsuiteBankIdFilter = `netsuite_bank_id = '${netsuiteBankIdFilter}'`;
            mainFilters.netsuiteBankIdFilter = `bank_internal_id = '${netsuiteBankIdFilter}'`;
        }
        if (cityFilter) {
            filters.cityFilter = `city like '%${cityFilter}%'`;
            mainFilters.cityFilter = `city like '%${cityFilter}%'`;
        }
        if (stateFilter) {
            filters.stateFilter = `state like '%${stateFilter}%'`;
            mainFilters.stateFilter = `state like '%${stateFilter}%'`;
        }
        if (netsuiteProductIdFilter) {
            filters.netsuiteProductIdFilter = `(netsuite_product_id = '${netsuiteProductIdFilter}' or netsuite_sub_product_id = '${netsuiteProductIdFilter}')`;
            mainFilters.netsuiteProductIdFilter = `(product_internal_id = '${netsuiteProductIdFilter}' or sub_product_internal_id = '${netsuiteProductIdFilter}')`;
        }
        if (hasLoanApacFilter) {
            const loanApacClause = buildLoanApacWhereClause(loanNumberFilter, apacNumberFilter);
            filters.loanApacFilter = loanApacClause;
            mainFilters.loanApacFilter = loanApacClause;
        }

        const activeFilters = Object.entries(filters).filter(([key, value]) => value !== null);

        if (activeFilters.length < 3) {
            ResHelper.apiResponse(res, false, "Please provide enough data for automation!", 400, {}, "");
            return;
        };

        const filterKeys = activeFilters.map(([key]) => key);
        const combinations = getCombinations(filterKeys, 3);

        // search_main picks exactly one table for the whole combination search — never both.
        const activeFilterMap = search_main ? mainFilters : filters;
        const claimedClause = search_main ? `(lead_claimed = 0 or lead_claimed is null)` : `(claimed = 0 or claimed is null)`;
        const tableFlag = search_main ? 0 : 1;

        for (const combination of combinations) {
            let where = combination.map((key) => activeFilterMap[key]).join(" and ");
            where += ` and ${claimedClause} `;
            const result = await BankService.getBankFiles(pageNumber * pageSize, pageSize, `where ${where}`, tableFlag);
            if (Boolean(result?.bank_files?.length > 0)) {
                await ApplicationLogServices?.createExportLog(req, "post_bank_files");
                ResHelper.apiResponse(res, true, "Success", 200, { ...result, combination, match_type: search_main ? "main" : "tentative" }, "");
                return;
            }
        };
        ResHelper.apiResponse(res, false, "No results found for any combination of 3 filters.", 200, {}, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

// Helper function to generate combinations
const getCombinations = (array, size) => {
    const result = [];
    const helper = (start, combo) => {
        if (combo.length === size) {
            result.push([...combo]);
            return;
        }
        for (let i = start; i < array.length; i++) {
            combo.push(array[i]);
            helper(i + 1, combo);
            combo.pop();
        }
    };
    helper(0, []);
    return result;
};


const getBankFileLogs = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getBankFileLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize, api_type_filter, name_filter, phone_filter, email_filter, api_filter, payload_filter, has_error_filter, reponse_filter } = req.body;
            if (!pageNumber) { pageNumber = 0 };
            if (!pageSize) { pageSize = 100 };

            let checkWhere = () => {
                if (where.includes("where")) {
                    where += " and "
                } else {
                    where += "where "
                }
            }

            let where = "";
            if (api_type_filter) {
                checkWhere();
                where += `l.api_type like '%${api_type_filter}%'`
            }
            if (name_filter) {
                checkWhere();
                where += `u.name like '%${name_filter}%'`
            }
            if (phone_filter) {
                checkWhere();
                where += `u.phone like '%${phone_filter}%'`
            }
            if (email_filter) {
                checkWhere();
                where += `u.email like '%${email_filter}%'`
            }
            if (api_filter) {
                checkWhere();
                where += `l.api like '%${api_filter}%'`
            }
            if (payload_filter) {
                checkWhere();
                where += `l.payload like '%${payload_filter}%'`
            }
            if (payload_filter) {
                checkWhere();
                where += `l.payload like '%${payload_filter}%'`
            }
            if (has_error_filter) {
                checkWhere();
                where += `l.has_error like '%${has_error_filter == "yes" ? 1 : 0}%'`
            }
            if (reponse_filter) {
                checkWhere();
                where += `l.reponse like '%${reponse_filter}%'`
            }
            let payout_request = await BankService.getBankFileLogs(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, payout_request, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const addBankProductCombination = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.addBankProductCombination.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bank_id, product_ids } = req.body;
            let details = await BankService.addBankProductCombination(bank_id, product_ids);
            ResHelper.apiResponse(res, true, "Success", 201, details, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const addBankProductCombinationRegex = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.addBankProductCombinationRegex.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            function generateKeyValuePairs(array) {
                return array.reduce((acc, item) => {

                    if (item?.sample) {
                        if (!matchesRegex(item?.sample, item?.validation)) {
                            return {
                                error: true,
                                message: `Invalid sample ${item?.sample} for ${item?.validation}`
                            };
                        }
                    }

                    if (item.key && item.validation) {
                        if (acc[item.key]) {
                            acc[item.key].push(item.validation);
                        } else {
                            acc[item.key] = [item.validation];
                        }

                        if (acc[`${item.key}_sample`]) {
                            acc[`${item.key}_sample`].push(item.sample);
                        } else {
                            acc[`${item.key}_sample`] = [item.sample];
                        }
                    }
                    return acc;
                }, {});
            };

            let { product_id, bank_id, regex } = req?.body;
            regex = generateKeyValuePairs(regex);
            if (regex?.error) {
                ResHelper.apiResponse(res, false, regex?.message, 400, {}, "");
                return;
            }
            let details = await BankService.addBankProductCombinationRegex(bank_id, product_id, regex);
            ResHelper.apiResponse(res, true, "Success", 201, details, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getBankProductCombinationRegex = async (req, res, next) => {
    try {
        const { bank_id, product_id } = req?.body;
        let data = await BankService.getBankProductCombinationRegex(bank_id, product_id);
        console.log(data)
        ResHelper.apiResponse(res, true, "Success", 200, data, "");
    } catch (err) {
        console.log(err);
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getBankProductCombinationByBankId = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getBankProductCombinationByBankId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bank_id } = req.body;
            let details = await BankService.getBankProductCombinationByBankId(bank_id);
            ResHelper.apiResponse(res, true, "Success", 200, details, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getMatchingProductsByLoanOrApac = async (req, res, next) => {
    try {
        req.body = (req.loggedInUser || req.dsa) ? req.body : req.query;
        const { error } = BankDetailValidationV1.getMatchingProductsByLoanOrApac.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bank_id, loan_number, apac_ref_los_number, product_id } = req.body;
            let details = await BankService.getMatchingProductsByLoanOrApac(bank_id, loan_number, apac_ref_los_number, product_id);
            ResHelper.apiResponse(res, true, "Success", 200, details, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getBankFileDetail = async (req, res, next) => {
    try {
        const { error } = BankDetailValidationV1.getBankFileDetail.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { is_tentative = 0 } = req.body;
            let details = await BankService.getBankFileDetail(req?.body?.bank_file_id, is_tentative);
            ResHelper.apiResponse(res, true, "Success", 200, details, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createOrEditBranchSalePeople = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.createOrEditBranchSalePeople.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            req.body["created_by"] = req?.loggedInUser?.userName;
            req.body["updated_by"] = req?.loggedInUser?.userName;
            await BankService.createOrEditBranchSalePeople(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        console.log(err)
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllBranchSalePeople = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.getAllBranchSalePeople.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { page_number, page_size, pincode_filter, city_filter, code_filter, sp_id_filter, sp_name_filter, sp_email_filter, sp_mobile_filter, product_id_filter, created_by_filter, updated_by_filter } = req?.body;
            if (!page_number) {
                page_number = 0
            }
            if (!page_size) {
                page_size = 10
            }

            let where = "";
            let checkWhere = () => {
                if (where.includes("where")) {
                    where += " and "
                } else {
                    where += "where "
                }
            }
            if (pincode_filter) {
                checkWhere();
                where += `pincode like '%${pincode_filter}%'`
            }
            if (city_filter) {
                checkWhere();
                where += `city like '%${city_filter}%'`
            }
            if (code_filter) {
                checkWhere();
                where += `code like '%${code_filter}%'`
            }
            if (sp_id_filter) {
                checkWhere();
                where += `sp_id like '%${sp_id_filter}%'`
            }
            if (sp_name_filter) {
                checkWhere();
                where += `sp_name like '%${sp_name_filter}%'`
            }
            if (sp_email_filter) {
                checkWhere();
                where += `sp_email like '%${sp_email_filter}%'`
            }
            if (sp_mobile_filter) {
                checkWhere();
                where += `sp_mobile like '%${sp_mobile_filter}%'`
            }
            if (product_id_filter) {
                checkWhere();
                where += `product_id like '%${product_id_filter}%'`
            }
            if (created_by_filter) {
                checkWhere();
                where += `created_by like '%${created_by_filter}%'`
            }
            if (updated_by_filter) {
                checkWhere();
                where += `updated_by like '%${updated_by_filter}%'`
            }

            let product = await BankService.getAllBranchSalePeople(page_number * page_size, page_size, where);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteBranchSalePeopleById = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.deleteBranchSalePeopleById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            await BankService.deleteBranchSalePeopleById(req?.body?.id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createOrUpdateNetsuiteBank = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.createOrUpdateNetsuiteBank.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            const { netsuite_bank_id, bank_name, status, id, registered_on_company_name, pan, grade, external_id, remarks } = req.body;
            const userId = req.loggedInUser.id;
            let bank = await findBankNameById(netsuite_bank_id);
            if (bank && id != bank.id) return ResHelper.apiResponse(res, false, "NetSuite Bank Id Already Exists", 409, {}, ""); // bank with same netsuite_bank_id already exists
            let prevData = null;
            if (id) {
                prevData = await BankService.getNetsuiteBankById(id);
            }
            let result = await BankService.createOrUpdateNetsuiteBank({ netsuite_bank_id, bank_name, id, status, registered_on_company_name, pan, grade, external_id, remarks }, prevData, userId);
            if (id) {
                const difference = jsonDifference({ ...prevData }, { ...req.body });
                ApplicationLogServices.bulkCreate(difference, id, "netsuite_bank_update", userId)
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteNetsuiteBank = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.deleteNetsuiteBank.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            const { bank_id } = req.body;
            let result = await BankService.deleteNetsuiteBank(bank_id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getNetsuiteBankById = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.getNetsuiteBankById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            let { bank_id } = req.body
            let result = await BankService.getNetsuiteBankById(bank_id)
            ResHelper.apiResponse(res, true, "Success", 200, result, "");
        }
    }
    catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllBankProductDetails = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.getAllBankProductDetails.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            let { slab_internal_id } = req.body
            let result = await BankService.getAllBankProductDetails(slab_internal_id)
            return ResHelper.apiResponse(res, true, "Success", 200, result, "");
        }
    }
    catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getBankProductCombinationHistory = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.getBankProductCombinationHistory.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            let { bank_product_combinations_id } = req.body
            let result = await BankService.getBankProductCombinationHistory(bank_product_combinations_id)
            return ResHelper.apiResponse(res, true, "Success", 200, result, "");
        }
    }
    catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

// CRM-owned identity fields only - GRO/Lender details + offline-bank (B2B) config.
// See api/services/bank-services.js:updateBankProductGroDetails for the column scope
// and why NetSuite-synced fields are deliberately excluded.
const updateBankProductGroDetails = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.updateBankProductGroDetails.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        const { bank_id, product_id } = req.body;
        const prevData = await BankService.getBankProductCombinationByNetsuiteIds(bank_id, product_id);
        if (!prevData) {
            return ResHelper.apiResponse(res, false, "Bank product combination not found", 404, {}, "");
        }

        const result = await BankService.updateBankProductGroDetails(req.body);

        const difference = jsonDifference(prevData, req.body);
        const userId = req?.loggedInUser?.id;
        ApplicationLogServices.bulkCreate(difference, prevData.id, "bank_product_gro_details_update", userId);

        return ResHelper.apiResponse(res, true, "Success", 200, result, "");
    }
    catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateBankProductStatus = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.updateBankProductStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }
        else {
            const { product_id, bank_id, status } = req?.body;
            
            let result = await BankService.updateBankProductStatus({ bank_id, product_id, status });
            
            return ResHelper.apiResponse(res, true, "Status updated successfully", 200, result, "");
        }
    }
    catch (error) {
        console.log(error);
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateAutonomousPayoutCapping = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.updateAutonomousPayoutCapping.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const isMaster = await isFinanceRootUser(req?.loggedInUser?.userPhone);
        if (!isMaster) {
            return ResHelper.apiResponse(res, false, "Permission Denied", 403, {}, "");
        }

        const { bank_id, product_id, autonomous_payout_capping } = req.body;
        const prevData = await BankService.getBankProductCombinationByNetsuiteIds(bank_id, product_id);
        if (!prevData) {
            return ResHelper.apiResponse(res, false, "Bank product combination not found", 404, {}, "");
        }

        const newValue = autonomous_payout_capping === "" ? null : autonomous_payout_capping;
        const oldValue = prevData.autonomous_payout_capping;

        if (oldValue == newValue || (oldValue == null && newValue == null)) {
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }

        await BankService.updateAutonomousPayoutCapping({ bank_id, product_id, autonomous_payout_capping: newValue });

        await ApplicationLogServices.bulkCreate(
            [["autonomous_payout_capping", oldValue ?? "", newValue ?? ""]],
            String(prevData.id),
            "bank_product_autonomous_payout_capping_update",
            req.loggedInUser.id
        );

        return ResHelper.apiResponse(res, true, "Autonomous payout capping updated successfully", 200, {}, "");
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateMaxPayoutCapping = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.updateMaxPayoutCapping.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        const isMaster = await isFinanceRootUser(req?.loggedInUser?.userPhone);
        if (!isMaster) {
            return ResHelper.apiResponse(res, false, "Permission Denied", 403, {}, "");
        }

        const { bank_id, product_id, max_payout_capping } = req.body;
        const prevData = await BankService.getBankProductCombinationByNetsuiteIds(bank_id, product_id);
        if (!prevData) {
            return ResHelper.apiResponse(res, false, "Bank product combination not found", 404, {}, "");
        }

        const newValue = max_payout_capping === "" ? null : max_payout_capping;
        const oldValue = prevData.max_payout_capping;

        if (oldValue == newValue || (oldValue == null && newValue == null)) {
            return ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }

        await BankService.updateMaxProductPayoutCap({ bank_id, product_id, max_payout_capping: newValue });

        await ApplicationLogServices.bulkCreate(
            [["max_payout_capping", oldValue ?? "", newValue ?? ""]],
            String(prevData.id),
            "bank_product_max_payout_capping_update",
            req.loggedInUser.id
        );

        return ResHelper.apiResponse(res, true, "Max payout capping updated successfully", 200, {}, "");
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const importBankMaster = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.importBankMaster.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, '');
        }
        const result = await BankService.importBankMaster(req.body);
        ResHelper.apiResponse(res, true, 'Banks imported successfully', 200, result, '');
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, e.message || 'Error occurred during execution', 500, {}, '');
    }
};

const getBankMasterDropdown = async (req, res) => {
    try {
        const { error } = BankDetailValidationV1.getBankMasterDropdown.validate(req.query);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, '');
        }
        const banks = await BankService.getBankMasterDropdown(req.query.search || null);
        ResHelper.apiResponse(res, true, 'Success', 200, banks, '');
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, 'Error occurred during execution', 500, {}, '');
    }
};

module.exports = {
    getBank,
    getState,
    getCity,
    getProduct,
    getMarketType,
    getBankDetail,
    confirmationMailAllowed,
    getAllStates,
    getAllCityForState,
    uploadBank,
    uploadBankFileData,
    deleteAllBanks,
    getAllBanks,
    getBankDetailById,
    createBank,
    deleteBankById,
    submitClaimBankFile,
    getBankFiles,
    getStateForBankFiles,
    getBankFileDetail,
    getBankFileLogs,
    getAllBranchSalePeople,
    deleteBranchSalePeopleById,
    createOrEditBranchSalePeople,
    getBankFilesNearBySearch,
    getTentativeBankFilesNearBySearch,
    addBankProductCombination,
    addBankProductCombinationRegex,
    getBankProductCombinationByBankId,
    getMatchingProductsByLoanOrApac,
    getBankProductCombinationRegex,
    createOrUpdateNetsuiteBank,
    deleteNetsuiteBank,
    getNetsuiteBankById,
    getAllBankProductDetails,
    getBankProductCombinationHistory,
    updateBankProductGroDetails,
    updateBankProductStatus,
    updateAutonomousPayoutCapping,
    updateMaxPayoutCapping,
    importBankMaster,
    getBankMasterDropdown,
};



