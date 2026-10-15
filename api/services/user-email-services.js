const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { uploadToS3 } = require("../helpers/commonhelper");




const create = async (data) => {
    let  id = uuid();
    let {to_mail,to_bcc,to_cc,subject,body,send_by,status,lead_id} = data;
    let query =` insert into user_emails (id,to_mail,to_bcc,to_cc,subject,body,send_by,status,lead_id) values (uuid_to_bin(?),?,?,?,?,?,uuid_to_bin(?),?,uuid_to_bin(?))`;
    let bindParams  = [id,to_mail,to_bcc,to_cc,subject,body,send_by,status,lead_id];
    await sequelize.query(query, {replacements:bindParams,  type: QueryTypes.INSERT});
    query = ` select bin_to_uuid(id) as id, to_mail,to_bcc,to_cc,subject,body, bin_to_uuid(send_by) as send_by,status from user_emails where id = uuid_to_bin(?)`;
    bindParams=[id];
    let user_email = await  sequelize.query(query, {replacements:bindParams,  type: QueryTypes.SELECT});
    return user_email[0]?user_email[0]:null;
}

const createAttachment = async(user_email_id,attachments)=>{
    try{
    let url;
    let query;
    let bindParams = [];
    let id;
    for(let i=0;i<attachments.length;i++){
        id = uuid();
        url = await uploadToS3('email_attachments', attachments[i], `${user_email_id}${i}`);
        query = ` insert into user_email_attachments (id,email_id,url) values(uuid_to_bin(?),uuid_to_bin(?),?)`;
        bindParams = [id,user_email_id,url];
        await sequelize.query(query, {replacements:bindParams,  type: QueryTypes.INSERT});
    }
   }catch(err){
    console.log(err);
   }
}

const getEmails = async (user_id,where,offset,limit)=>{
    let and = false;
    let query = ` select bin_to_uuid(ue.id) as id, ue.to_mail,ue.to_bcc,ue.to_cc,ue.subject,ue.body,bin_to_uuid(ue.lead_id) as lead_id,l.user_fname as lead_first_name,l.user_lname as lead_last_name,l.email as lead_email,l.mobile as lead_mobile, bin_to_uuid(ue.send_by) as send_by,ue.status,u.name as userName, u.email as userEmail, u.phone as userPhone from user_emails ue left join users u on ue.send_by = u.id left join leads l on ue.lead_id = l.id   `;
    let queryCount = `  select count(*) as totalCount from user_emails ue  `;
    let bindParams = [];
    if (where && where.length != 0) {
        for (let i = 0; i < where.length; i++) {
            if (and == false) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            } else {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (where[i][2]) {
                query += where[i][0] + where[i][1] + ' ? ';
                queryCount += where[i][0] + where[i][1] + ' ? ';
                bindParams.push(where[i][2]);
            } else {
                query += where[i][0] + where[i][1] + ' ';
                queryCount += where[i][0] + where[i][1] + '  ';
            }
        }
    }
    query+= ` limit ${offset},${limit}`;
    let totalCount =  await sequelize.query(queryCount, {replacements:bindParams,  type: QueryTypes.SELECT});
    let emails =  await sequelize.query(query, {replacements:bindParams,  type: QueryTypes.SELECT});
    let emailIds = [];
    for(let i=0;i<emails.length;i++){
        emailIds.push(emails[i].id);
        emails[i].attachments = [];
    }
    if(emailIds.length==0) return {emails,totalCount:totalCount[0].totalCount};
    query = `select url,bin_to_uuid(email_id) as email_id from user_email_attachments where bin_to_uuid(email_id) in (?) `;
    bindParams = [emailIds];
    let attachments =  await sequelize.query(query, {replacements:bindParams,  type: QueryTypes.SELECT});
    console.log(attachments.length)
    for(let i=0;i<emails.length;i++){
        for(let j=0;j<attachments.length;j++){
           if(emails[i].id == attachments[j].email_id){
                emails[i].attachments.push(attachments[j]);
           }
        }
    }
    // for(let i=0;i<emails.length;i++){
    //     query = `select url from user_email_attachments where email_id = uuid_to_bin(?)`;
    //     bindParams = [emails[i].id];
    //     let attachments =  await sequelize.query(query, {replacements:bindParams,  type: QueryTypes.SELECT});
    //     emails[i].attachments = attachments;
    // }
    return {emails,totalCount:totalCount[0].totalCount};
}



module.exports = {
    create,
    createAttachment,
    getEmails
}