const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

const create = async (data, user_id) => {
    const { id, type, name, filters, is_default } = data;
    let query;
    let bindParams;

    if (is_default == 1) {
        query = `update list_filters set is_default=0 where type = ? and user_id = uuid_to_bin(?)`
        bindParams = [type, user_id];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    }

    if (id) {
        query = `update list_filters set name=?, filters=?, is_default=? where id=?`;
        bindParams = [name, filters, is_default, id];
    } else {
        query = `insert into list_filters (user_id, type, name, filters, is_default) values (uuid_to_bin(?),?,?,?,?)`;
        bindParams = [user_id, type, name, filters, is_default];
    }
    let result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    return result;
}

const getAllFilters = async (data, user_id) => {
    const { type } = data;
    let query = `select is_default, filters, name, id from list_filters where type=? and user_id = uuid_to_bin(?)`;
    let bindParams = [type, user_id];
    let result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return result;
}

const deleteFilterById = async (data) => {
    const { id } = data;
    let query = `delete from list_filters where id=?`;
    let bindParams = [id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    return
}

module.exports = {
    create,
    getAllFilters,
    deleteFilterById
}