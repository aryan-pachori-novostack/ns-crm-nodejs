let Joi = require("joi");

const getJobSearch = Joi.object({
    city_id: Joi.number().allow(null, ""),
    city_name: Joi.string().allow(null, ""),
    category_id: Joi.string().allow(null, ""),
    pageNumber: Joi.number().allow(null, ""),
    pageSize: Joi.number().allow(null, ""),
    start_date: Joi.string().allow(null, ""),
    end_date: Joi.string().allow(null, ""),
});

const isPDF = (value, helpers) => {
    // Decode Base64 string
    const decodedData = Buffer.from(value, 'base64');
    // Check if the first 4 bytes match PDF signature "%PDF"
    if (decodedData.toString('utf8', 0, 4) === '%PDF') {
        return value;
    }
    return helpers.error('any.invalid');
};

const applyJob = Joi.object({
    fname: Joi.string().required(),
    lname: Joi.string().required(),
    email: Joi.string().email().required(),
    phoneNumber: Joi.string().pattern(new RegExp('^[0-9]{10}$')).required(),
    jobId: Joi.number().required(),
    comment: Joi.string().allow(null, ""),
    resume: Joi.string().required().custom(isPDF),
});

const getJobDetails = Joi.object({
    job_id: Joi.number().allow(null, ""),
});

const getCityFromState = Joi.object({
    page_number: Joi.number().allow(null, ""),
    page_size: Joi.number().allow(null, ""),
    state: Joi.string().allow(null, ""),
    city: Joi.string().allow(null, ""),
    pincode: Joi.string().allow(null, ""),
    office_name: Joi.string().allow(null, ""),
    office_type: Joi.string().allow(null, ""),
    country: Joi.string().allow(null, ""),
    region: Joi.string().allow(null, ""),
    circle: Joi.string().allow(null, ""),
    taluk: Joi.string().allow(null, ""),
    district: Joi.string().allow(null, ""),
    related_suboffice: Joi.string().allow(null, ""),
    related_head_office: Joi.string().allow(null, ""),
    search: Joi.string().allow(null, ""),
    distinct_city: Joi.boolean().allow(null, ""),
});

const getAllJobs = Joi.object({
    pageSize: Joi.number().allow(null, ""),
    pageNumber: Joi.number().allow(null, ""),
    city_filter: Joi.string().allow(null, ""),
    state_filter: Joi.string().allow(null, ""),
    category_filter: Joi.string().allow(null, ""),
    name_filter: Joi.string().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
});

const getAllJobApplicant = Joi.object({
    pageSize: Joi.number().allow(null, ""),
    pageNumber: Joi.number().allow(null, ""),
    application_id: Joi.required().allow(null, ""),
    startDateFilter: Joi.string().allow(null, ""),
    endDateFilter: Joi.string().allow(null, ""),
    full_name_filter: Joi.string().allow(null, ""),
    email_filter: Joi.string().allow(null, ""),
    phone_filter: Joi.string().allow(null, ""),
    remarks_filter: Joi.string().allow(null, ""),
    resume_url_filter: Joi.string().allow(null, ""),
});

const createOrEditJob = Joi.object({
    id: Joi.number().allow(null, ""),
    name: Joi.string().required(),
    picklist_category_alias: Joi.string().allow(null, ""),
    city_id: Joi.number().required(),
    description: Joi.string().required().allow(null, ''),
    responsibilities: Joi.string().required().allow(null, ''),
    requirements: Joi.string().required().allow(null, ''),
    benefits: Joi.string().required().allow(null, ''),
});

const deleteJobById = Joi.object({
    id: Joi.number().required(),
});

module.exports = {
    getJobSearch,
    applyJob,
    getCityFromState,
    getJobDetails,
    getAllJobs,
    createOrEditJob,
    deleteJobById,
    getAllJobApplicant
};