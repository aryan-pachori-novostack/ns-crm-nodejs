const { QueryTypes } = require('sequelize');
const { _db2 } = require('../../models');
const { uploadToS3, checkWhereInQueryString, getTableNameFromLoanType } = require('../helpers/commonhelper');
var uuid = require('node-uuid');

exports.getEvents = async (offset, limit, where, countOnly = false) => {
    let query = `SELECT * FROM ru_events e ${where || ""}`;
    let queryCount = `SELECT COUNT(e.id) AS totalCount FROM ru_events e ${where || ""}`;

    query += ` ORDER BY e.created_at DESC `;
    query += limit ? ` LIMIT ${offset}, ${limit} ` : "";

    // Fetch events
    const totalCountResult = await _db2.query(queryCount, { type: QueryTypes.SELECT });
    const totalRecords = totalCountResult[0]?.totalCount || 0;
    if (countOnly) {
        return {
            records: [],
            totalRecords,
        }
    }
    const events = await _db2.query(query, { type: QueryTypes.SELECT });

    // Fetch related data for events
    const eventIds = events.map((event) => event.id); // Extract event IDs
    if (eventIds.length) {
        query = ` SELECT * FROM ru_event_media WHERE event_id IN (?) `;
        let media = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [eventIds] });

        query = ` SELECT * FROM ru_event_eligibilities WHERE event_id IN (?) `;
        let eligibility = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [eventIds] });

        query = ` SELECT * FROM ru_event_rewards WHERE event_id IN (?) `;
        let rewards = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [eventIds] });

        events.forEach((event) => {
            event.media = media?.filter((obj) => obj.event_id == event?.id) || [];
            event.eligibility = eligibility?.filter((obj) => obj.event_id == event?.id) || [];
            event.rewards = rewards?.filter((obj) => obj.event_id == event?.id) || [];
        });
    } else {
        events.forEach((event) => { event.relatedData = null });
    };
    return {
        records: events,
        totalRecords,
    };
};

exports.createOrEditEvent = async (data) => {
    let { id, title, description, benefits, requirements, start_date, end_date, sort_order, type } = data;
    const istOffset = 5.5 * 60 * 60 * 1000;

    start_date = start_date?.includes("Z") ? new Date(new Date(start_date).getTime() + istOffset) : start_date;
    end_date = end_date?.includes("Z") ? new Date(new Date(end_date).getTime() + istOffset) : end_date;

    let query = ` insert into ru_events (title, description, benefits, requirements, start_date, end_date, sort_order, type) values (?,?,?,?,?,?,?,?) `;
    let bindParams = [title, description, benefits, requirements, start_date, end_date, sort_order || null, type];

    if (id) {
        query = ` update ru_events set title=?, description=?, benefits=?, requirements=?, start_date=?, end_date=?, sort_order=?, type=? where id = ? `;
        bindParams = [title, description, benefits, requirements, start_date, end_date, sort_order || null, type, id];
    };

    await _db2.query(query, { replacements: bindParams, type: id ? QueryTypes.UPDATE : QueryTypes.INSERT });
    return;
};

exports.createOrEditEventRewards = async (data) => {
    const { id, reward_type_alias, reward, count_disbursement_slab_min, count_disbursement_slab_max, iteration, reward_metric, event_id } = data;
    let query = ` insert into ru_event_rewards (reward_type_alias, reward, count_disbursement_slab_min, count_disbursement_slab_max, iteration, reward_metric, event_id) values (?,?,?,?,?,?,?) `;
    bindParams = [reward_type_alias, reward, count_disbursement_slab_min, count_disbursement_slab_max, iteration, reward_metric, event_id];

    if (id) {
        query = ` update ru_event_rewards set reward_type_alias=?, reward=?, count_disbursement_slab=?, iteration=?, reward_metric=?, count_disbursement_slab_min=?, count_disbursement_slab_max=? where id = ? `;
        bindParams = [reward_type_alias, reward, count_disbursement_slab, iteration, reward_metric, count_disbursement_slab_min, count_disbursement_slab_max, id];
    };

    await _db2.query(query, { replacements: bindParams, type: id ? QueryTypes.UPDATE : QueryTypes.INSERT });
    return;
};

exports.createOrEditEventMedia = async (data) => {
    let { id, media_url, media_type, event_id, sort_order } = data;

    if (!Boolean(media_url?.includes("https://") || media_url?.includes("http://")) && media_url) {
        let imageId = uuid();
        media_url = await uploadToS3('event_media', media_url, `event_media_${imageId}`, 'image/jpeg', "jpg");
    };

    let query = ` insert into ru_event_media (media_url, media_type, event_id, sort_order) values (?,?,?,?) `;
    bindParams = [media_url, media_type, event_id, sort_order || null];

    if (id) {
        query = ` update ru_event_media set media_url=?, media_type=?, sort_order=? where id = ? `;
        bindParams = [media_url, media_type, sort_order || null, id];
    };

    await _db2.query(query, { replacements: bindParams, type: id ? QueryTypes.UPDATE : QueryTypes.INSERT });
    return;
};

exports.createOrEditEventEligibility = async (data) => {
    const { id, product, loan_type, event_id } = data;
    let query = ` insert into ru_event_eligibilities (product, loan_type, event_id) values (?,?,?) `;
    bindParams = [product.toString(), loan_type, event_id];

    if (id) {
        query = ` update ru_event_eligibilities set product=?, loan_type=? where id = ? `;
        bindParams = [product.toString(), loan_type, id];
    };

    await _db2.query(query, { replacements: bindParams, type: id ? QueryTypes.UPDATE : QueryTypes.INSERT });
    return;
};

exports.hardDeleteFromType = async (data) => {
    const { id, type } = data;
    let query;
    let bindParams;

    if (type == "event") {
        query = ` delete from ru_events where id=? `;
        bindParams = [id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.DELETE });

        query = ` delete from ru_event_media where event_id=? `;
        bindParams = [id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.DELETE });

        query = ` delete from ru_event_eligibilities where event_id=? `;
        bindParams = [id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    } else {
        query = ` delete from ru_event_${type} where id=? `;
        bindParams = [id];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    };
    return;
};

const getFinalResult = (userIds, key = "dsa_id") => {
    const result = userIds.reduce((acc, record) => {
        const {
            achieved_login_count = 0,
            achieved_login_amount = 0,
            achieved_disbursed_amount = 0,
            achieved_disbursed_count = 0
        } = record;

        // Find existing record for the same dsa_id in the accumulator
        const existingRecord = acc.find(item => item[key] === record[key]);

        if (existingRecord) {
            existingRecord.achieved_login_count += Number(achieved_login_count);
            existingRecord.achieved_login_amount += Number(achieved_login_amount);
            existingRecord.achieved_disbursed_amount += Number(achieved_disbursed_amount);
            existingRecord.achieved_disbursed_count += Number(achieved_disbursed_count);
        } else {
            // If not found, create a new record
            acc.push({
                ...record,
                achieved_login_count: Number(achieved_login_count),
                achieved_login_amount: Number(achieved_login_amount),
                achieved_disbursed_amount: Number(achieved_disbursed_amount),
                achieved_disbursed_count: Number(achieved_disbursed_count),
            });
        }

        return acc;
    }, []);
    return result;
};

exports.getWinnersForContest = async (event_id) => {
    let query;
    let userIds = [];

    // Fetch event details
    query = `SELECT * FROM ru_events e WHERE e.id = ?`;
    let event = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [event_id] });
    event = event[0];

    // Fetch eligibility and rewards
    query = `SELECT * FROM ru_event_eligibilities WHERE event_id = ?`;
    let eligibility = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [event_id] });

    query = `SELECT * FROM ru_event_rewards WHERE event_id = ?`;
    let rewards = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [event_id] });


    for (let i = 0; i < eligibility?.length; i++) {
        let products = eligibility[i]?.product?.split(",");
        let where = "";
        let having = "";
        let columns = "";
        let dsa_join = ` left join ru_direct_selling_agents d on d.dsa_id = l.dsa_id left join ru_direct_selling_agents p on p.dsa_mobile_number = d.partner_code left join ru_direct_selling_agents bh on bh.dsa_mobile_number = d.business_head_code `;
        if (products) {
            where = checkWhereInQueryString(where);
            where += ` lp.product_vendor in (?) `
        };

        for (let j = 0; j < rewards?.length; j++) {
            if (rewards[j]?.reward_metric?.includes("login")) {
                where = checkWhereInQueryString(where);
                where += ` DATE(l.created_at) between DATE("${event?.start_date}") and DATE("${event?.end_date}") `;

                if (rewards[j]?.reward_metric?.includes("count")) {
                    having = ` having ( count(*) > ${rewards[j]?.count_disbursement_slab_min} and count(*) <= ${rewards[j]?.count_disbursement_slab_max}) `;
                    columns = ` count(*) AS achieved_login_count `;
                };
                if (rewards[j]?.reward_metric?.includes("amount")) {
                    having = ` having (sum(cast(l.applied_loan_amount as unsigned)) > ${rewards[j]?.count_disbursement_slab_min} and sum(cast(l.applied_loan_amount as unsigned)) <= ${rewards[j]?.count_disbursement_slab_max}) `;
                    columns = ` sum(cast(l.applied_loan_amount as unsigned)) AS achieved_login_amount `;
                };
            };

            if (rewards[j]?.reward_metric?.includes("disburse")) {
                where = checkWhereInQueryString(where);
                where += ` DATE(lm.disbursed_date) between DATE("${event?.start_date}") and DATE("${event?.end_date}") `;

                if (rewards[j]?.reward_metric?.includes("count")) {
                    having = ` having ( count(*) > ${rewards[j]?.count_disbursement_slab_min} and count(*) <= ${rewards[j]?.count_disbursement_slab_max}) `;
                    columns = ` count(*) AS achieved_disbursed_count `;
                };
                if (rewards[j]?.reward_metric?.includes("amount")) {
                    having = ` having (sum(cast(l.disbursed_loan_amount as unsigned)) > ${rewards[j]?.count_disbursement_slab_min} and sum(cast(l.disbursed_loan_amount as unsigned)) <= ${rewards[j]?.count_disbursement_slab_max}) `;
                    columns = ` sum(cast(l.disbursed_loan_amount as unsigned)) AS achieved_disbursed_amount `;
                };
            };

            query = ` SELECT l.dsa_id, d.full_name, d.dsa_mobile_number, p.dsa_mobile_number as partner_code, p.full_name as partner_name, bh.dsa_mobile_number as bh_code, bh.full_name as bh_name,  ${columns} FROM ${getTableNameFromLoanType(eligibility[i]?.loan_type, "table_name")} l left join ${getTableNameFromLoanType(eligibility[i]?.loan_type, "meta_table")} lm on l.application_id = lm.application_id left join \`${process?.env?.DATABASE3_NAME}\`.ru_loans_products lp on l.product_id = lp.id ${dsa_join} ${where} group by l.dsa_id ${having} `;
            let users = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [products] });
            userIds = [...userIds, ...users];
        };
    };

    let result = getFinalResult(userIds);
    return result;
};

exports.getContestForDsa = async (user_id, offset, limit, where) => {
    let query;
    let result = [];

    // Fetch event details
    query = ` SELECT * FROM ru_events e ${where} `;
    let events_count = await _db2.query(`SELECT count(distinct id) as count FROM ru_events e ${where}`, { type: QueryTypes.SELECT });
    if (limit) {
        query += ` limit ${offset}, ${limit} `;
    };
    let events = await _db2.query(query, { type: QueryTypes.SELECT });

    for (let i = 0; i < events?.length; i++) {
        let event = events[i];

        query = `SELECT * FROM ru_event_media WHERE event_id = ?`;
        let media = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [event?.id] });

        // Fetch eligibility and rewards
        query = `SELECT * FROM ru_event_eligibilities WHERE event_id = ?`;
        let eligibility = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [event?.id] });

        query = `SELECT * FROM ru_event_rewards WHERE event_id = ?`;
        let rewards = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [event?.id] });

        if (user_id) {
            for (let i = 0; i < eligibility?.length; i++) {
                let products = eligibility[i]?.product?.split(",");
                let where = ` where dsa_id = "${user_id}" `;
                let having = "";
                let columns = "";
                if (products) {
                    where = checkWhereInQueryString(where);
                    where += ` lp.product_vendor in (?) `
                };

                for (let j = 0; j < rewards?.length; j++) {
                    if (rewards[j]?.reward_metric?.includes("login")) {
                        where = checkWhereInQueryString(where);
                        where += ` DATE(l.created_at) between DATE("${event?.start_date}") and DATE("${event?.end_date}") `;

                        if (rewards[j]?.reward_metric?.includes("count")) {
                            columns = ` count(*) AS achieved_login_count `;
                        };
                        if (rewards[j]?.reward_metric?.includes("amount")) {
                            columns = ` sum(cast(l.applied_loan_amount as unsigned)) AS achieved_login_amount `;
                        };
                    };

                    if (rewards[j]?.reward_metric?.includes("disburse")) {
                        where = checkWhereInQueryString(where);
                        where += ` DATE(cast(lm.disbursed_date as unsigned)) between DATE(${event?.start_date}) and DATE(${event?.end_date}) `;

                        if (rewards[j]?.reward_metric?.includes("count")) {
                            columns = ` count(*) AS achieved_disbursement_count `;
                        };
                        if (rewards[j]?.reward_metric?.includes("amount")) {
                            columns = ` sum(cast(l.disbursed_loan_amount as unsigned)) AS achieved_disbursement_amount `;
                        };
                    };

                    query = ` SELECT l.dsa_id, ${columns} FROM ${getTableNameFromLoanType(eligibility[i]?.loan_type, "table_name")} l left join ${getTableNameFromLoanType(eligibility[i]?.loan_type, "meta_table")} lm on l.application_id = lm.application_id left join \`${process?.env?.DATABASE3_NAME}\`.ru_loans_products lp on l.product_id = lp.id  ${where}  group by l.dsa_id ${having} `;
                    let users = await _db2.query(query, { type: QueryTypes.SELECT, replacements: [products] });

                    result.push({
                        ...event,
                        media,
                        eligibility,
                        rewards,
                        achieved_login_count: users[0]?.achieved_login_count,
                        achieved_login_amount: users[0]?.achieved_login_amount,
                        achieved_disbursed_count: users[0]?.achieved_disbursed_count,
                        achieved_disbursed_amount: users[0]?.achieved_disbursed_amount
                    });
                };
            }
        }

        else {
            result.push({
                ...event,
                media,
                eligibility,
                rewards
            });
        }
    };

    result = getFinalResult(result, "id");

    //result formatting start
    let formattedResult = [];
    for (k = 0; k < result?.length; k++) {
        let resultReward = [];
        for (l = 0; l < result[k]?.rewards?.length; l++) {
            let obj = result[k]?.rewards[l];
            obj[`achieved_${obj?.reward_metric}`] = result[k] ? result[k][`achieved_${obj?.reward_metric}`] : 0;
            resultReward?.push(obj);
        };
        console.log(resultReward)
        result[k]["rewards"] = resultReward;
        let { achieved_login_count, achieved_login_amount, achieved_disbursed_count, achieved_disbursed_amount, ...rest } = result[k];
        formattedResult?.push(rest);
    };
    //result formatting end

    return {records: formattedResult, totalRecords: events_count[0]?.count || 0};
};
// getContestForDsa("a53c8c52-827e-4ed3-9b36-27ce45c7a84e");
// getWinnersForContest(2);



