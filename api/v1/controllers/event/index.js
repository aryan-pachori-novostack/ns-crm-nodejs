const { checkWhereInQueryString } = require("../../../helpers/commonhelper");
const { logger } = require("../../../helpers/logger");
var ResHelper = require(_pathconst.FilesPath.ResHelper);
var EventServices = require(_pathconst.ServicesPath.EventServices);
var EventValidationV1 = require(_pathconst.ReqModelsPath.EventValidationV1);

exports.getEvents = async (req, res, next) => {
    try {
        const { error } = EventValidationV1.getEvents.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { type, pageNumber, pageSize, event_id, title_filter, description_filter, benefits_filter, requirements_filter, startDateRange1, startDateRange2, endDateRange1, endDateRange2, ns_contest_id, time_frame, lastDateRange1, lastDateRange2 } = req?.body;
            let where = "";
            if (type) {
                where = checkWhereInQueryString(where);
                where += ` e.type = "${type}" `
            };
            if (event_id) {
                where = checkWhereInQueryString(where);
                where += ` e.id = ${event_id} `
            };
            if (title_filter) {
                where = checkWhereInQueryString(where);
                where += ` e.title like '%${title_filter}%' `;
            };
            if (description_filter) {
                where = checkWhereInQueryString(where);
                where += ` e.description like '%${description_filter}%' `;
            };
            if (benefits_filter) {
                where = checkWhereInQueryString(where);
                where += ` e.benefits like '%${benefits_filter}%' `
            };
            if (requirements_filter) {
                where = checkWhereInQueryString(where);
                where += ` e.requirements like '%${requirements_filter}%' `
            };
            if (startDateRange1) {
                where = checkWhereInQueryString(where);
                where += ` DATE(e.start_date) between DATE("${startDateRange1}") and DATE("${startDateRange2}") `;
            };
            if (endDateRange1) {
                where = checkWhereInQueryString(where);
                where += ` DATE(e.end_date) between DATE("${endDateRange1}") and DATE("${endDateRange2}") `;
            };
            if (ns_contest_id) {
                where = checkWhereInQueryString(where);
                where += ` e.ns_contest_id like '%${ns_contest_id}%' `;
            };
            if (lastDateRange1) {
                where = checkWhereInQueryString(where);
                where += ` DATE(e.last_date_to_upload_claim) between DATE("${lastDateRange1}") and DATE("${lastDateRange2}") `;
            };
            
            if (time_frame) {
                const formattedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
                if (time_frame === "ongoing") {
                    where = checkWhereInQueryString(where);
                    where += ` DATE(e.last_date_to_upload_claim) >= DATE("${formattedDate}") `;
                } else if (time_frame === "past") {
                    where = checkWhereInQueryString(where);
                    where += ` DATE(e.end_date) < DATE("${formattedDate}") `;
                } else if (time_frame === "upcoming") {
                    where = checkWhereInQueryString(where);
                    where += ` DATE(e.start_date) > DATE("${formattedDate}") `;
                };
            };

            let data = await EventServices.getEvents(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.createOrEditEvent = async (req, res, next) => {
    try {
        const { error } = EventValidationV1.createOrEditEvent.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let data = await EventServices.createOrEditEvent(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.createOrEditEventRewards = async (req, res, next) => {
    try {
        const { error } = EventValidationV1.createOrEditEventRewards.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let data = await EventServices.createOrEditEventRewards(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.createOrEditEventMedia = async (req, res, next) => {
    try {
        const { error } = EventValidationV1.createOrEditEventMedia.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let data = await EventServices.createOrEditEventMedia(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.createOrEditEventEligibility = async (req, res, next) => {
    try {
        const { error } = EventValidationV1.createOrEditEventEligibility.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let data = await EventServices.createOrEditEventEligibility(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.hardDeleteFromType = async (req, res, next) => {
    try {
        const { error } = EventValidationV1.hardDeleteFromType.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let data = await EventServices.hardDeleteFromType(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.getWinnersForContest = async (req, res, next) => {
    try {
        const { error } = EventValidationV1.getWinnersForContest.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let data = await EventServices.getWinnersForContest(req?.body?.event_id);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

exports.getContestForDsa = async (req, res, next) => {
    try {
        const { error } = EventValidationV1.getContestForDsa.validate(req.query);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        let { time_frame, page_number, page_size, dsa_id, start_date, end_date, type } = req.query;
        let { event_id } = req.params;
        let where = "";
        const formattedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (time_frame === "past") {
            where = `WHERE DATE(e.end_date) < DATE("${formattedDate}")`;
        } else if (time_frame === "ongoing") {
            where = `WHERE DATE(e.start_date) <= DATE("${formattedDate}") AND DATE(e.end_date) >= DATE("${formattedDate}")`;
        } else if (time_frame === "upcoming") {
            where = `WHERE DATE(e.start_date) > DATE("${formattedDate}")`;
        };
        if (type) {
            where += ` and e.type = "${type}" `;
        };
        if (event_id) {
            where += ` and e.id = ${event_id} `;
        };
        if (start_date) {
            where += ` and DATE(e.start_date) >= DATE("${start_date}") `;
        };
        if (end_date) {
            where += ` and DATE(e.end_date) <= DATE("${end_date}") `;
        };

        const offset = page_size ? page_number * page_size : 0;
        const data = await EventServices.getContestForDsa(dsa_id, offset, page_size || 10, where);
        ResHelper.apiResponse(res, true, "Success", 200, data, "");
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};