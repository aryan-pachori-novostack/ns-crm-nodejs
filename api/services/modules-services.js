const { QueryTypes } = require('sequelize');
const { Module, PicklistKey, PicklistValue } = require("../../models")

const get = async () => {
    const results = await Module.findAll();
    return results;
    // fetching modules using orm
};

const create = async (value) => {
    const results = Module.create({ value })

    let query = ` insert into modules (value) values(?) `;
    let bindparams = [value];
    await _db2.query(query, { replacements: bindparams, type: QueryTypes.INSERT });

    return results;
    // Creating a fresh module
};

const getFullModules = async (value) => {
    let results;
    if (value == "all") {
        results = Module.findAll({ include: [{ model: PicklistKey, attributes: [["id", "value"], ["value", "label"]], include: [{ model: PicklistValue, attributes: [["id", "value"], ["value", "label"], "alias", "parent_id"] }] }] });
    } else {
        results = Module.findOne({ where: { value: value }, include: [{ model: PicklistKey, attributes: [["id", "value"], ["value", "label"]], include: [{ model: PicklistValue, attributes: [["id", "value"], ["value", "label"], "alias", "parent_id"] }] }] });
    }
    return results;
};

module.exports = {
    get,
    create,
    getFullModules
};