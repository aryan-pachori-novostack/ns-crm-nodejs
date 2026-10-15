const User = require("../../../../models/User");
const { logger } = require("../../../helpers/logger");
const { lead } = require("../lead");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let LeadCommentValidationV1 = require(_pathconst.ReqModelsPath.LeadCommentValidationV1);
let LeadCommentService = require(_pathconst.ServicesPath.LeadCommentService);
const LeadLogService =  require(_pathconst.ServicesPath.LeadLogService);
let LeadService = require(_pathconst.ServicesPath.LeadService);

const create = async (req, res, next) => {
    try {
        const {error} =  await LeadCommentValidationV1.create.validate(req.body);
        if(error){
            ResHelper.apiResponse(res, false,_.startCase(error.message), 400, {}, "");
        }else{
             let { lead_id,comment,attachment_url,parent_id,status_id} = req.body;
             if(!parent_id){
                parent_id = '00000000-0000-0000-0000-000000000000';
             }
             let lead_comment = await LeadCommentService.create({ lead_id,status_id,comment,attachment_url,parent_id,created_by:req.loggedInUser.id} );
             let status = await LeadService.getCallStatusById(status_id);
             await LeadLogService.create({lead_id :lead_id, from:comment,to: null, updated_by:req.loggedInUser.id, type:'', operation_type:'lead-comment-create'});
             ResHelper.apiResponse(res,true," Success ",201,{},"");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const update = async (req, res, next) => {
    try {
        const {error} =  await LeadCommentValidationV1.update.validate(req.body);
        if(error){
            ResHelper.apiResponse(res, false,_.startCase(error.message), 400, {}, "");
        }else{
             let { id,lead_id,comment,attachment_url,status_id,parent_id} = req.body;
             if(!parent_id){
                parent_id = '00000000-0000-0000-0000-000000000000';
             }
             let lead_comment = await LeadCommentService.update(id,{ lead_id,comment, status_id: status_id || null, attachment_url,parent_id,updated_by:req.loggedInUser.id,updatedAt:new Date()} );
             ResHelper.apiResponse(res,true," Success ",201,{},"");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const deleteComment = async (req, res, next) => {
    try {
        const {error} =  await LeadCommentValidationV1.deleteComment.validate(req.body);
        if(error){
            ResHelper.apiResponse(res, false,_.startCase(error.message), 400, {}, "");
        }else{
             let { id } = req.body;
             let lead_comment = await LeadCommentService.update(id );
             ResHelper.apiResponse(res,true," Success ",201,{},"");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllComments = async (req, res, next) => {
    try {
        const {error} =  await LeadCommentValidationV1.getAllComments.validate(req.body);
        if(error){
            ResHelper.apiResponse(res, false,_.startCase(error.message), 400, {}, "");
        }else{
             let { lead_id,parent_id } = req.body;
             let lead_comments = await LeadCommentService.getAllComments(lead_id,parent_id);
             ResHelper.apiResponse(res,true," Success ",201,lead_comments,"");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}





module.exports = {
   create,
   update,
   deleteComment,
   getAllComments
};


