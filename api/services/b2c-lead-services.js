const { QueryTypes } = require('sequelize');
let uuid = require('node-uuid');
const { uploadToS3 } = require("../helpers/commonhelper");
const { sequelize, _db2 } = require('../../models');

const getB2cLeads = async (offset, limit, where) => {
    let query = ` select ul.id, u.user_id, concat(u.f_name, " ", u.l_name) as full_name, u.mobile_number, u.email, ul.loan_type, ul.utm_source, ul.utm_medium, ul.utm_campaign, ul.created_at, ul.updated_at from user_leads ul left join users u on ul.user_id = u.user_id ${where || ""} group by u.email `;
    let queryCount = `select count(*) as count from user_leads ul left join users u on ul.user_id = u.user_id ${where || ""} group by u.email `;

    query += ` order by id desc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";

    let data = await sequelize.query(query, { type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(queryCount, { type: QueryTypes.SELECT });

    if (data?.length) {
        let userIdArr = [];
        for (i = 0; i < data?.length; i++) {
            userIdArr.push(data[i]?.user_id)
        };
        let utm = ` select u.user_id, ul.utm_source, ul.utm_medium, ul.utm_campaign, ul.created_at, ul.updated_at from user_leads ul left join users u on ul.user_id = u.user_id  where u.user_id in (?) order by ul.created_at desc `;
        utm = await sequelize.query(utm, { replacements: [userIdArr], type: QueryTypes.SELECT });

        for (i = 0; i < data?.length; i++) {
            let latestData = utm.filter((obj) => obj.user_id == data[i].user_id);
            let keys = Object.keys(latestData[0]);
            for (j = 0; j < keys?.length; j++) {
                data[i][keys[j]] = latestData[0][keys[j]]
            }
        };
    };

    return { records: data, totalCount: totalCount.length };
};

const getB2cLeadsById = async (offset, limit, where) => {
    let query = ` select ul.id, u.user_id, u.mobile_number, u.email, u.date_of_birth,u.address, u.pincode, u.city, u.state, u.pan_code, concat(u.f_name, " ", u.l_name) as full_name, u.occupation, ul.loan_type, ul.utm_source, ul.utm_medium, ul.utm_campaign, ul.created_at, ul.updated_at from user_leads ul left join users u on ul.user_id = u.user_id ${where || ""} `;
    let queryCount = ` select count(*) as count from user_leads ul left join users u on ul.user_id = u.user_id ${where || ""} `;

    query += ` order by ul.created_at desc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";

    let data = await sequelize.query(query, { type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(queryCount, { type: QueryTypes.SELECT });

    return { records: data, totalCount: totalCount[0]?.count };
};

const getAllHyperlinkContent = async (offset, limit, where) => {
    let query = `select *, case when status = 0 then "Uat" else "Prod" end as status from hyperlink_content ${where}`;
    let queryCount = `select count(*) as count from hyperlink_content ${where}`;

    query += ` order by id desc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";

    let data = await sequelize.query(query, { type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(queryCount, { type: QueryTypes.SELECT });

    return { records: data, totalCount: totalCount[0]?.count };
};

const checkIfHyperlinkExisit = async (loan_type, location, content_type, id) => {
    let query = `select * from hyperlink_content where loan_type=? and location=? and content_type=? ${id ? ` and id != "${id}" ` : ""}`;
    let bindParams = [loan_type, location, content_type];
    let data = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data[0]?.id ? true : false;
};

const insertHyperlinkContent = async (data) => {
    let { status, id, title, meta_title, content_type, description, note, location, loan_type, icon, alias } = data;
    status = 1;
    let query;
    let bindParams;
    if (id) {
        query = `update hyperlink_content set status=?, title=?, meta_title=?, content_type=?, description=?, note=?, location=?, loan_type=?, icon=?, alias=? where id=?`;
        bindParams = [status || 0, title, meta_title, content_type, description, note, location, loan_type, icon, alias, id];
    } else {
        query = `insert into hyperlink_content (status, title, meta_title, content_type, description, note, location, loan_type, icon, alias) values (?,?,?,?,?,?,?,?,?,?)`;
        bindParams = [status || 0, title, meta_title, content_type, description, note, location, loan_type, icon, alias];
    }
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return;
};

const deleteHyperlinkContent = async (id, delete_all = true) => {
    let bindParams = [id];

    if (delete_all) {
        let query = `delete from hyperlink_content where id=?`;
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    };

    query = `delete from hyperlink_content_extended where content_id=?`;
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });

    return;
};

const insertHyperlinkContentExtended = async (reqData) => {
    const { id, content_id, data } = reqData;
    let query;
    let bindParams = [];
    if (id) {
        query = `update hyperlink_content_extended set content_id=?, title=?, description=?, interest_rate=?, processing_fees=?, icon=?, sort_order=? where id=?`;
        let imageId = uuid();
        if (!data[0]?.icon?.includes("https://") && data[0]?.icon) {
            data[0].icon = await uploadToS3('crm_components_meta', data[0]?.icon, `heyperlink-content-icon${imageId}`, 'image/jpeg', "jpg");
        };
        bindParams = [content_id, data[0]?.title, data[0]?.description, data[0]?.interest_rate, data[0]?.processing_fees, data[0]?.icon, data[0]?.sort_order, id];
    } else {
        for (i = 0; i < data?.length; i++) {
            if (i == 0) {
                query = `insert into hyperlink_content_extended (content_id, title, description, interest_rate, processing_fees, icon, sort_order) values (?,?,?,?,?,?,?)`;
            } else {
                query += `, (?,?,?,?,?,?,?) `
            }
            let imageId = uuid();
            if (!data[i]?.icon?.includes("https://") && data[0]?.icon) {
                data[i].icon = await uploadToS3('crm_components_meta', data[i]?.icon, `heyperlink-content-icon${imageId}`, 'image/jpeg', "jpg");
            };
            bindParams = bindParams.concat([content_id, data[i]?.title, data[i]?.description, data[i]?.interest_rate, data[i]?.processing_fees, data[i]?.icon, data[i]?.sort_order]);
        }
    }
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return;
};

const getHyperlinkContentExtended = async (offset, limit, content_id) => {
    let query = `select * from hyperlink_content_extended where content_id=? `;
    let queryCount = `select count(*) as count from hyperlink_content_extended where content_id=?  `;
    let bindParams = [content_id];

    query += ` order by created_at desc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";

    let data = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });

    return { records: data, totalCount: totalCount[0]?.count };
};

const deleteHyperlinkContentExtended = async (id) => {
    let query = `delete from hyperlink_content_extended where id=?`;
    let bindParams = [id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return;
};

const getHyperlinkLocationExternal = async (loan_type) => {
    let query = ` select distinct location from hyperlink_content where loan_type = ? `;
    let data = await sequelize.query(query, { replacements: [loan_type], type: QueryTypes.SELECT });
    return data;
};

const getHyperlinkDataExternal = async (loan_type, location) => {
    let env_filter = process.env.ENVIRONMENT == "prod" ? ` and status = "1" ` : "";
    let query = ` select h.title, h.meta_title, h.content_type, h.description, h.loan_type, h.location, h.note, h.icon,
    CASE WHEN COUNT(he.id) > 0  THEN
    JSON_ARRAYAGG(JSON_OBJECT('title', he.title, 'description', he.description, 'icon', he.icon, 'interest_rate', he.interest_rate, 'processing_fee', he.processing_fees, 'sort_order', he.sort_order))
    ELSE NULL END  as extended_data from hyperlink_content h left join hyperlink_content_extended he on he.content_id = h.id where h.loan_type = ? and location = ? ${env_filter} group by h.id `;
    let data = await sequelize.query(query, { replacements: [loan_type, location], type: QueryTypes.SELECT });
    return data;
};

const checkIfContentExist = async (data) => {
    const { loan_type, location, content_type } = data;
    let query = ` select * from hyperlink_content where loan_type = ? and location = ? and content_type = ? `;
    let content = await sequelize.query(query, { replacements: [loan_type, location, content_type], type: QueryTypes.SELECT });
    return content[0] || null;
};

const getHyperlinkLocation = async () => {
    let query = ` select distinct location from hyperlink_content `;
    let data = await sequelize.query(query, { type: QueryTypes.SELECT });
    return data;
};

const getB2cUserQueries = async (offset, limit, where, sortBy, sortDirection) => {
    let query = ` select ru.name as reply_by_name, uq.replied_at, uq.reply, uq.status, u.customer_id, u.permanent_account_number, u.email_address as email, u.customer_mobile_number as mobile_number,  u.full_name as user_name, uq.id, uq.customer_id, uq.reason_id, uq.title, uq.description, uq.created_at as createdAt, uq.updated_at as updatedAt from ru_customer_queries uq left join ru_customers u on uq.customer_id = u.customer_id left join CRMTest.users ru on bin_to_uuid(ru.id) = uq.replied_by ${where} `;
    let queryCount = ` select count(*) as totalCount from ru_customer_queries uq left join ru_customers u on uq.customer_id = u.customer_id left join CRMTest.users ru on bin_to_uuid(ru.id) = uq.replied_by ${where} `;

    if (sortBy) {
        // Sanitize sortBy to prevent SQL injection 
        const allowedSortColumns = ['mobile_number', 'email', 'user_name', 'title', 'description', 'status', 'reply', 'reply_by_name', 'createdAt'];
        const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'createdAt'; // Default to createdAt if not allowed
        const safeSortDirection = sortDirection?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'; // Default to ASC

        query += ` ORDER BY ${safeSortBy} ${safeSortDirection} `;
    } else {
        query += ` ORDER BY uq.created_at DESC `; // Default sorting if no sortBy
    }
    query += limit ? ` LIMIT ${offset}, ${limit} ` : "";
    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });

    return { records: data, totalCount: totalCount[0]?.totalCount };
};


const migrateQueries = async () => {
    try {
        let query = `
        SELECT 
            u.*, 
            ul.utm_source, 
            ul.utm_medium, 
            ul.utm_campaign
        FROM users u
        LEFT JOIN (
            SELECT 
                ul1.user_id, 
                ul1.utm_source, 
                ul1.utm_medium, 
                ul1.utm_campaign 
            FROM user_leads ul1
            INNER JOIN (
                SELECT 
                    user_id, 
                    MAX(updated_at) AS latest_update 
                FROM user_leads 
                GROUP BY user_id
            ) ul2 
            ON ul1.user_id = ul2.user_id 
            AND ul1.updated_at = ul2.latest_update
        ) ul 
        ON u.user_id = ul.user_id
    `;
        let data = await _db4.query(query, { type: QueryTypes.SELECT });
        let b2cUserArr = []

        for (i = 0; i < data?.length; i++) {
            b2cUserArr.push(data[i]?.mobile_number)
        };

        query = `select c.customer_id, c.customer_mobile_number from ru_customers c where c.customer_mobile_number in (${b2cUserArr})`;
        let data2 = await _db2.query(query, { type: QueryTypes.SELECT });

        for (let i = 0; i < data?.length; i++) {
            let user = data2?.filter((obj) => obj?.customer_mobile_number == data[i]?.mobile_number);
            if (user[0]) {
                data[i]["customer_id"] = user[0]?.customer_id
                data[i]["customer_mobile_number"] = user[0]?.customer_mobile_number
            }
        };

        const existing = data.filter(item => item.customer_id && item.customer_id.trim() !== '');
        const nonExisting = data.filter(item => !item.customer_id);

        let bindParams = [];
        query = "";


        for (let i = 0; i < nonExisting?.length; i++) {
            console.log(nonExisting?.length - 1, i, "yaha pe hu");
            customer_id = uuid();
            if (!query?.length) {
                query = ` insert into ru_customers (dsa_id, dsa_mobile_number, customer_id, full_name, email_address, customer_mobile_number, password_hash, date_of_birth, address_house_number, address_pincode, address_city, address_state, permanent_account_number, facebook_id, google_id, is_mobile_number_verified, created_at, updated_at, company_name, first_name, last_name, customer_created_date, utm_source, utm_medium, utm_campaign, utm_channel, ad_group_id, campaign_id, utm_term, ad, mt, adpos, gad, gclid, source_from) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
            }
            else {
                query += `, (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
            }
            bindParams = bindParams.concat(["703c6c65-62a1-4934-bf70-87eb32d734c4", "9999999999", nonExisting[i]?.user_id, nonExisting[i]?.full_name || null, nonExisting[i]?.email || null, nonExisting[i]?.mobile_number || null, nonExisting[i]?.password_hash || null, nonExisting[i]?.date_of_birth || null, nonExisting[i]?.address || null, nonExisting[i]?.pincode || null, nonExisting[i]?.city || null, nonExisting[i]?.state || null, nonExisting[i]?.pan_code || null, nonExisting[i]?.facebook_id || null, nonExisting[i]?.google_id || null, nonExisting[i]?.has_mobile_verified || null, nonExisting[i]?.created_at || null, nonExisting[i]?.updated_at || null, nonExisting[i]?.company || null, nonExisting[i]?.f_name || null, nonExisting[i]?.l_name || null, nonExisting[i]?.created_at || null], nonExisting[i]?.utm_source || null, nonExisting[i]?.utm_medium || null, nonExisting[i]?.utm_campaign || null, nonExisting[i]?.utm_channel || null, nonExisting[i]?.adgroupid || null, nonExisting[i]?.campaign_id || null, nonExisting[i]?.utm_term || null, nonExisting[i]?.ad || null, nonExisting[i]?.mt || null, nonExisting[i]?.adpos || null, nonExisting[i]?.gad || null, nonExisting[i]?.gclid || null, 9);

        };
        { query?.length && await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT }) }
    } catch (err) {
        console.log(err)
    }
};

async function fetchFilteredData() {
    const limit = 500; // Batch size
    let lastProcessedId = 0; // Starting point for ID-based pagination
    let hasMoreData = true; // Flag to indicate more data to process

    try {
        while (hasMoreData) {
            // Fetch records in chunks using ID-based pagination
            const query = `
                SELECT * 
                FROM RULoans.ru_api_logs 
                WHERE internal_api = 'https://ms.ruloans.com/api/dsa/registration/send-otp' 
                AND id > ${lastProcessedId} 
                ORDER BY id ASC 
                LIMIT ${limit}`;
            const chunkData = await _db2.query(query, { type: QueryTypes.SELECT });

            // Check if the chunk contains any records
            if (chunkData.length === 0) {
                hasMoreData = false; // Stop fetching if no more data
                break;
            }

            // Process the chunk
            for (let record of chunkData) {
                try {
                    if (record.payload && record.payload.includes('page_source')) {
                        // Parse the payload
                        const payload = JSON.parse(record.payload);

                        // Update the database with extracted `page_source` and `dsaMobileNumber`
                        const updateQuery = `
                            UPDATE ru_direct_selling_agents 
                            SET page_source = ? 
                            WHERE dsa_mobile_number = ?`;
                        await _db2.query(updateQuery, {
                            replacements: [payload.page_source, payload.dsaMobileNumber],
                            type: QueryTypes.UPDATE,
                        });

                        console.log(
                            `Updated: DSA Mobile: ${payload.dsaMobileNumber}, Page Source: ${payload.page_source}`
                        );
                    }
                } catch (parseError) {
                    console.error(
                        `Error parsing payload for record ID: ${record.id}. Skipping...`
                    );
                }

                // Update the last processed ID to the current record's ID
                lastProcessedId = record.id;
            }
        }
        console.log('Data processing completed.');
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
};

// fetchFilteredData();

module.exports = {
    getB2cLeads,
    getAllHyperlinkContent,
    insertHyperlinkContent,
    deleteHyperlinkContent,
    insertHyperlinkContentExtended,
    getHyperlinkContentExtended,
    deleteHyperlinkContentExtended,
    getHyperlinkLocationExternal,
    getHyperlinkDataExternal,
    checkIfHyperlinkExisit,
    getHyperlinkLocation,
    getB2cLeadsById,
    getB2cUserQueries,
    migrateQueries,
    checkIfContentExist,
};