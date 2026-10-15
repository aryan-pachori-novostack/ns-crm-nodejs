//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
const { logger } = require("../../../helpers/logger");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let DsaCommentServices = require(_pathconst.ServicesPath.DsaCommentServices);
let DsaCommentValidationV1 = require(_pathconst.ReqModelsPath.DsaCommentValidationV1);

const createComment = async (req, res, next) => {
    try {
        const { error } = DsaCommentValidationV1.createComment.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let dsaComment = await DsaCommentServices.createComment({ loggedInUserId: req.loggedInUser.id, ...req.body });
            ResHelper.apiResponse(res, true, "Success", 200, dsaComment, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getComment = async (req, res, next) => {
    try {
        const { error } = DsaCommentValidationV1.getComment.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let dsaComment = await DsaCommentServices.getComment(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, dsaComment, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

module.exports = {
    createComment,
    getComment
};