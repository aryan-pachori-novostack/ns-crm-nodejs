var Joi = require("joi");

exports.getEvents = Joi.object({
    pageNumber: Joi.number(),
    pageSize: Joi.number(),
    event_id: Joi.number().allow(null, ""),
    ns_contest_id: Joi.number().allow(null, ""),
    title_filter: Joi.string().allow(null, ""),
    description_filter: Joi.string().allow(null, ""),
    benefits_filter: Joi.string().allow(null, ""),
    requirements_filter: Joi.string().allow(null, ""),
    startDateRange1: Joi.string().allow(null, ""),
    startDateRange2: Joi.string().allow(null, ""),
    endDateRange1: Joi.string().allow(null, ""),
    endDateRange2: Joi.string().allow(null, ""),
    type: Joi.string().allow(null, "").valid("contest", "event","lead_form_contest"),
    time_frame: Joi.string().allow(null, "").valid("past", "ongoing", "upcoming"),
    lastDateRange1: Joi.string().allow(null, ""),
    lastDateRange2: Joi.string().allow(null, ""),
});

exports.createOrEditEvent = Joi.object({
    id: Joi.number().allow(null, ""),
    title: Joi.string().required(),
    description: Joi.string().allow(null, ""),
    benefits: Joi.string().allow(null, ""),
    requirements: Joi.string().allow(null, ""),
    start_date: Joi.string().required(),
    end_date: Joi.string().required(),
    sort_order: Joi.number().allow(null, ""),
    type: Joi.string().allow(null, "").valid("contest", "event"),
});

exports.createOrEditEventRewards = Joi.object({
    id: Joi.number().allow(null, ""),
    reward_type_alias: Joi.string().required(),
    reward: Joi.string().required(),
    iteration: Joi.number().required(),
    reward_metric: Joi.string().required(),
    event_id: Joi.number().required(),
    count_disbursement_slab_max: Joi.number().required(),
    count_disbursement_slab_min: Joi.number().required(),
});

exports.createOrEditEventMedia = Joi.object({
    id: Joi.number().allow(null, ""),
    media_url: Joi.string().required(),
    media_type: Joi.string().required(),
    event_id: Joi.number().required(),
    sort_order: Joi.number().allow(null, ""),
});

exports.createOrEditEventEligibility = Joi.object({
    id: Joi.number().allow(null, ""),
    product: Joi.array().required(),
    loan_type: Joi.string().required(),
    event_id: Joi.number().required(),
});

exports.hardDeleteFromType = Joi.object({
    id: Joi.number().required(),
    type: Joi.string().required(),
});

exports.getWinnersForContest = Joi.object({
    event_id: Joi.number().required(),
});

exports.getContestForDsa = Joi.object({
    dsa_id: Joi.string().allow(null, ""),
    page_number: Joi.number().allow(null, ""),
    page_size: Joi.number().allow(null, ""),
    time_frame: Joi.string().required("past", "ongoing", "upcoming"),
    event_id: Joi.number().allow(null, ""),
    start_date: Joi.string().allow(null, ""),
    end_date: Joi.string().allow(null, ""),
    type: Joi.string().allow(null, "").valid("contest", "event"),
});


