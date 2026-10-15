const { logger } = require("../../api/helpers/logger");
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");
const { sequelize, _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
let uuid = require('node-uuid');
const { createIfNotExist } = require("../../api/services/picklist-values-services");

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.FROM_EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

const sendEmail = function (emailBody, isHtml) {
    let mailOptions;
    if (isHtml) {
        mailOptions = {
            from: process.env.FROM_EMAIL,
            to: emailBody.to,
            subject: emailBody.subject,
            html: emailBody.body
        };
        console.log(mailOptions)
    } else {
        mailOptions = {
            from: process.env.FROM_EMAIL,
            to: emailBody.to,
            subject: emailBody.subject,
            text: emailBody.body
        };

    }
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
        } else {
            logger.info('Email sent: ' + info.response);
            console.log('Email sent: ' + info.response);
        }
    });
}

module.exports = async function (job) {
    try {
        let bindParams = [false, 5];
        let query = ` select * from ru_direct_selling_agents where is_user_created =? and signup_steps_completed >=5 `;
        let dsaUsers = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        query = ' SELECT BIN_TO_UUID(u.id) as id ,u.otpCreatedAt as otpCreatedAt,u.status as status,s.name as statusName,u.isDeleted as isDeleted ,u.tokenUpdatedAt as tokenUpdatedAt,u.password as password,u.name as userName,u.email as userEmail,u.otp as otp,u.dummyPassword as dummyPassword,u.phone as userPhone,r.role as role ,p.name as parentName, p.email as parentEmail, c.name as creatorName , c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  left join status s on u.status = s.id where r.role = ? ';
        bindParams = ['CEO'];
        let ceoUser = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        ceoUser = ceoUser[0];

        query = `select bin_to_uuid(r.id) as id , r.role as role from roles r where r.role = ? `;
        bindParams = ['NEW_USER'];
        let userRole = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        userRole = userRole[0].id;
        if (!ceoUser) return;
        else {
            for (let i = 0; i < dsaUsers.length; i++) {
                query = ` select * from users where phone = ?  or email = ? `;
                bindParams = [dsaUsers[i].dsa_mobile_number, dsaUsers[i].email_address];
                let userExist = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
                userExist = userExist[0];
                if (!userExist) {
                    let rawPassword = 'Hello@123';
                    let password = await bcrypt.hash(rawPassword, 10);
                    query = `insert into users(id,email,name,role,phone,password,createdBy,parent,createdAt,updatedAt) values(uuid_to_bin(?),?,?,uuid_to_bin(?),?,?,uuid_to_bin(?),uuid_to_bin(?),now(),now()) `
                    bindParams = [uuid.v4(), dsaUsers[i].email_address, dsaUsers[i].full_name, userRole, dsaUsers[i].dsa_mobile_number, password, ceoUser.id, ceoUser.id]
                    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
                    query = ` update ru_direct_selling_agents set is_user_created = ? where dsa_id = ? `;
                    bindParams = [true, dsaUsers[i].dsa_id];
                    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
                    // await sendEmail({to:dsaUsers[i].email_address,subject:'User Created For CRM',body:` CRM User has been Created for Your email address as you completed 83% on the sign Up Process. Password to login is ${rawPassword}. Please change it once you login. `})
                } else {
                    query = ` update ru_direct_selling_agents set is_user_created = ? where dsa_id = ? `;
                    bindParams = [true, dsaUsers[i].dsa_id];
                    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
                }
            }
            // let lead_status = await createIfNotExist("Lead status", "Cold", "Leads");
            // query = ` update leads set status = ?, status_updated_at = ? where status is null `;
            // bindParams = [lead_status, new Date()];
            // await sequelize.query(query, {replacements: bindParams, type: QueryTypes.UPDATE });

            let dsa_status = await createIfNotExist("Status", "Cold", "Customer");
            query = ` update ru_direct_selling_agents set dsa_status = ?, dsa_status_updated_at = ? where dsa_status is null or dsa_status = "New" `;
            bindParams = [dsa_status, new Date()];
            await _db2.query(query, {replacements: bindParams, type: QueryTypes.UPDATE });
        }
    } catch (e) {
        console.log(e)
    }
};

