
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let StatusValidationV1 = require(_pathconst.ReqModelsPath.StatusValidationV1);
let StatusService = require(_pathconst.ServicesPath.StatusService);
const xlsx = require('xlsx')


const getStatus = async (req, res, next) => {
    try {
        let status = await StatusService.getStatus();
        ResHelper.apiResponse(res, true, "Success", 200, status, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const getStatusById = async (req, res, next) => {
    try {
        const { error } = await StatusValidationV1.getStatusById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { id } = req.body;
            let status = await StatusService.getStatusById(id);
            ResHelper.apiResponse(res, true, "Success", 200, status, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const addGlobalStatus = async (req, res, next) => {
    try {
        let { file } = req?.body;
        const buf = Buffer.from(file, 'base64')
        const sheet = await xlsx.read(buf, { type: 'buffer' })
        await xlsx.writeFile(sheet, "uploadPayout.xlsx");
        const fileData = xlsx.readFile('uploadPayout.xlsx');
        let sheetNames = fileData.SheetNames;
        const json = xlsx.utils.sheet_to_json(fileData.Sheets[sheetNames[0]]);
        if (json.length) {
            await StatusService.addGlobalStatus(json);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

module.exports = {
    getStatus,
    getStatusById,
    addGlobalStatus
};


