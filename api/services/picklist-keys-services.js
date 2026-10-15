const { QueryTypes } = require("sequelize");
const { PicklistValue, PicklistKey, _db2 } = require("../../models")

const get = async (module_id) => {
    const results = await PicklistKey.findAll({ where: { module_id }, raw: true });
    for (i = 0; i < results?.length; i++) {
        if (results[i]?.parent_id) {
            const data = await PicklistKey.findOne({ where: { id: results[i]?.parent_id }, raw: true });
            results[i] = { ...results[i], parent_value: data?.value }
        } else {
            results[i] = { ...results[i], parent_value: null }
        }
    }
    return results;
};

const checkValueExist = async (id) => {
    let data = await PicklistValue.findOne({ where: { key_id: id }, raw: true });
    return data ? true : false;
};

const create = async ({ id, value, module_id, parent_id }) => {
    if (id) {
        const results = PicklistKey.update({ parent_id, value }, { where: { id } });
        let query = ` update picklist_keys set value=?, module_id=?, parent_id=? where id=? `;
        let bindparams = [value, module_id, parent_id, id];
        await _db2.query(query, { replacements: bindparams, type: QueryTypes.UPDATE });
        return results;
    } else {
        const results = PicklistKey.create({ value, module_id, parent_id });
        let query = ` insert into picklist_keys (value, module_id, parent_id) values(?,?,?) `;
        let bindparams = [value, module_id, parent_id];
        await _db2.query(query, { replacements: bindparams, type: QueryTypes.INSERT });
        return results;
    }
};

const deleteKey = async (id) => {
    let pickListKey = await PicklistKey.destroy({ where: { id } });
    let query = ` delete from picklist_keys where id = ? `;
    let bindparams = [id];
    await _db2.query(query, { replacements: bindparams, type: QueryTypes.DELETE });
    return pickListKey;
};

module.exports = {
    get,
    create,
    deleteKey,
    checkValueExist
};