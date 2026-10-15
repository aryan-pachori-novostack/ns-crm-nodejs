let ResHelper = require(_pathconst.FilesPath.ResHelper);
let JobService = require(_pathconst.ServicesPath.JobService);
let CareerValidationV1 = require(_pathconst.ReqModelsPath.CareerValidationV1);
let randomstring = require("randomstring");
const { logger } = require("../../../helpers/logger");
const { uploadToS3, checkWhereInQueryString } = require("../../../helpers/commonhelper");
const { nextDay } = require("date-fns");

// const getAllJobs = async (req, res, next)=>{
//     try{
//         let {pageNumber, pageSize} = req.query;
//         if(!pageNumber){
//             pageNumber =  0;
//         }
//         if(!pageSize){
//             pageSize = 20;
//         }
//         const jobs = await JobService.findAllJobs(pageNumber * pageSize, pageSize);
//         ResHelper.apiResponse(res, true, "Success", 200, jobs, "");
//     }catch (error){
//         console.log(error);
//         logger.error(error);
//         ResHelper.apiResponse(error, false, "Error occurred during execution", 500, {}, "");
//     }
// }

const getJobsSearch = async (req, res, next) => {
    try {
        const error = CareerValidationV1.getJobSearch.validate(req.query);
        if (error.error) {
            ResHelper.apiResponse(res, false, error.error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, city_name, city_id, category_id, start_date, end_date } = req.query;
            if (!pageNumber) {
                pageNumber = 0;
            };
            if (!pageSize) {
                pageSize = 20;
            };

            let where = "";
            if (city_name) {
                where = checkWhereInQueryString(where);
                where += ` pincodes_list.city like '%${city_name}%' `;
            };
            if (city_id) {
                where = checkWhereInQueryString(where);
                where += ` jobs.city_id like '%${city_id}%' `;
            };
            if (category_id) {
                where = checkWhereInQueryString(where);
                where += ` jobs.picklist_category_alias like '%${category_id}%' `;
            };
            if (start_date) {
                where = checkWhereInQueryString(where);
                where += ` DATE(jobs.created_at) between DATE('${start_date}') and DATE('${end_date}') `;
            };

            const jobs = await JobService.getJobsByCityAndCategory(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, jobs, "");
        }
    } catch (error) {
        console.log(error)
        logger.error(error);
        ResHelper.apiResponse(res, false, error, 500, {}, "");
    }
};

const getAllCategory = async (req, res, next) => {
    try {
        const AllCategories = await JobService.getAllCategories();
        ResHelper.apiResponse(res, true, "Success", 200, AllCategories);
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, error.message, 500, {}, "");
    }
}
const getJobDetails = async (req, res, next) => {
    try {
        const error = CareerValidationV1.getJobDetails.validate(req.query);
        if (error.error) {
            ResHelper.apiResponse(res, false, error.error.message, 400, {}, "");
        } else {
            let { job_id } = req.query;
            const jobDetails = await JobService.getJobDetails(job_id);
            ResHelper.apiResponse(res, true, "Success", 200, jobDetails);
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, error.message, 500, {}, "");
    }
}
const applyJob = async (req, res, next) => {
    try {
        const { error } = CareerValidationV1.applyJob.validate(req.body);
        if (error) {
            console.log(error);
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { fname, lname, phoneNumber, jobId, email, comment, resume } = req.body;
            let uniqueString = randomstring.generate();
            let url = await uploadToS3("resume", resume, fname + uniqueString, 'application/octet-stream', "pdf");
            // console.log(url);
            await JobService.applyJobService(fname, lname, phoneNumber, jobId, email, comment, url);
            ResHelper.apiResponse(res, true, "Successfully applied for the job", 201, {}, "");
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "error during execution", 500, {}, "");
    }
};

const getCityFromState = async (req, res, next) => {
    try {
        const { error } = CareerValidationV1.getCityFromState.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { page_number, page_size, search, state, city, pincode, office_name, office_type, country, region, circle, taluk, district, related_suboffice, related_head_office, distinct_city } = req.body;
            const keys = Object.keys(req?.body);
            let offset = page_number * page_size || 0;
            let data = [];
            let message = "Success"
            if (!keys?.length) {
                data = await JobService.getState();
            } else {
                let where = "";
                if (search) {
                    // Prioritize city and state matches over office_name to avoid false matches
                    // (e.g., "Delhi Gate S.O (Ahmedabad)" shouldn't match when searching for "Delhi")
                    // Only include office_name matches if city or state also matches the search term
                    where += ` and (
                        city COLLATE utf8mb4_unicode_ci like '%${search}%' 
                        or state COLLATE utf8mb4_unicode_ci like '%${search}%' 
                        or pincode COLLATE utf8mb4_unicode_ci like '%${search}%' 
                        or (office_name COLLATE utf8mb4_unicode_ci like '%${search}%' 
                            AND (city COLLATE utf8mb4_unicode_ci like '%${search}%' 
                                 OR state COLLATE utf8mb4_unicode_ci like '%${search}%'))
                    ) `;
                };
                if (city) {
                    where += ` and city COLLATE utf8mb4_unicode_ci like '%${city}%' `;
                };
                if (state) {
                    where += ` and state COLLATE utf8mb4_unicode_ci like '%${state}%' `;
                };
                if (pincode) {
                    where += ` and pincode COLLATE utf8mb4_unicode_ci like '%${pincode}%' `;
                };
                if (office_name) {
                    where += ` and office_name COLLATE utf8mb4_unicode_ci like '%${office_name}%' `;
                };
                if (office_type) {
                    where += ` and office_type COLLATE utf8mb4_unicode_ci like '%${office_type}%' `;
                };
                if (country) {
                    where += ` and country COLLATE utf8mb4_unicode_ci like '%${country}%' `;
                };
                if (region) {
                    where += ` and region COLLATE utf8mb4_unicode_ci like '%${region}%' `;
                };
                if (circle) {
                    where += ` and circle COLLATE utf8mb4_unicode_ci like '%${circle}%' `;
                };
                if (taluk) {
                    where += ` and taluk COLLATE utf8mb4_unicode_ci like '%${taluk}%' `;
                };
                if (district) {
                    where += ` and district COLLATE utf8mb4_unicode_ci like '%${district}%' `;
                };
                if (related_suboffice) {
                    where += ` and related_suboffice COLLATE utf8mb4_unicode_ci like '%${related_suboffice}%' `;
                };
                if (related_head_office) {
                    where += ` and related_head_office COLLATE utf8mb4_unicode_ci like '%${related_head_office}%' `;
                };
                data = await JobService.getCityFromState(offset, page_size || 10, state, where, distinct_city);
                message = data?.length ? "Success" : "No pincode found please contact developer@ruloans.com";
            }
            if (data?.length) {
                return ResHelper.apiResponse(res, true, message, 201, data, "");
            };

            return ResHelper.apiResponse(res, false, message, 400, data, "");
        }
    } catch (error) {
        console.log(error);
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

const getAllJobs = async (req, res, next) => {
    try {
        const { error } = CareerValidationV1.getAllJobs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize,state_filter, city_filter, category_filter, name_filter, startDateFilter, endDateFilter } = req.body;
            let offset = pageNumber * pageSize || 0;

            let where = "";
            if (name_filter) {
                where += ` and j.name like '%${name_filter}%' `;
            };
            if (category_filter) {
                where += ` and j.picklist_category_alias like '%${category_filter}%' `;
            };
            if (city_filter) {
                where += ` and p.city like '%${city_filter}%' `;
            };
            if (startDateFilter) {
                where += ` and DATE(j.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            };
            if (state_filter) {
                where += ` and p.state like '%${state_filter}%' `;
            };

            let data = await JobService.getAllJobs(offset, pageSize || 10, where);
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllJobApplicant = async (req, res, next) => {
    try {
        const { error } = CareerValidationV1.getAllJobApplicant.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, startDateFilter, endDateFilter, full_name_filter, email_filter, phone_filter, remarks_filter, resume_url_filter, application_id } = req.body;
            let offset = pageNumber * pageSize || 0;

            let where = "";
            if (application_id) {
                where += ` where job_id = ${application_id} `;
            };
            if (full_name_filter) {
                where += ` and concat(user_fname, " ", user_lname) like '%${full_name_filter}%' `;
            };
            if (email_filter) {
                where += ` and email like '%${email_filter}%' `;
            };
            if (phone_filter) {
                where += ` and phone like '%${phone_filter}%' `;
            };
            if (remarks_filter) {
                where += ` and remarks like '%${remarks_filter}%' `;
            };
            if (resume_url_filter) {
                where += ` and resume_url like '%${resume_url_filter}%' `;
            };
            if (startDateFilter) {
                where += ` and DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `;
            };

            let data = await JobService.getAllJobApplicant(offset, pageSize || 10, where);
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createOrEditJob = async (req, res, next) => {
    try {
        const { error } = CareerValidationV1.createOrEditJob.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let data = await JobService.createOrEditJob(req?.body);
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteJobById = async (req, res, next) => {
    try {
        const { error } = CareerValidationV1.deleteJobById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let data = await JobService.deleteJobById(req?.body?.id);
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getStates = async (req, res, next) => {
    try {
       const data = await JobService.getState();
       ResHelper.apiResponse(res, true, "Success", 201, data, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

module.exports = {
    getJobsSearch,
    applyJob,
    getCityFromState,
    getJobDetails,
    getAllCategory,
    getAllJobs,
    createOrEditJob,
    deleteJobById,
    getAllJobApplicant,
    getStates
};