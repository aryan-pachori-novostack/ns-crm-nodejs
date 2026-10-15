const { sequelize, Sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

// const findAllJobs = async (offset, limit) => {
//     try {
//         let query = `SELECT * FROM jobs `;
//         if (limit) {
//             query += `LIMIT ${offset || 0}, ${limit} `;
//         }
//         const jobs = await sequelize.query(query, {
//             type: QueryTypes.SELECT
//         });
//         // console.log(jobs);
//         return jobs;
//     } catch (error) {
//         console.log(error);
//         logger.info(error);
//     }
// };

const getJobsByCityAndCategory = async (offset, limit, where) => {
    let query = ` SELECT jobs.*, pincodes_list.city AS city_name, pincodes_list.state AS state_name FROM jobs LEFT JOIN pincodes_list ON jobs.city_id = pincodes_list.id ${where} `;
    let queryCount = ` SELECT COUNT(*) AS count FROM jobs LEFT JOIN pincodes_list ON jobs.city_id = pincodes_list.id ${where} `;
    query += ` ORDER BY jobs.updated_at DESC LIMIT ${offset}, ${limit} `;

    // Execute query for jobs
    const jobs = await sequelize.query(query, { type: QueryTypes.SELECT });
    const totalCountResult = await sequelize.query(queryCount, { type: QueryTypes.SELECT });
    const totalCount = totalCountResult[0]?.count || 0;

    return { records: jobs, totalCount: totalCount };
};

const applyJobService = async (fname, lname, phoneNumber, jobId, email, comment, url) => {
    let bindParams = [fname, lname, email, phoneNumber, jobId, comment, url];
    let query = 'insert into job_applicants (user_fname,user_lname,email,phone,job_id,remarks,resume_url) values(?,?,?,?,?,?,?) ';
    const result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return result;
};

const getAllCategories = async () => {
    const query = `
            SELECT DISTINCT picklist_category_alias AS category
            FROM jobs`;
    const categories = await sequelize.query(query, { type: QueryTypes.SELECT });
    return categories.map(category => category.category);
};

const getJobDetails = async (jobId) => {
    let replacements = {};
    let query = `
        SELECT 
            jobs.name as name,
            jobs.picklist_category_alias as category,
            jobs.description as role,
            jobs.responsibilities as will_do,
            jobs.requirements as will_need,
            jobs.benefits as will_get,
            pincodes_list.city AS city_name,
            pincodes_list.state AS state_name
        FROM 
            jobs
        LEFT JOIN 
            pincodes_list
        ON 
            jobs.city_id = pincodes_list.id
        WHERE 
            jobs.id = :jobId`;
    replacements.jobId = jobId;
    const jobDtls = await sequelize.query(query, {
        replacements,
        type: QueryTypes.SELECT
    });
    return jobDtls;
};

const getState = async () => {
    let query = ` select distinct state from pincodes_list `;
    query += ` order by city asc `;
    const result = await sequelize.query(query, { type: QueryTypes.SELECT });
    return result;
};

const getCityFromState = async (offset, limit, state, where, distinct_city) => {
    let stateQuery = ` where state is not null `;
    let query = ` select * from pincodes_list ${stateQuery} ${where || ""} `;
    if (!where?.length || distinct_city) {
        query += ` group by city `;
    };
    query += ` order by city asc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";

    const result = await sequelize.query(query, { type: QueryTypes.SELECT });
    return result;
};


const getAllJobs = async (limit, offset, where) => {
    let query = ` select j.id, j.name, j.picklist_category_alias, j.city_id, j.description, j.responsibilities, j.requirements, j.benefits, j.created_at, p.city as city_name, p.pincode, p.office_name , p.state from jobs j left join pincodes_list p on p.id = j.city_id where j.created_at is not null ${where} `;
    query += ` order by created_at desc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";
    const records = await sequelize.query(query, { type: QueryTypes.SELECT });

    query = ` select count(j.id) as count from jobs j left join pincodes_list p on p.id = j.city_id where j.created_at is not null ${where} `;
    let totatCount = await sequelize.query(query, { type: QueryTypes.SELECT });

    return { records, totalRecords: totatCount[0]?.count || 0 };
};

const createOrEditJob = async (data) => {
    const { id, name, picklist_category_alias, city_id, description, responsibilities, requirements, benefits } = data;
    if (id) {
        let query = ` update jobs set name=?, picklist_category_alias=?, city_id=?, description=?, responsibilities=?, requirements=?, benefits=? where id = ? `;
        let bindParams = [name, picklist_category_alias, city_id, description, responsibilities, requirements, benefits, id]
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    } else {
        let query = ` insert into jobs (name, picklist_category_alias, city_id, description, responsibilities, requirements, benefits) values (?,?,?,?,?,?,?) `;
        let bindParams = [name, picklist_category_alias, city_id, description, responsibilities, requirements, benefits]
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
    return;
}; 

const deleteJobById = async (id) => {
    let query = ` delete from jobs where id = ? `;
    let bindParams = [id]
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    return;
};

const getAllJobApplicant = async (limit, offset, where) => {
    let query = ` select *, concat(user_fname, " ", user_lname) as full_name from job_applicants ${where} `;
    query += ` order by created_at desc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";
    const records = await sequelize.query(query, { type: QueryTypes.SELECT });

    query = ` select count(id) as count from job_applicants ${where} `;
    let totatCount = await sequelize.query(query, { type: QueryTypes.SELECT });

    return { records, totalRecords: totatCount[0]?.count || 0 };
};

module.exports = {
    getJobsByCityAndCategory,
    applyJobService,
    getState,
    getCityFromState,
    getJobDetails,
    getAllCategories,
    getAllJobs,
    createOrEditJob,
    deleteJobById,
    getAllJobApplicant
};
