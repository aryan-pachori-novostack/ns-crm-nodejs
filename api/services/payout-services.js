const { sequelize, PayoutList } = require('../../models');
const { QueryTypes } = require('sequelize');

const getDistinctSingleProperty = async (columnName, where) => {

    let bindParams = [];
    let query = ' SELECT distinct ' + columnName + ' as ' + columnName + ' FROM payouts ';
    if (where && where.length != 0) {
        query += ' where ';
        for (let i = 0; i < where.length; i++) {
            if (i == 0) query += where[i][0] + ' = ? ';
            else query += ' and ' + where[i][0] + ' = ? ';
            bindParams.push(where[i][1])
        }
    }
    query += ' order by ' + columnName + ' asc ';
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const parsed = (data) => {
        for (j = 0; j < results?.length; j++) {
            if (results[j][columnName]) {
                return data
            }
            return [];
        }
    }
    return results;
    // We didn't need to destructure the result here - the results were returned directly
}


const getPayout = async (where, offset, limit) => {
    let bindParams = [];
    let query = ' SELECT   * from payouts  ';
    let queryCount = ' SELECT count(*) as totalCount FROM payouts ';
    let and = false;
    if (where && where.length != 0) {
        and = true;
        query += ' where ';
        queryCount += ' where ';
        for (let i = 0; i < where.length; i++) {
            if (i == 0) {
                query += where[i][0] + ' = ? ';
                queryCount += where[i][0] + ' = ? ';
            }
            else {
                query += ' and ' + where[i][0] + ' = ? ';
                queryCount += ' and ' + where[i][0] + ' = ? ';
            }
            bindParams.push(where[i][1])
        }
    }
    query += ' order by id asc ';
    query += limit ? ` limit ${offset},${limit} ` : "";
    const totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    const allPayouts = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let payoutIds = [];
    for (let i = 0; i < allPayouts.length; i++) {
        allPayouts[i].slabs = [];
        payoutIds.push(allPayouts[i].id)
    }
    if (payoutIds.length == 0) return { users: allPayouts, totalCount: totalCount[0].totalCount };
    let slabQuery = ` select * from payout_slabs where payout_id in (?) `;
    bindParams = [payoutIds];
    let slabs = await sequelize.query(slabQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    for (let i = 0; i < allPayouts.length; i++) {
        for (let j = 0; j < slabs.length; j++) {
            if (allPayouts[i].id == slabs[j].payout_id) {
                allPayouts[i].slabs.push(slabs[j]);
            }
        }
    }
    return { results: allPayouts, totalCount: totalCount[0].totalCount };

    // We didn't need to destructure the result here - the results were returned directly
}
const findPayoutByPayoutIdAndDsaMobile = async (payout_id, dsa_mobile_number) => {
    let bindParams = [payout_id, dsa_mobile_number];
    let query = ' SELECT   * from lead_payout where payout_id = ? and phone =  ? ';
    const payout = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return payout[0];
}
module.exports = {
    getDistinctSingleProperty,
    getPayout,
    findPayoutByPayoutIdAndDsaMobile
}