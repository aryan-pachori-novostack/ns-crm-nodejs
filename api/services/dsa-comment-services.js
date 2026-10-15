const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

const getComment = async (data) => {
    const { dsa_id } = data;
    query = ` select dsa_id, dsa_mobile_number, remarks, created_by, updated_by, remark_created_at_date_iso, remark_created_at_date from ru_dsa_remarks where dsa_id = ? order by remark_created_at_date desc `;
    bindParams = [dsa_id];
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    let names = results.map(async (obj) => {
        query = `select name from users where id = uuid_to_bin(?)`;
        bindParams = [obj?.created_by];
        const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        obj.created_by_name=results[0].name;
        return obj;
    });

    let resolvedName = await Promise.all(names);

    return results[0] ? resolvedName : null;
}

const createComment = async (data) => {
    let { mobile, dsa_id, comment, loggedInUserId } = data;
    let date = new Date();

    let query = `insert into ru_dsa_remarks(dsa_id, dsa_mobile_number, remarks, created_by, updated_by, remark_created_at_date_iso, remark_created_at_date) values(?,?,?,?,?,?,?) `;
    let bindParams = [dsa_id, mobile, comment, loggedInUserId, loggedInUserId, date, date];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    query = `select dsa_id, dsa_mobile_number, remarks, created_by, updated_by, remark_created_at_date_iso, remark_created_at_date from ru_dsa_remarks where dsa_id = ? and remark_created_at_date = ? `;
    bindParams = [dsa_id, date];
    const results = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    let names = results.map(async (obj) => {
        query = `select name from users where id = uuid_to_bin(?)`;
        bindParams = [obj?.created_by];
        const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        obj.created_by_name=results[0].name;
        return obj;
    });

    let resolvedName = await Promise.all(names);

    return results[0] ? resolvedName[0] : null;
}


module.exports = {
    getComment,
    createComment
}