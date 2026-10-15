const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");
const { v4: uuid } = require("uuid");


//create
const createTemplate = async (data) => {
  const transaction = await sequelize.transaction();
  try {
    const { name, description, subject, body, type, created_by, finalAttachments, link = null } =
      data;
    const query = `
      INSERT INTO notification_templates ( name, description, subject, body, type, cta_url, created_by) 
      VALUES ( ?, ?, ?, ?, ?, ?,?)
    `;
    const bindParams = [name, description, subject, body, type, link, created_by];
    const [id] = await sequelize.query(query, {
      replacements: bindParams,
      type: QueryTypes.INSERT,
      transaction,
    });
    if (finalAttachments && finalAttachments.length > 0) {
      const mediaQueries = finalAttachments.map((attachment) => {
        return {
          query: `INSERT INTO template_media ( template_id, type, url) VALUES ( ?, ?, ?)`,
          bindParams: [id, attachment.type, attachment.url],
        };
      });
      for (const { query, bindParams } of mediaQueries) {
        await sequelize.query(query, {
          replacements: bindParams,
          type: QueryTypes.INSERT,
          transaction,
        });
      }
    }
    await transaction.commit();
    return { id: id };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

//update 
const updateTemplate = async (id, data) => {
  const transaction = await sequelize.transaction();
  try {
    const { name, description, subject, body, link = null, updated_by, attachments } = data;
    const query = `
        UPDATE notification_templates 
        SET name = ?, description = ?, subject = ?, body = ?, cta_url = ?, updated_by =  ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
    const bindParams = [name, description, subject, body, link, updated_by, id];
    await sequelize.query(query, {
      replacements: bindParams,
      type: QueryTypes.UPDATE,
      transaction,
    });
    if (attachments === null || attachments === undefined) {
      // If attachments is not present, assume removal
      const deleteMediaQuery = `
        DELETE FROM template_media WHERE template_id = ? AND type = ?
      `;
      await sequelize.query(deleteMediaQuery, {
        replacements: [id, 'image'],
        type: QueryTypes.DELETE,
        transaction,
      });
    } else if (attachments && attachments.length > 0) {
      const deleteMediaQuery = `
        DELETE FROM template_media WHERE template_id = ?
      `;
      await sequelize.query(deleteMediaQuery, {
        replacements: [id],
        type: QueryTypes.DELETE,
        transaction,
      });
      const mediaQueries = attachments.map((attachment) => {
        return {
          query: `
              INSERT INTO template_media ( template_id, type, url) 
              VALUES ( ?, ?, ?)
            `,
          bindParams: [id, attachment.type, attachment.url],
        };
      });

      for (const { query, bindParams } of mediaQueries) {
        await sequelize.query(query, {
          replacements: bindParams,
          type: QueryTypes.INSERT,
          transaction,
        });
      }
    }

    await transaction.commit();
    return { id: id };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

//delete
const deleteTemplate = async (id) => {
  const query = `
      DELETE FROM notification_templates 
      WHERE id = ?
    `;
  const deletedTemplate = await sequelize.query(query, {
    replacements: [id],
    type: QueryTypes.DELETE,
  });
  return deletedTemplate;
};

//getTemplate
const getTemplateById = async (id) => {
  const query = `
    SELECT 
      nt.id AS id,
      nt.name,
      nt.description,
      nt.subject,
      nt.body,
      nt.type,
      nt.cta_url,
      nt.created_by AS created_by,
      nt.created_at,
      nt.updated_by AS updated_by,
      nt.updated_at,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', tm.id,
          'type', tm.type,
          'url', tm.url
        )
      ) AS attachments
    FROM notification_templates nt
    LEFT JOIN template_media tm ON nt.id = tm.template_id
    WHERE nt.id = ?
    GROUP BY nt.id
  `;
  const template = await sequelize.query(query, {
    replacements: [id],
    type: QueryTypes.SELECT,
  });
  return template;
};

const getTemplatesByType = async (type , offset , limit) => {
  const query = `
    SELECT
      nt.id AS template_id,
      nt.name,
      nt.description,
      nt.subject,
      nt.body,
      nt.type,
      nt.cta_url,
      nt.created_by,
      nt.created_at,
      nt.updated_by,
      nt.updated_at,
      tm.id AS media_id,
      tm.type AS media_type,
      tm.url AS media_url
    FROM notification_templates nt
    LEFT JOIN template_media tm ON nt.id = tm.template_id
    WHERE nt.type = ?
    ORDER BY nt.created_at DESC
      LIMIT ? OFFSET ?
  `;
  const result = await sequelize.query(query, {
      replacements: [type , limit , offset],
      type: QueryTypes.SELECT,
    });
    const templates = []; 
    const templateMap = new Map(); 

    result.forEach(row => {
      const templateId = row.template_id;
      if (!templateMap.has(templateId)) {
        templateMap.set(templateId, {
          id: templateId,
          name: row.name,
          description: row.description,
          subject: row.subject,
          body: row.body,
          type: row.type,
          link: row.cta_url,
          created_by: row.created_by,
          created_at: row.created_at,
          updated_by: row.updated_by,
          updated_at: row.updated_at,
          attachments: [],
        });
        templates.push(templateMap.get(templateId)); 
      }
      if (row.media_id) {
        templateMap.get(templateId).attachments.push({
          id: row.media_id,
          type: row.media_type,
          url: row.media_url,
        });
      }
    });
    let totalQuery = `select count(*) as totalCount from notification_templates Where type = ? `;
    const totalCount = await sequelize.query(totalQuery, { replacements: [type], type: QueryTypes.SELECT });
    return   {templates: templates  , totalCount : totalCount[0].totalCount} 
};

module.exports = {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateById,
  getTemplatesByType,
};
