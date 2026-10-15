const bcrypt = require("bcrypt");
const { v4: isUuid } = require('uuid');
const { logger } = require("../../../helpers/logger");
const { makeRequest } = require("../../../helpers/commonhelper");
let EmailValidationV1 = require(_pathconst.ReqModelsPath.EmailValidationV1);
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let EmailService = require(_pathconst.ServicesPath.EmailService);

const createEmail = async (req, res, next) => {
    try {
        const { error } = EmailValidationV1.emailCreate.validate(req.body);
        console.log("BODY", req.body)
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            console.log('ERRROR', error)
        } else {
            let { name, subject, body } = req.body;
            let description = "";
            let module_id = 0;
            let emailTemplate = await EmailService.createEmail({
                name, description, subject, body, module_id, created_by: req.loggedInUser.id
            });
            console.log("emailTemplate", emailTemplate)
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");

        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateEmail = async (req, res, next) => {
    try {
        const { error } = EmailValidationV1.emailUpdate.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id, name, body, subject } = req.body;
            let description = "";
            let email_template = await EmailService.findEmailTemplate(id);
            if (!email_template) {
                ResHelper.apiResponse(res, false, " Email Template Not Found", 400, {}, "");
            } else {
                let updated_by = req.loggedInUser.id;
                let updated_at = new Date();
                email_template = await EmailService.updateEmail(id, { name, body, subject, description, updated_by, updated_at });
                ResHelper.apiResponse(res, true, "Success", 201, {}, "");
            }
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }
};

const deleteEmail = async (req, res, next) => {
    try {
        const { error } = EmailValidationV1.deleteEmail.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
            console.log('ERRROR', error)
        } else {
            let { id } = req.body;
            await EmailService.deleteEmail(id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }
};

const getAll = async (req, res, next) => {
    try {
        const { error } = EmailValidationV1.getAllEmail.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { pageNumber, pageSize } = req.body;
            let email_templates = await EmailService.getAllEmail(pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 201, email_templates, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }
};

const getById = async (req, res, next) => {
    try {
        const { error } = EmailValidationV1.getById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            let email_template = await EmailService.getById(id);
            ResHelper.apiResponse(res, true, "Success", 201, email_template, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }
};

const getTemplateFields = async (req, res, next) => {
    try {
        const { error } = EmailValidationV1.getTemplateFields.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { module, module_id } = req.body;
            let where = [];
            if (module == true) {
                if (module_id) {
                    where.push(['etf.type', ' = ', 'module']);
                    where.push(['etf.parent_id', ' = ', module_id]);
                } else {
                    where.push(['etf.type', ' = ', 'module']);
                    where.push(['etf.parent_id', ' is null', null]);
                }
            } else {
                where.push(['etf.type', ' = ', 'general']);
            }

            let email_template_fields = await EmailService.getTemplateFields(where);
            ResHelper.apiResponse(res, true, "Success", 201, email_template_fields, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }
};

const getWhatsappTemplates = async (req, res) => {
    try {
        let options = {
            'method': 'POST',
            'url': `${process.env.WHATSAPP_TEMPLATE_URL_1}/templates/get-list`,
            'headers': {
                'Authorization': process.env.WHATSAPP_TEMPLATE_API_KEY_1,
                'Content-Type': 'application/json',
            }
        };
        console.log("options", options)
        const response = await makeRequest(options);
        const { status, res_json } = JSON.parse(response?.body);
        
        if (status) {
            return ResHelper.apiResponse(res, true, "Success", 201, { records: res_json?.data, totalRecords: res_json?.data?.length }, "");
        };
        ResHelper.apiResponse(res, false, "Error", 400, res_json?.data, "");
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }
};

const getWhatsappTemplateByName = async (req, res) => {
    try {
        const { error } = EmailValidationV1.getWhatsappTemplateByName.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let options = {
                'method': 'POST',
                'url': `${process.env.WHATSAPP_TEMPLATE_BY_NAME_URL}/templates/get-template-by-name`,
                'headers': {
                    'Authorization': process.env.WHATSAPP_TEMPLATE_BY_NAME_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "template_name": req?.body?.template_name
                })
            };
            const response = await makeRequest(options);
            const { status, res_json } = JSON.parse(response?.body);
            if (status) {
                return ResHelper.apiResponse(res, true, "Success", 201, res_json, "");
            };
            ResHelper.apiResponse(res, false, "Error", 400, res_json?.data, "");
        }
    }
    catch (error) {
        logger.error(error)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "")
    }
};

module.exports = {
    createEmail,
    updateEmail,
    deleteEmail,
    getAll,
    getById,
    getTemplateFields,
    getWhatsappTemplates,
    getWhatsappTemplateByName
};