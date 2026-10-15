const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { uploadToS3 } = require("../helpers/commonhelper");
const { bind } = require('bluebird');



const create = async (data) => {
    let  id = uuid();
    let {lead_id,status_id,comment,attachment_url,parent_id,created_by} = data;
    if(attachment_url){
        attachment_url = await uploadToS3('comments_attachments', attachment_url, `${id}`);
    }
    let query =` insert into lead_comments (id,lead_id,status_id,comment,attachment_url,parent_id,created_by) values (uuid_to_bin(?),uuid_to_bin(?),?,?,?,uuid_to_bin(?),uuid_to_bin(?))`;
    let bindParams  = [id,lead_id,status_id,comment,attachment_url,parent_id,created_by];
    await sequelize.query(query, {replacements:bindParams,  type: QueryTypes.INSERT});
    return true;
}

const update = async (id,data) => {
    let {lead_id,comment,status_id,attachment_url,parent_id,updated_by,updatedAt} = data;
    if(attachment_url){
        attachment_url =  attachment_url = await uploadToS3('comments_attachments', attachment_url, `${id}`);
    }
    let query =` update lead_comments set  lead_id = uuid_to_bin(?),status_id = ?,comment = ?,attachment_url = ?,parent_id = uuid_to_bin(?),updated_by=uuid_to_bin(?),updatedAt=? where id = uuid_to_bin(?) `;
    let bindParams  = [lead_id,status_id,comment,attachment_url,parent_id,updated_by,updatedAt,id];
    await sequelize.query(query, {replacements:bindParams,  type: QueryTypes.UPDATE});
    return true;
}

const deleteComment = async (id) => {
    let query =` update lead_comments isDeleted = ? where id = uuid_to_bin(?) `;
    let bindParams  = [true,id];
    await sequelize.query(query, {replacements:bindParams,  type: QueryTypes.UPDATE});
    return true;
}

const getAllComments = async (lead_id,parent_id)=>{
    let query = ` select bin_to_uuid(c.id) as id ,bin_to_uuid(c.parent_id) as parent_id,cs.value as status,l.user_fname as lead_first_name,l.user_lname as lead_last_name,l.email as lead_email, uc.name as created_by_user_name,uc.email as created_by_user_email,bin_to_uuid(c.created_by) as created_by_user_id,uu.name as updated_by_user_name,uu.email as updated_by_user_email,bin_to_uuid(c.updated_by) as updated_by_user_id,bin_to_uuid(c.lead_id) as lead_id, c.comment as comment , c.attachment_url as url,(select count(*) as childCount from lead_comments cc where cc.parent_id = c.id ) as childCount,c.createdAt as created_at,c.updatedAt as updated_at from lead_comments c left join users uc on c.created_by = uc.id left join users uu on c.updated_by = uu.id left join leads l on c.lead_id = l.id left join call_status cs on c.status_id = cs.id  where c.lead_id = uuid_to_bin(?)`;
    let bindParams = [lead_id];
    query+= ` and c.parent_id = uuid_to_bin(?)  `;
    if(parent_id){
        bindParams.push(parent_id);
    }else{
       bindParams.push("00000000-0000-0000-0000-000000000000")
    }
    let lead_comments =  await sequelize.query(query, {replacements:bindParams,  type: QueryTypes.SELECT});
    return lead_comments;
}


module.exports = {
    create,
    update,
    deleteComment,
    getAllComments
}