const Payout = require("../../../../models/PayoutList");
const { logger } = require("../../../helpers/logger");
const nodeAcl = require("../../../helpers/acl-middleware/acl-permissions.js");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
let PayoutService = require(_pathconst.ServicesPath.PayoutService);
let PayoutValidationV1 = require(_pathconst.ReqModelsPath.PayoutValidationV1);



const getBank = async (req, res, next) => {
    try {
        let banks = await PayoutService.getDistinctSingleProperty('bank_name');
        ResHelper.apiResponse(res, true, "Success", 200, banks, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getProductGroup = async (req, res, next) => {
    try {
        const { error } = PayoutValidationV1.getProductGroup.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bankName } = req.body;
            const isFiltered = Boolean(bankName) ? [['bank_name', bankName]] : "";
            let productGroups = await PayoutService.getDistinctSingleProperty('product_group', isFiltered);
            ResHelper.apiResponse(res, true, "Success", 200, productGroups, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getMainProduct = async (req, res, next) => {
    try {
        const { error } = PayoutValidationV1.getMainProduct.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bankName, productGroup } = req.body;
            let arr = [];
            if (bankName) { arr.push(['bank_name', bankName]) };
            if (productGroup) { arr.push(['product_group', productGroup]) };
            let mainProducts = await PayoutService.getDistinctSingleProperty('main_product', arr);
            ResHelper.apiResponse(res, true, "Success", 200, mainProducts, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getProduct = async (req, res, next) => {
    try {
        const { error } = PayoutValidationV1.getProduct.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { bankName, productGroup, mainProduct } = req.body;
            let arr = [];
            if (bankName) { arr.push(['bank_name', bankName]) };
            if (productGroup) { arr.push(['product_group', productGroup]) };
            if (mainProduct) { arr.push(['main_product', mainProduct]) };
            let products = await PayoutService.getDistinctSingleProperty('product', arr);
            ResHelper.apiResponse(res, true, "Success", 200, products, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getPayout = async (req, res, next) => {
    try {
        const { error } = PayoutValidationV1.getPayout.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { bankName, productGroup, mainProduct, product, pageNumber, pageSize, } = req.body;
            let where = [];
            if (bankName) {
                where.push(['bank_name', bankName]);
            }
            if (productGroup) {
                where.push(['product_group', productGroup]);
            }
            if (mainProduct) {
                where.push(['main_product', mainProduct]);
            }
            if (product) {
                where.push(['product', product]);
            }
            let payouts = await PayoutService.getPayout(where, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, payouts, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}



module.exports = {
    getBank,
    getProductGroup,
    getMainProduct,
    getProduct,
    getPayout
};


