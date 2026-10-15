const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { lead } = require('../v1/validation/lead');


const create = async (data) => {
    let { id, title, file_path, type, assigned_to, created_by, lead_id } = data;
    let query = `insert into lead_documents (id,title,file_path, type, assigned_to,created_by,lead_id) values(uuid_to_bin(?),?,?,?,uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?)) `;
    let bindParams = [id, title, file_path, type, assigned_to, created_by, lead_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    query = `select bin_to_uuid(id) as id,bin_to_uuid(created_by) as created_by,bin_to_uuid(assigned_to) as assigned_to,title,file_path, type from lead_documents where id = uuid_to_bin(?) `;
    bindParams = [id];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const update = async (data) => {
    let { title, file_path, type, assigned_to, updated_by, lead_id, updated_at } = data;
    let query = `update lead_documents set title=?,file_path=? , assigned_to=uuid_to_bin(?),updated_by=uuid_to_bin(?),updated_at=? where lead_id = uuid_to_bin(?) and type = ? `;
    let bindParams = [title, file_path, assigned_to, updated_by, updated_at, lead_id, type];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    query = `select bin_to_uuid(id) as id,bin_to_uuid(lead_id) as lead_id ,bin_to_uuid(created_by) as created_by,bin_to_uuid(assigned_to) as assigned_to,title,file_path, type from lead_documents where lead_id = uuid_to_bin(?) and type = ? `;
    bindParams = [lead_id, type];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const getLeadDocument = async (lead_id, type) => {
    let query = ' SELECT   bin_to_uuid(id) as id,bin_to_uuid(lead_id) as lead_id ,bin_to_uuid(created_by)  as created_by,bin_to_uuid(assigned_to) as assigned_to,title,file_path, type FROM  lead_documents where lead_id = uuid_to_bin(?) and type = ? ';
    let bindParams = [lead_id, type];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results[0] ? results[0] : null;
}

const getLeadDocumentType = async () => {

    let query = ' SELECT distinct * FROM  lead_document_types';
    const results = await sequelize.query(query, { type: QueryTypes.SELECT });
    return results;
    // We didn't need to destructure the result here - the results were returned directly
}

const getLeadDocuments = async (id) => {

    let query = ' select bin_to_uuid(l.id) as id , l.title as title, l.file_path as path, l.type as type, bin_to_uuid(l.assigned_to) as assigned_to, l.created_at as created_at, bin_to_uuid(created_by) as created_by, l.updated_at as updatd_at, l.updated_by as updated_by,lt.value as type from lead_documents l left join lead_document_types lt on l.type = lt.id where l.lead_id=uuid_to_bin(?); '
    let bindParams = [id];
    const results = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return results;

}


module.exports = {
    create,
    getLeadDocument,
    getLeadDocumentType,
    update,
    getLeadDocuments
}