const { getSmsTemplate, uploadToS3 } = require("../../../helpers/commonhelper");
const { logger } = require("../../../helpers/logger");
var NotificationTemplateValidationV1 = require(_pathconst.ReqModelsPath
  .NotificationTemplateValidationV1);
var ResHelper = require(_pathconst.FilesPath.ResHelper);
var NotificationService = require(_pathconst.ServicesPath.NotificationService);
const { v4: uuid } = require("uuid");

const createTemplate = async (req, res) => {
  try {
    const { error } = NotificationTemplateValidationV1.createTemplate.validate(
      req.body
    );
    if (error) {
      ResHelper.apiResponse(
        res,
        false,
        _.startCase(error.message),
        400,
        {},
        ""
      );
    } else {
      let { name, description, subject, body, type, link, attachments } =
        req.body;
      const finalAttachments = [];
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.type === "image") {
            const obj = {};
            obj.type = attachment.type;
            obj.url = await uploadToS3(
              "push_notification_meta",
              attachment.file.base64String,
              `heyperlink-content-icon${uuid()}`,
              "image/jpeg",
              "jpg"
            );
            finalAttachments.push(obj);
          }
        }
      }
       let notification_template = await NotificationService.createTemplate({
                name, description, subject, body,type, link, finalAttachments ,created_by: req.loggedInUser.id 
            }); 
        ResHelper.apiResponse(
        res,
        true,
        "Success",
        200,
        {
           notification_template 
        },
        ""
      );
    }
  } catch (error) {
    logger.error(error);
    console.log(error);
    ResHelper.apiResponse(
      res,
      false,
      "Error occured during execution",
      500,
      {},
      ""
    );
  }
};

const getTemplatesByType = async (req, res) => {
  try {
    const { error } =
      NotificationTemplateValidationV1.getTemplatesByType.validate(req.body);
    if (error) {
      ResHelper.apiResponse(
        res,
        false,
        _.startCase(error.message),
        400,
        {},
        ""
      );
    } else {
      const { type, offset, limit } = req.body;
      let notification_template = await NotificationService.getTemplatesByType(
        type,
        offset,
        limit
      );
      ResHelper.apiResponse(
        res,
        true,
        "Success",
        200,
        notification_template,
        ""
      );
    }
  } catch (error) {
    logger.error(error);
    console.log(error);
    ResHelper.apiResponse(
      res,
      false,
      "Error occured during execution",
      500,
      {},
      ""
    );
  }
};

const getTemplateById = async (req, res) => {
  try {
    const { error } = NotificationTemplateValidationV1.getTemplateById.validate(
      req.body
    );
    if (error) {
      ResHelper.apiResponse(
        res,
        false,
        _.startCase(error.message),
        400,
        {},
        ""
      );
    } else {
      const { id } = req.body;
      let notification_template = await NotificationService.getTemplateById(id);
      ResHelper.apiResponse(
        res,
        true,
        "Success",
        200,
        { notification_template },
        ""
      );
    }
  } catch (error) {
    logger.error(error);
    console.log(error);
    ResHelper.apiResponse(
      res,
      false,
      "Error occured during execution",
      500,
      {},
      ""
    );
  }
};
const deleteTemplate = async (req, res) => {
  try {
    const { error } = NotificationTemplateValidationV1.deleteTemplate.validate(
      req.body
    );
    if (error) {
      ResHelper.apiResponse(
        res,
        false,
        _.startCase(error.message),
        400,
        {},
        ""
      );
    } else {
      const { id } = req.body;
      let notification_template = await NotificationService.deleteTemplate(id);
      ResHelper.apiResponse(
        res,
        true,
        "Success",
        200,
        { notification_template },
        ""
      );
    }
  } catch (error) {
    logger.error(error);
    console.log(error);
    ResHelper.apiResponse(
      res,
      false,
      "Error occured during execution",
      500,
      {},
      ""
    );
  }
};
const updateTemplate = async (req, res) => {
  try {
    const { error } = NotificationTemplateValidationV1.updateTemplate.validate(
      req.body
    );
    if (error) {
      ResHelper.apiResponse(
        res,
        false,
        _.startCase(error.message),
        400,
        {},
        ""
      );
    } else {
      const { id, name, description, subject, body, link, attachments } =
        req.body;
      let notification_template = await NotificationService.updateTemplate(id, {
        name,
        description,
        subject,
        body,
        link,
        attachments,
        updated_by: req.loggedInUser.id,
      });
      ResHelper.apiResponse(
        res,
        true,
        "Success",
        200,
        { notification_template },
        ""
      );
    }
  } catch (error) {
    logger.error(error);
    console.log(error);
    ResHelper.apiResponse(
      res,
      false,
      "Error occured during execution",
      500,
      { },
      ""
    );
  }
};
const getSMSNotificationTemplate = async (req, res, next) => {
  try {
    const templates = await getSmsTemplate();
    ResHelper.apiResponse(res, true, "Success", 200, { templates }, "");
  } catch (err) {
    console.log(err);
    logger.error(err);
    ResHelper.apiResponse(
      res,
      false,
      "Error occured during execution",
      500,
      {},
      ""
    );
  }
};

module.exports = {
  createTemplate,
  getTemplatesByType,
  getTemplateById,
  deleteTemplate,
  updateTemplate,
  getSMSNotificationTemplate,
};
