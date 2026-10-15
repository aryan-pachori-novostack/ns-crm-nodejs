//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
const { v4: uuid } = require('uuid');
let ResHelper = require(_pathconst.FilesPath.ResHelper);
const { uploadToS3 } = require("../../../helpers/commonhelper");
const { lead } = require("../lead");
let LeadDocumentService = require(_pathconst.ServicesPath.LeadDocumentService);
let LeadDocumentValidationV1 = require(_pathconst.ReqModelsPath.LeadDocumentValidationV1);


const create = async (req, res, next) => {
    try {
        const { error } = LeadDocumentValidationV1.create.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { title, file, type, assigned_to, lead_id } = req.body;
            let id;
            let lead_document = await  LeadDocumentService.getLeadDocument(lead_id,type);
            let file_path;
            if (lead_document) {
                file_path = await uploadToS3(lead_document.lead_id, file, type);
                lead_document = await LeadDocumentService.update({ title, file_path, type, assigned_to, updated_by: req.loggedInUser.id, lead_id, updated_at: new Date() });
                ResHelper.apiResponse(res, true, "Success ", 201, lead_document, "");
            } else {
                id = uuid();
                file_path = await uploadToS3(id, file, type);
                lead_document = await LeadDocumentService.create({ id, title, file_path, type, assigned_to, created_by: req.loggedInUser.id, lead_id });
                ResHelper.apiResponse(res, true, "Success ", 201, lead_document, "");
            }

        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getLeadDocumentType = async (req, res, next) => {
    try {
        let types = await LeadDocumentService.getLeadDocumentType();
        ResHelper.apiResponse(res, true, "Success", 200, types, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getLeadDocuments = async (req, res, next) => {
    try {
        const { error } = LeadDocumentValidationV1.getLeadDocuments.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { id } = req.body
            let getLeadUser = await LeadDocumentService.getLeadDocuments(id);
            ResHelper.apiResponse(res, true, "Lead Documents", 200, getLeadUser, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}






module.exports = {
    create,
    getLeadDocumentType,
    getLeadDocuments
};


