const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

const getAllCrmComponentConfigs = async (where, offset, limit) => {
    let query = ` select * from  crm_component_configs ${where} order by id desc limit ${offset}, ${limit} `;
    let crmComponentConfigs = await sequelize.query(query, { type: QueryTypes.SELECT });

    let queryCount = ` select count(*) as count from crm_component_configs ${where} `;
    let totalRecords = await sequelize.query(queryCount, { type: QueryTypes.SELECT });
    return { records: crmComponentConfigs, totalRecords: totalRecords[0]?.count };
    // We didn't need to destructure the result here - the results were returned directly
};

const getCrmComponentConfigs = async (id) => {
    let bindParams = [id];
    let query = ` select * from  crm_component_configs where id = ? `;
    let crmComponentConfigs = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return crmComponentConfigs[0];
    // We didn't need to destructure the result here - the results were returned directly
};

const createCrmComponentConfigs = async (data) => {
    let { platform, module, placement, component_type, title, sub_title, description, section } = data;
    let bindParams = [platform, module, placement, component_type, title, sub_title, description, section];
    let query = ` insert into  crm_component_configs(platform,module,placement,component_type,title,sub_title,description,section ) values (?,?,?,?,?,?,?,?)`
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    // We didn't need to destructure the result here - the results were returned directly
};

const editCrmComponentConfigs = async (data) => {
    let { id, platform, module, placement, component_type, title, sub_title, description, section } = data;
    let bindParams = [platform, module, placement, component_type, title, sub_title, description, section, id];
    let query = ` update  crm_component_configs set platform = ?,module = ?,placement = ?,component_type = ?,title = ?,sub_title = ?,description = ?,section = ?  where id = ? `
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    // We didn't need to destructure the result here - the results were returned directly
};

const deleteCrmComponentConfigs = async (id) => {
    let bindParams = [id];
    let query = ` delete from  crm_component_configs where id = ? `;
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    // We didn't need to destructure the result here - the results were returned directly
};

const getCrmComponentMeta = async (id) => {
    let bindParams = [id];
    let query = ` select * from  crm_component_meta where id  = ? `
    let crmComponentMeta = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return crmComponentMeta[0];
    // We didn't need to destructure the result here - the results were returned directly
};

const createCrmComponentMeta = async (data) => {
    let { category, sub_category, id, config_id, hyperlink, hypertext, description, media_title, media_source, media_type, status, created_by, updated_by, sort_order, expiration_date } = data;
    if (id) {
        let bindParams = [config_id, hyperlink, hypertext, description, media_title, media_source, media_type, status, updated_by, new Date(), sort_order, expiration_date, category, sub_category, id];
        let query = ` update crm_component_meta set config_id = ?, hyperlink = ?, hypertext = ?, description = ?, media_title = ?, media_source = ?, media_type = ?, status = ?, created_by = ?, updated_at = ?, sort_order = ?, expiration_date = ?, category = ?, sub_category = ? where id = ? `
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    } else {
        let bindParams = [config_id, hyperlink || null, hypertext || null, description || null, media_title || null, media_source, media_type, status, created_by, updated_by, sort_order || null, expiration_date || null, category || null, sub_category || null];
        let query = ` insert into  crm_component_meta(config_id, hyperlink, hypertext,description, media_title,media_source,media_type,status,created_by,updated_by,sort_order,expiration_date,category,sub_category) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        let result = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        id = result[0];
    };
    return id;
};

const getCrmComponentMetaForConfig = async (id) => {
    let bindParams = [id];
    let query = ` SELECT ccm.*, s.name AS status_name, cu.email AS created_by_email, uu.email AS updated_by_user_email, ccm.hyperlink, ccm.hypertext, GROUP_CONCAT(gt.tag) AS all_tags FROM crm_component_meta ccm LEFT JOIN status s ON ccm.status = s.id LEFT JOIN users cu ON ccm.created_by = bin_to_uuid(cu.id) LEFT JOIN users uu ON ccm.updated_by = bin_to_uuid(uu.id) LEFT JOIN global_tags gt ON FIND_IN_SET(ccm.id, gt.content_id) WHERE ccm.config_id = ? GROUP BY ccm.id ORDER BY ccm.sort_order ASC `;
    let crmComponentMeta = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    for (i = 0; i < crmComponentMeta?.length; i++) {
        crmComponentMeta[i]["tags"] = crmComponentMeta[i]["all_tags"]?.replaceAll(" ", "")?.split(",")
    };
    return crmComponentMeta;
    // We didn't need to destructure the result here - the results were returned directly
};

const getMetaExternal = async (data) => {
    const { module, platform, component_type, category, sub_category, is_hero_slider, tag } = data;
    let query = ` select * from  crm_component_configs cf where cf.module=? and cf.platform=? ${component_type ? ` and cf.component_type='${component_type}' ` : ""} `;
    let bindParams = [module, platform];
    let crmComponentConfig = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    crmComponentConfig = crmComponentConfig[0];

    if (crmComponentConfig) {
        let query;
        if (is_hero_slider) {
            query = ` SELECT ccm.*, GROUP_CONCAT(gt.tag) AS all_tags FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) AS row_num FROM crm_component_meta ccm WHERE status = 1 AND config_id = ? and (ccm.expiration_date > NOW() or ccm.expiration_date is null) and (status = 1 or status is null) ${category ? ` AND category LIKE '%${category}%' ` : ""} ${sub_category ? ` AND sub_category LIKE '%${sub_category}%' ` : ""}) AS ccm LEFT JOIN global_tags gt ON FIND_IN_SET(ccm.id, gt.content_id) WHERE ccm.row_num <= 6 GROUP BY ccm.id, ccm.category ${tag ? ` having GROUP_CONCAT(gt.tag) LIKE '%${tag}%' ` : ""} `;
        } else {
            query = ` select ccm.*, GROUP_CONCAT(gt.tag) AS all_tags from crm_component_meta ccm LEFT JOIN global_tags gt ON FIND_IN_SET(ccm.id, gt.content_id) where ccm.status = 1 and ccm.config_id = ? and (ccm.expiration_date > NOW() or ccm.expiration_date is null) and (status = 1 or status is null)   ${category ? ` and category like '%${category}%' ` : ""} ${sub_category ? ` AND sub_category LIKE '%${sub_category}%' ` : ""} group by ccm.id ${tag ? ` having GROUP_CONCAT(gt.tag) LIKE '%${tag}%' ` : ""} order by ccm.sort_order `;
        };

        let bindParams = [crmComponentConfig?.id];
        let crmComponentMeta = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        if (is_hero_slider) {
            const categorizedComponents = crmComponentMeta.reduce((acc, item) => {
                if (!acc[item.category]) {
                    acc[item.category] = [];
                }
                acc[item.category].push(item);
                return acc;
            }, {});
            crmComponentMeta = categorizedComponents;
        };

        crmComponentConfig["content"] = crmComponentMeta;
    };

    return crmComponentConfig;
};

const removeElementString = (str, elementToRemove, addElement = false) => {
    elementToRemove = `${elementToRemove}`;
    addElement = addElement ? `${addElement}` : false;
    let arr = str.split(',');
    arr = arr.filter(item => item !== elementToRemove && item !== "");
    let result = arr.join(',');
    let added = result?.length > 1 ? result + `,${addElement}` : `${addElement}`;
    return addElement ? added : result;
};

const createGlobalTags = async (tags, content_id) => {
    tags = !tags?.length ? [""] : tags;
    let newArr = [];
    let oldArr = [];
    let query;
    let bindParams = [];
    for (let i = 0; i < tags?.length; i++) {
        if (tags[i]?.inputValue) {
            newArr.push(tags[i]?.inputValue)
        } else {
            oldArr.push(tags[i])
        }
    };

    // for old array
    if (oldArr?.length || !tags?.length) {
        //delete first
        query = ` SELECT * FROM global_tags WHERE tag NOT IN (?) AND FIND_IN_SET(?, content_id) > 0 `;
        bindParams = [oldArr, content_id];
        let toDelete = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        if (toDelete?.length) {
            let deleteArr = [];
            for (let i = 0; i < toDelete?.length; i++) {
                deleteArr.push(toDelete[i]?.id);
            };
            query = ` delete FROM global_tags WHERE id IN (?) `;
            bindParams = [deleteArr];
            await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });

            bindParams = [];
            for (let i = 0; i < toDelete?.length; i++) {
                if (i == 0) {
                    query = `insert into global_tags (tag, content_id, content_type) values (?, ?, "content_manager")`;
                } else {
                    query += `, (?, ?, "content_manager") `
                }
                bindParams = bindParams.concat([toDelete[i]?.tag, removeElementString(toDelete[i]?.content_id, content_id)]);
            }
            await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        };

        //then insert
        query = ` SELECT * FROM global_tags WHERE tag IN (?) `;
        bindParams = [oldArr];
        let toInsert = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        if (toInsert?.length) {
            deleteArr = [];
            for (let i = 0; i < toInsert?.length; i++) {
                deleteArr.push(toInsert[i]?.id);
            };
            query = ` delete FROM global_tags WHERE id IN (?) `;
            bindParams = [deleteArr];
            await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });

            bindParams = [];
            for (let i = 0; i < toInsert?.length; i++) {
                if (i == 0) {
                    query = `insert into global_tags (tag, content_id, content_type) values (?, ?, "content_manager")`;
                } else {
                    query += `, (?, ?, "content_manager") `
                }
                let id = removeElementString(toInsert[i]?.content_id, content_id, content_id);
                bindParams = bindParams.concat([toInsert[i]?.tag, id]);
            }
            await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
        };
    };

    // for new array
    if (newArr?.length) {
        bindParams = [];
        for (let i = 0; i < newArr?.length; i++) {
            if (i == 0) {
                query = `insert into global_tags (tag, content_id, content_type) values (?, ?, "content_manager")`;
            } else {
                query += `, (?, ?, "content_manager") `
            }
            bindParams = bindParams.concat([newArr[i], content_id]);
        }
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    };
};

const getAllGlobalTagsByType = async (offset, limit, where) => {
    let query = ` select * from  global_tags ${where} limit ${offset || 0}, ${limit || 10} `;
    let records = await sequelize.query(query, { type: QueryTypes.SELECT });

    let queryCount = ` select count(id) as count from  global_tags ${where} `;
    let totalRecords = await sequelize.query(queryCount, { type: QueryTypes.SELECT });
    return { records, totalRecords: totalRecords[0]?.count || 0 };
};

module.exports = {
    createCrmComponentConfigs,
    getAllCrmComponentConfigs,
    deleteCrmComponentConfigs,
    editCrmComponentConfigs,
    createCrmComponentMeta,
    getCrmComponentConfigs,
    getCrmComponentMeta,
    getCrmComponentMetaForConfig,
    getMetaExternal,
    createGlobalTags,
    getAllGlobalTagsByType
};

