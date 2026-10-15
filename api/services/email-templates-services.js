const { verify } = require('crypto');
const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { v4: uuid } = require('uuid');

const createEmail = async (data) => {
    let query = `
        INSERT INTO notification_templates (
            name, description, subject, body, type, cta_url, created_by
        ) VALUES (
            ?, ?, ?, ?, 'EMAIL', ?, ?
        )`;
    let bindParams = [data.name, data.description, data.subject, data.body,data.module_id, data.created_by];
    let email = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return { id: email[0] };
}

const updateEmail = async (id, data) => {
    let { name, body, subject, description, updated_by, updated_at } = data;
    let query = `
        UPDATE notification_templates 
        SET name = ?, body = ?, subject = ?, description = ?, 
            updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
    let bindParams = [name, body, subject, description, updated_by, id];
    let update = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return update;
}

const getAllEmail = async (offset, limit) => {
    let query = `
        SELECT 
            nt.id,
            nt.name,
            nt.description,
            nt.subject,
            nt.body,
            c.email as created_by_email,
            u.email as updated_by_email,
            c.name as created_by_name,
            u.name as updated_by_name
        FROM notification_templates nt
        LEFT JOIN users c ON c.id = nt.created_by 
        LEFT JOIN users u ON u.id = nt.updated_by
        LEFT JOIN email_template_fields etf on nt.cta_url = etf.id  
        WHERE nt.type = 'EMAIL'
        LIMIT ?, ?`;
    
    let totalQuery = `
        SELECT count(*) as totalCount 
        FROM notification_templates nt
        LEFT JOIN users c ON c.id = nt.created_by 
        LEFT JOIN users u ON u.id = nt.updated_by
        LEFT JOIN email_template_fields etf on nt.cta_url = etf.id  
        WHERE nt.type = 'EMAIL'`;
    
    let bindParams = [offset, limit];
    let email_templates = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(totalQuery, { type: QueryTypes.SELECT });
    return { email_templates, totalCount: totalCount[0].totalCount };
}

//maybe worng

const getById = async (id) => {
    let query = `
        SELECT 
            nt.id,
            nt.name,
            nt.description,
            nt.subject,
            nt.body,
            c.email as created_by_email,
            u.email as updated_by_email,
            c.name as created_by_name,
            u.name as updated_by_name
        FROM notification_templates nt
        LEFT JOIN users c ON c.id = nt.created_by 
        LEFT JOIN users u ON u.id = nt.updated_by
        LEFT JOIN email_template_fields etf on nt.cta_url = etf.id  
        WHERE nt.id = ? AND nt.type = 'EMAIL'`;
    
    let bindParams = [id];
    let email_templates = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return email_templates[0] ? email_templates[0] : null;
}

const deleteEmail = async (id) => {
    let query = `DELETE FROM notification_templates WHERE id = ? `;
    let bindParams = [id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
}

const findEmailTemplate = async (id) => {
    let query = `SELECT * FROM notification_templates WHERE id = ? `;
    let bindParams = [id];
    let email_template = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return email_template[0] ? email_template[0] : null;
}

const getTemplateFields = async (where) => {
    let query = `select id,name,'key' from email_template_fields etf `;
    let and = false;
    let bindParams = [];
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
    let email_template_fields = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return email_template_fields;
}



module.exports = {
    createEmail,
    updateEmail,
    findEmailTemplate,
    deleteEmail,
    getAllEmail,
    getById,
    getTemplateFields
}