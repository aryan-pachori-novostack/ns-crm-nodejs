const { sequelize, _db2 } = require('../../models');
const { QueryTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { checkWhereInQueryString } = require('../helpers/commonhelper');

const addTagToLead = async (tag, lead_id, tagged_by) => {
    let tagQuery = `select bin_to_uuid(id) as id,tag,createdAt as created_at,updatedAt as updated_at from tags where tag = ? `;
    let bindParams = [tag];
    let id;
    const tags = await sequelize.query(tagQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    if (tags.length != 0) {
        id = tags[0].id;
        tagQuery = ` select * from lead_tags where user_id = uuid_to_bin(?) and tag_id = uuid_to_bin(?)   `;
        bindParams = [lead_id, id];
        tag = await sequelize.query(tagQuery, { replacements: bindParams, type: QueryTypes.SELECT });
        if (tag && tag.length != 0) {
            return;
        }
    } else {
        id = uuid();
        tagQuery = ` insert into tags(id,tag) values (uuid_to_bin(?),?) `;
        bindParams = [id, tag];
        tag = await sequelize.query(tagQuery, { replacements: bindParams, type: QueryTypes.INSERT });
    }
    let leadTagId = uuid();
    tagQuery = ` insert into lead_tags (id,user_id,tag_id,tagged_by) values(uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?)) `;
    bindParams = [leadTagId, lead_id, id, tagged_by];
    tag = await sequelize.query(tagQuery, { replacements: bindParams, type: QueryTypes.INSERT });
    return tag;
};

const get = async (where) => {
    let query = `select bin_to_uuid(id) as id , tag from tags `;
    let and = false;
    if (where && where.length != 0) {
        for (let i = 0; i < where.length; i++) {
            if (and == false) {
                query += ' where ';
                and = true;
            } else {
                query += ' and ';
                and = true;
            }
            if (where[i][2]) {
                query += where[i][0] + where[i][1] + ' ? ';
                bindParams.push(where[i][2]);
            } else {
                query += where[i][0] + where[i][1] + ' ';
            }
        }
    }

    let tags = await sequelize.query(query, { type: QueryTypes.SELECT });
    return tags;
};

const deleteTag = async (tagId, leadId) => {
    let deleteQuery = ` delete from lead_tags where user_id = uuid_to_bin(?) and tag_id = uuid_to_bin(?) `;
    bindParams = [leadId, tagId];
    let deleted = await sequelize.query(deleteQuery, { replacements: bindParams, type: QueryTypes.DELETE });
    return deleted;
};

const getLeadTag = async (leadId) => {
    let deleteQuery = ` select bin_to_uuid(t.id) as id ,t.tag as tagName from tags t left join lead_tags lt on t.id = lt.tag_id where lt.user_id = uuid_to_bin(?) `;
    let bindParams = [leadId];
    bindParams = [leadId];
    let tags = await sequelize.query(deleteQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    return tags;
};

const getTagFilteredData = async (params) => {
    let {
        tag_filter,
        tag_type, query,
        queryCount,
        query_reference,
        query_count_reference,
        query_count_alias_reference,
        query_where_field,
        bindParams
    } = params;

    let queryTags = ` select * from tags where tags like "%${tag_filter}%" and type = "${tag_type}" `;
    let tags = await _db2.query(queryTags, { type: QueryTypes.SELECT });
    let ids = tags?.map((obj) => obj?.reference_id);

    query = checkWhereInQueryString(query);
    query += ` ${query_where_field} in (${ids}) `;

    queryCount = checkWhereInQueryString(query);
    queryCount += ` ${query_where_field} in (${ids}) `;

    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let count = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });

    return { [query_reference]: data, [query_count_reference]: count[0][query_count_alias_reference] };
};

const modifyTag = async (type, reference_id, tag) => {
    let query = ` select * from ru_tags_master where type = "${type}" and reference_id = "${reference_id}" `;
    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    data = data[0] || null;

    if (!data) {
        let query = ` insert into ru_tags_master (reference_id, type, tags) values (?,?,?) `;
        await _db2.query(query, { replacements: [reference_id, type, tag], type: QueryTypes.INSERT });
        return;
    };

    query = ` update ru_tags_master set tags = ? where reference_id=? and type=? `;
    await _db2.query(query, { replacements: [tag, reference_id, type], type: QueryTypes.UPDATE });
    return;
};

module.exports = {
    addTagToLead,
    get,
    deleteTag,
    getLeadTag,
    getTagFilteredData,
    modifyTag
};