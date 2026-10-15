//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { uploadToS3 } = require("../../../helpers/commonhelper");
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let B2CLeadServices = require(_pathconst.ServicesPath.B2CLeadServices);
let B2CLeadValidationV1 = require(_pathconst.ReqModelsPath.B2CLeadValidationV1);
let uuid = require('node-uuid');

const getB2cLeads = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.getB2cLeads.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { endDateFilter, startDateFilter, pageNumber, pageSize, full_name_filter, mobile_number_filter, email_filter, loan_type_filter, utm_source_filter, utm_medium_filter, utm_campaign_filter } = req?.body;

            let checkWhere = () => {
                if (where.includes("where")) {
                    where += " and "
                } else {
                    where += "where "
                }
            }

            let where = " where u.is_lead = 1 ";
            if (full_name_filter) {
                checkWhere();
                where += `u.full_name like '%${full_name_filter}%'`
            }
            if (mobile_number_filter) {
                checkWhere();
                where += `u.mobile_number like '%${mobile_number_filter}%'`
            }
            if (email_filter) {
                checkWhere();
                where += `u.email like '%${email_filter}%'`
            }
            if (loan_type_filter) {
                checkWhere();
                where += `ul.loan_type like '%${loan_type_filter}%'`
            }
            if (utm_source_filter) {
                checkWhere();
                where += `ul.utm_source like '%${utm_source_filter}%'`
            }
            if (utm_medium_filter) {
                checkWhere();
                where += `ul.utm_medium like '%${utm_medium_filter}%'`
            }
            if (utm_campaign_filter) {
                checkWhere();
                where += `ul.utm_campaign like '%${utm_campaign_filter}%'`
            }

            if (startDateFilter) {
                checkWhere();
                where += ` date(ul.created_at) between date("${startDateFilter}") and date ("${endDateFilter}") `;
            };

            let B2cLeads = await B2CLeadServices.getB2cLeads(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, B2cLeads, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getB2cLeadsById = async (req, res) => {
    try {
        const { error } = B2CLeadValidationV1.getB2cLeadsById.validate(req.body);
        const { } = req?.body;
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { user_id, pageNumber, pageSize } = req?.body;
            let where = ` where u.user_id  = '${user_id}' `;
            let B2cLeads = await B2CLeadServices.getB2cLeadsById(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, B2cLeads, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllHyperlinkContent = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.getAllHyperlinkContent.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { status_filter, pageNumber, pageSize, location_filter, loan_type_filter, content_type_filter, title_filter, meta_title_filter, description_filter, note_filter } = req?.body;

            let checkWhere = () => {
                if (where.includes("where")) {
                    where += " and "
                } else {
                    where += "where "
                }
            }

            let where = "";
            if (location_filter) {
                checkWhere();
                where += `location like '%${location_filter}%'`
            }
            if (loan_type_filter) {
                checkWhere();
                loan_type_filter = loan_type_filter?.trim()?.toLowerCase()?.split(" ")?.join('_');
                where += `loan_type like '%${loan_type_filter}%'`
            }
            if (content_type_filter) {
                checkWhere();
                where += `content_type like '%${content_type_filter}%'`
            }
            if (title_filter) {
                checkWhere();
                where += `title like '%${title_filter}%'`
            }
            if (meta_title_filter) {
                checkWhere();
                where += `meta_title like '%${meta_title_filter}%'`
            }
            if (description_filter) {
                checkWhere();
                where += `description like '%${description_filter}%'`
            }
            if (note_filter) {
                checkWhere();
                where += `note like '%${note_filter}%'`
            }
            if (status_filter) {
                checkWhere();
                where += ` case when status = 0 then "Uat" else "Prod" end like '%${status_filter}%' `
            }

            let B2cLeads = await B2CLeadServices.getAllHyperlinkContent(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, B2cLeads, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const insertHyperlinkContent = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.insertHyperlinkContent.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { loan_type, location, icon, id, content_type } = req?.body;
            let isExist = await B2CLeadServices.checkIfHyperlinkExisit(loan_type, location, content_type, id);
            if (isExist) {
                ResHelper.apiResponse(res, true, "Hyperlink already exist with same loan type and location.", 400, {}, "");
                return;
            };
            let imageId = uuid();
            if (!icon?.includes("https://") && icon) {
                req.body.icon = await uploadToS3('crm_components_meta', icon, `heyperlink-content-icon${imageId}`, 'image/jpeg', "jpg");
            };
            req.body.location = location?.trim();
            req.body.loan_type = loan_type?.trim()?.toLowerCase()?.split(" ")?.join('_');
            let alias = loan_type.toLowerCase().split(" ").join('-') + "-" + location.toLowerCase();
            await B2CLeadServices.insertHyperlinkContent({ ...req.body, alias });
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteHyperlinkContent = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.deleteHyperlinkContent.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            await B2CLeadServices.deleteHyperlinkContent(req?.body?.id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getHyperlinkContentExtended = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.getHyperlinkContentExtended.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { pageNumber, pageSize, content_id } = req?.body;
            let B2cLeads = await B2CLeadServices.getHyperlinkContentExtended(pageNumber * pageSize, pageSize, content_id);
            ResHelper.apiResponse(res, true, "Success", 200, B2cLeads, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const insertHyperlinkContentExtended = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.insertHyperlinkContentExtended.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            await B2CLeadServices.insertHyperlinkContentExtended(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteHyperlinkContentExtended = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.deleteHyperlinkContentExtended.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            await B2CLeadServices.deleteHyperlinkContentExtended(req?.body?.id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getHyperlinkLocationExternal = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.getHyperlinkLocationExternal.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let location = await B2CLeadServices.getHyperlinkLocationExternal(req?.body.loan_type);
            ResHelper.apiResponse(res, true, "Success", 200, location, "");
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getHyperlinkDataExternal = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.getHyperlinkDataExternal.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { loan_type, location } = req?.body;
            let B2cLeads = await B2CLeadServices.getHyperlinkDataExternal(loan_type, location);
            ResHelper.apiResponse(res, true, "Success", 200, B2cLeads, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getHyperlinkLocation = async (req, res, next) => {
    try {
        let locations = await B2CLeadServices.getHyperlinkLocation();
        ResHelper.apiResponse(res, true, "Success", 200, locations, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getB2cUserQueries = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.getB2cUserQueries.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { pageNumber, pageSize, filterModel, sortBy, sortDirection } = req.body;

            let where = "";
            const checkWhere = () => (where.includes("where") ? " and " : "where ");


            filterModel.items.forEach(item => {
                const { field, operator, value } = item;
                where += checkWhere();
                switch (operator) {
                    case 'contains':
                        where += `${getFieldMapping(field)} like '%${value}%'`;
                        break;
                    case 'doesNotContain':
                        where += `${getFieldMapping(field)} not like '%${value}%'`;
                        break;
                    case 'equals':
                        where += `${getFieldMapping(field)} = '${value}'`;
                        break;
                    case 'doesNotEqual':
                        where += `${getFieldMapping(field)} != '${value}'`;
                        break;
                    case 'startsWith':
                        where += `${getFieldMapping(field)} like '${value}%'`;
                        break;
                    case 'endsWith':
                        where += `${getFieldMapping(field)} like '%${value}'`;
                        break;
                    case 'isEmpty':
                        where += `${getFieldMapping(field)} IS NULL OR ${getFieldMapping(field)} = ''`;
                        break;
                    case 'isNotEmpty':
                        where += `${getFieldMapping(field)} IS NOT NULL AND ${getFieldMapping(field)} != ''`;
                        break;
                    case 'isAnyOf':
                        if (Array.isArray(value) && value.length > 0) {
                            const quotedValues = value.map(v => `'${v}'`).join(', ');
                            where += `${getFieldMapping(field)} IN (${quotedValues})`;
                        }
                        break;
                    case 'dateRange':
                        if (field === 'createdAt' && value?.startDate && value?.endDate) {
                            where += `date(uq.created_at) BETWEEN date('${value.startDate}') AND date('${value.endDate}')`;
                        }
                        break;
                    default:
                        // Handle default case or ignore unknown operator
                        break;
                }
            });
            let B2cLeads = await B2CLeadServices.getB2cUserQueries(pageNumber * pageSize, pageSize, where, sortBy, sortDirection);
            return ResHelper.apiResponse(res, true, "Success", 200, B2cLeads, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};



const getFieldMapping = (field) => {
    switch (field) {
        case 'user_name':
            return 'u.full_name';
        case 'mobile_number':
            return 'u.customer_mobile_number';
        case 'email':
            return 'u.email_address';
        case 'title':
            return 'uq.title';
        case 'description':
            return 'uq.description';
        case 'status':
            return 'uq.status';
        case 'reply':
            return 'uq.reply';
        case 'reply_by_name':
            return 'ru.name';
        case 'createdAt':
            return 'uq.created_at';
        default:
            return field; // Default to the same name if no mapping
    }
};

const copyHyperLinkContent = async (req, res, next) => {
    try {
        const { error } = B2CLeadValidationV1.copyHyperLinkContent.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { content_id } = req?.body;

            let contentExist = await B2CLeadServices.checkIfContentExist(req?.body);
            if (!contentExist) {
                return ResHelper.apiResponse(res, false, "Target not found!", 400, {}, "");
            };

            let contentToBeCopied = await B2CLeadServices.getHyperlinkContentExtended(null, null, content_id);
            if (contentToBeCopied?.totalCount == "0") {
                return ResHelper.apiResponse(res, false, "No associated details found!", 400, {}, "");
            };

            await B2CLeadServices.deleteHyperlinkContent(contentExist?.id, false);
            let insertData = [];
            for (i = 0; i < contentToBeCopied?.records?.length; i++) {
                const { id, ...rest } = contentToBeCopied?.records[i];
                insertData?.push(rest);
            };
            await B2CLeadServices.insertHyperlinkContentExtended({ content_id: contentExist?.id, data: insertData });
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

module.exports = {
    getB2cLeads,
    getAllHyperlinkContent,
    insertHyperlinkContent,
    deleteHyperlinkContent,
    insertHyperlinkContentExtended,
    getHyperlinkContentExtended,
    deleteHyperlinkContentExtended,
    getHyperlinkLocationExternal,
    getHyperlinkDataExternal,
    getHyperlinkLocation,
    getB2cLeadsById,
    getB2cUserQueries,
    copyHyperLinkContent
};