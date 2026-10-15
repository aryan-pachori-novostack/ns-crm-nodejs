const { sequelize, PayoutList, _db2 } = require('../../models');
const { QueryTypes } = require('sequelize');


const getStatus = async () => {
    let query = ` select * from status `;
    const status = await sequelize.query(query, { type: QueryTypes.SELECT });
    return status;
}
const getStatusById = async (id) => {
    let query = ` select * from status  where id = ? `;
    let bindParams = [id];
    const status = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return status[0] ? status[0] : null;
}
const getStatusByValue = async (value) => {
    let query = ` select * from status  where name = ? `;
    let bindParams = [value];
    const status = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return status[0] ? status[0] : null;
};

const addGlobalStatus = async (data) => {
    let query = "";
    let bindParams = [];
    for (i = 0; i < data?.length; i++) {
        if (i == 0) {
            query = ` insert into ru_global_status_meta (status, sub_status, vendor, product, ru_status, description, actions_required, action_description, created_at, updated_at) values(?,?,?,?,?,?,?,?,?,?) `;
        }
        else {
            query += ` , (?,?,?,?,?,?,?,?,?,?) `
        }
        let actions_required = data[i]["actions_required"] ? data[i]["actions_required"].replace("\n", "") : null;
        let arr = [data[i]["status"] || null, data[i]["sub_status"] || null, data[i]["vendor"] || null, data[i]["product"] || null, data[i]["ru_status"] || null, data[i]["status_description(On Hover show this)"] || null, actions_required, data[i]["action_description"] || null, new Date(), new Date()]
        bindParams = bindParams.concat(arr);
        console.log(arr)
    }
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
};

module.exports = {
    getStatus,
    getStatusById,
    getStatusByValue,
    addGlobalStatus
}