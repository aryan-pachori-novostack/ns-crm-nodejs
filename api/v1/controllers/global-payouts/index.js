const { logger } = require("../../../helpers/logger");
const { CreateWhereQueryFilter, CustomOperatorHandlers, formatGetLeadFormsFilterClause } = require("../../../helpers/commonhelper");
const { getGlobalPayoutsFieldMapping } = require("../../../helpers/apiFieldMappings");
let GlobalPayoutsValidationV1 = require(_pathconst.ReqModelsPath.GlobalPayoutsValidationV1);
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let GlobalPayoutService = require(_pathconst.ServicesPath.GlobalPayoutService);
let { uploadPayoutQueue } = require(_pathconst.FilesPath.Queue);
let PayoutService = require(_pathconst.ServicesPath.PayoutService);

const createPayouts = async (req, res, next) => {
    try {
        const { error } = GlobalPayoutsValidationV1.globalPayouts.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { id, bank_name, avg_achievement, short_name, product, registered_on_company_name, main_product, sub_product, product_group, agreement_expired_by, enrollment_date, billing_mode, login_code, address, max_payout, billing_date_from, billing_date_to, applicable_from, applicable_to, remarks, type, type_of_payout, company_category, billing_cycle, payment_term, minimum_pf, minimum_irr, minimum_insurance, link, payout_slabs } = req.body;
            if (agreement_expired_by) {
                agreement_expired_by = new Date(agreement_expired_by)
            }
            if (enrollment_date) {
                enrollment_date = new Date(enrollment_date)
            }
            let payout = await GlobalPayoutService.createPayouts({
                id, bank_name, short_name, avg_achievement, registered_on_company_name, product, main_product, sub_product, product_group, agreement_expired_by, enrollment_date, billing_mode, login_code, address, max_payout, billing_date_from, billing_date_to, applicable_from, applicable_to, remarks, type, type_of_payout, company_category, billing_cycle, payment_term, minimum_pf, minimum_irr, minimum_insurance, link
            });
            if (type == 'slab') {
                if (payout_slabs && payout_slabs.length != 0) {
                    for (let i = 0; i < payout_slabs.length; i++) {
                        let { rate, disb_amount_from, disb_amount_to } = payout_slabs[i];
                        await GlobalPayoutService.createPayoutSlab(payout.id, rate, disb_amount_from, disb_amount_to);
                    }
                }
            }
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (error) {
        console.log(error)
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updatePayouts = async (req, res, next) => {
    try {
        const { error } = GlobalPayoutsValidationV1.updatePayouts.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { id, bank_name, short_name, avg_achievement, product, registered_on_company_name, main_product, sub_product, product_group, agreement_expired_by, enrollment_date, billing_mode, login_code, address, max_payout, billing_date_from, billing_date_to, applicable_from, applicable_to, remarks, type, type_of_payout, company_category, billing_cycle, payment_term, minimum_pf, minimum_irr, minimum_insurance, link, payout_slabs , bank_id, product_id} = req.body;
            let update_payouts = await GlobalPayoutService.findGlobalPayoutsId(id);
            if (!update_payouts) {
                ResHelper.apiResponse(res, false, " Email Template Not Found", 400, {}, "");
            } else {
                if (agreement_expired_by) {
                    agreement_expired_by = new Date(agreement_expired_by)
                }
                if (enrollment_date) {
                    enrollment_date = new Date(enrollment_date)
                }
                let updated_by = req.loggedInUser.id;
                let updated_at = new Date();
                update_payouts = await GlobalPayoutService.updatePayouts(id, { bank_name, short_name, registered_on_company_name, product, main_product, sub_product, product_group, agreement_expired_by, enrollment_date, billing_mode, login_code, address, max_payout, billing_date_from, billing_date_to, applicable_from, applicable_to, remarks, avg_achievement, type, type_of_payout, company_category, billing_cycle, payment_term, minimum_pf, minimum_irr, minimum_insurance, link, updated_by, updated_at ,bank_id, product_id});
                if (type == 'slab') {
                    if (payout_slabs && payout_slabs.length != 0) {
                        for (let i = 0; i < payout_slabs.length; i++) {
                            let { id: slab_id, rate, disb_amount_from, disb_amount_to } = payout_slabs[i];
                            if (slab_id) {
                                await GlobalPayoutService.updatePayoutSlab(slab_id, rate, disb_amount_from, disb_amount_to);
                            } else {
                                await GlobalPayoutService.createPayoutSlab(id, rate, disb_amount_from, disb_amount_to);
                            }

                        }
                    }
                }
                ResHelper.apiResponse(res, true, "Success", 201, {}, "");
            }
        }
    }
    catch (error) {
        console.log(error)
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllPayouts = async (req, res, next) => {
    try {
        const { error } = GlobalPayoutsValidationV1.getPayouts.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { bank_id_filter, product_id_filter, login_code_filter, startDateFilter, endDateFilter, pageNumber, pageSize, search, bank_name, product, main_product, sub_product, product_group, type, avg_achievement, enrollment_date, filterModel, logicOperator } = req.body;
            if (!pageNumber) {
                pageNumber = 0;
            }
            if (!pageSize) {
                pageSize = 100;
            }

            // Legacy filters — unchanged behaviour
            let where = [];
            if (startDateFilter) {
                where.push([`DATE(p.created_at)`, ` between DATE("${startDateFilter}") and DATE("${endDateFilter}")`])
            }
            if (bank_name) {
                where.push([`p.bank_name like '%${bank_name}%'`, ""])
            }
            if (bank_id_filter) {
                where.push([`p.bank_id like '%${bank_id_filter}%'`, ""])
            }
            if (product_id_filter) {
                where.push([`p.product_id like '%${product_id_filter}%'`, ""])
            }
            if (login_code_filter) {
                where.push([`p.login_code like '%${login_code_filter}%'`, ""])
            }
            if (product) {
                where.push([`p.product like '%${product}%'`, ""])
            }
            if (main_product) {
                where.push([`p.main_product like '%${main_product}%'`, ""])
            }
            if (sub_product) {
                where.push([`p.sub_product like '%${sub_product}%'`, ""])
            }
            if (product_group) {
                where.push([`p.product_group like '%${product_group}%'`, ""])
            }
            if (type) {
                where.push([`p.type like '%${type}%'`, ""])
            }
            if (avg_achievement) {
                where.push([`p.avg_achievment = ${avg_achievement}`, ""])
            }
            if (enrollment_date) {
                where.push([`DATE(p.enrollment_date) = DATE('${enrollment_date}')`, ""])
            }

            // MUI X DataGrid filterModel — same pattern as getLeadForms
            let whereFilterQuery = "";
            if (filterModel && filterModel.items.length > 0) {
                const operatorHandlers = CustomOperatorHandlers();
                const whereFilterArray = CreateWhereQueryFilter(filterModel, getGlobalPayoutsFieldMapping, operatorHandlers);

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
                where.push([`(${whereFilterQuery})`, ""])
            }

            let searchList = [];
            if (search) {
                searchList.push(['p.bank_name', 'like', `%${search}%`]);
                searchList.push(['p.registered_on_company_name', 'like', `%${search}%`]);
                searchList.push(['p.main_product', 'like', `%${search}%`]);
                searchList.push(['p.sub_product', 'like', `%${search}%`]);
                searchList.push(['p.product_group', 'like', `%${search}%`]);
                searchList.push(['p.product', 'like', `%${search}%`]);
                searchList.push(['p.address', 'like', `%${search}%`]);
            }
            let update_payouts = await GlobalPayoutService.getAllPayouts(pageNumber * pageSize, pageSize, where, searchList);
            ResHelper.apiResponse(res, true, "Success", 200, update_payouts, "");
        }
    }
    catch (error) {
        console.log(error)
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const findGlobalPayoutsId = async (req, res, next) => {
    try {
        const { error } = GlobalPayoutsValidationV1.getById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            let update_payouts = await GlobalPayoutService.findGlobalPayoutsId(id);
            ResHelper.apiResponse(res, true, "Success", 201, update_payouts, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }

}

const deletePayouts = async (req, res, next) => {
    try {
        const { error } = GlobalPayoutsValidationV1.getById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            let update_payouts = await GlobalPayoutService.deletePayouts(id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }

}

const deleteAllPayouts = async (req, res, next) => {
    try {
        let update_payouts = await GlobalPayoutService.deleteAllPayouts();
        ResHelper.apiResponse(res, true, "Success", 201, {}, "");
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }
}

const uploadPayout = async (req, res, next) => {
    try {
        const { error } = GlobalPayoutsValidationV1.uploadPayout.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let file = req.body.file;
            uploadPayoutQueue.add({ file: file, loggedInUser: req.loggedInUser });
            ResHelper.apiResponse(res, true, "success", 201, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const findGlobalPayoutByBankName = async (req, res, next) => {
    try {
        const { error } = GlobalPayoutsValidationV1.findGlobalPayoutByBankName.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { bank_name, product_name, dsa_mobile_number } = req.body;
            let globalPayout = await GlobalPayoutService.findGlobalPayoutByBankName(bank_name, product_name);
            if (!globalPayout) return ResHelper.apiResponse(res, false, "No Such Payout Found", 400, {}, "")
            let payout = await PayoutService.findPayoutByPayoutIdAndDsaMobile(globalPayout.id, dsa_mobile_number);
            if (!payout) return ResHelper.apiResponse(res, false, "No Payout Found For This User", 400, {}, "")
            ResHelper.apiResponse(res, true, "success", 201, { payout_percentage: payout.percentage }, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

module.exports = {
    createPayouts,
    updatePayouts,
    getAllPayouts,
    findGlobalPayoutsId,
    deletePayouts,
    uploadPayout,
    deleteAllPayouts,
    findGlobalPayoutByBankName
}