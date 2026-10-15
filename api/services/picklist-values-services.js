const { PicklistValue, PicklistKey, Module } = require("../../models");
const { Op, QueryTypes } = require("sequelize");

const get = async (key_id) => {
    const results = await PicklistValue.findAll({ where: { key_id }, raw: true });
    for (i = 0; i < results?.length; i++) {
        if (results[i]?.parent_id) {
            const data = await PicklistValue.findOne({ where: { id: results[i]?.parent_id }, raw: true });
            results[i] = { ...results[i], parent_value: data?.value }
        } else {
            results[i] = { ...results[i], parent_value: null }
        }
    }
    return results;
};

const create = async ({ id, value, key_id, parent_id, alias }) => {
    if (id) {
        const results = PicklistValue.update({ value, key_id, parent_id, alias }, { where: { id } });
        let query = ` update picklist_values set value=?, key_id=?, parent_id=?, alias=? where id=? `;
        let bindparams = [value, key_id, parent_id || null, alias, id];
        console.log(bindparams);
        await _db2.query(query, { replacements: bindparams, type: QueryTypes.UPDATE });
        return results;
    } else {
        let alias = value.toLowerCase().replaceAll(" ", "_");
        const results = PicklistValue.create({ value, key_id, parent_id, alias });
        let query = ` insert into picklist_values (value, key_id, parent_id, alias) values(?,?,?,?) `;
        let bindparams = [value, key_id, parent_id || null, alias];
        console.log(bindparams);
        await _db2.query(query, { replacements: bindparams, type: QueryTypes.INSERT });
        return results;
    }
};

const getPicklistFromValues = async (module, picklistKey) => {
    const module_id = await PicklistValue.findOne({ where: { value: module } });
    const key_id = await PicklistValue.findOne({ where: { value: picklistKey } });
    const results = await PicklistValue.findAll({ where: { key_id: key_id?.id }, attributes: ['id', 'value'] });
    return results;
};

const createIfNotExist = async (picklistKey, value, module = false) => {
    let pickListKey;
    if (!module) {
        pickListKey = await PicklistKey.findOne({ where: { value: picklistKey }, raw: true });
    } else {
        let module_id = await Module.findOne({ where: { value: module }, raw: true });
        pickListKey = await PicklistKey.findOne({ where: { module_id: module_id?.id, value: picklistKey }, raw: true });
    }
    let picklistValue = await PicklistValue.findOne({ where: { key_id: pickListKey?.id, value: { [Op.like]: '%' + value + '%' } }, raw: true });
    if (picklistValue) {
        return picklistValue?.id;
    } else {
        let picklistValue = await PicklistValue.create({ key_id: pickListKey?.id, value: value });
        return picklistValue?.dataValues?.id;
    }
};

const getChildValues = async ({ parent_id }) => {
    let picklistValue = await PicklistValue.findAll({ where: { parent_id }, attributes: [["id", "value"], ["value", "label"], "alias"], raw: true });
    return picklistValue
};

const deleteValue = async (id) => {
    let pickListValue = await PicklistValue.destroy({ where: { id } });
    let query = ` delete from picklist_values where id = ? `;
    let bindparams = [id];
    await _db2.query(query, { replacements: bindparams, type: QueryTypes.DELETE });
    return pickListValue;
};

const getPicklistValueByValue = async (value) => {
    let pickListValue = await PicklistValue.findOne({ where: { value: value }, raw: true });;
    return pickListValue;
};

const getPicklistValuesExternal = async ({ key, module }) => {
    module = module || "Customer";
    let module_id = await Module.findOne({ where: { value: { [Op.like]: '%' + module } }, raw: true });
    let picklist = await PicklistKey.findOne({
        where: { module_id: module_id?.id, value: { [Op.like]: '%' + key } },
        attributes: ["id", ["value", "key"]],
        include: [
            {
                model: PicklistValue,
                nested: true,
                attributes: ["id", "value", "alias"],
                include: [
                    { model: PicklistValue, nested: true, as: "children", attributes: ["id", "value", "alias"] }
                ],
            },
        ],
    });
    return picklist;
};

module.exports = {
    get,
    create,
    getPicklistFromValues,
    createIfNotExist,
    deleteValue,
    getChildValues,
    getPicklistValueByValue,
    getPicklistValuesExternal
};