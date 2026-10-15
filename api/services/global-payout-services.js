const { verify } = require('crypto');
const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { all } = require('bluebird');

const createPayouts = async (data) => {
    let query = `insert into payouts( bank_name, short_name,avg_achievment, product,registered_on_company_name, main_product, sub_product, product_group, agreement_expired_by,  enrollment_date, billing_mode, login_code, address,  max_payout, billing_date_from, billing_date_to, applicable_from, applicable_to,  remarks, type, type_of_payout, company_category, billing_cycle, payment_term, minimum_pf, minimum_irr, minimum_insurance, link) values ( ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? ) `;
    let bindParams = [data.bank_name, data.short_name, data.avg_achievement, data.product, data.registered_on_company_name, data.main_product, data.sub_product, data.product_group, data.agreement_expired_by, data.enrollment_date, data.billing_mode, data.login_code, data.address, data.max_payout, data.billing_date_from, data.billing_date_to, data.applicable_from, data.applicable_to, data.remarks, data.type, data.type_of_payout, data.company_category, data.billing_cycle, data.payment_term, data.minimum_pf, data.minimum_irr, data.minimum_insurance, data.link];
    let payouts = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    query = ` select * from payouts where bank_name = ? and status = 'Active' order by id desc limit 1`;
    bindParams = [data.bank_name];
    payouts = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return payouts[0];
}

const findGlobalPayoutsId = async (id) => {
    let query = ` select * from payouts where id = (?) and status = 'Active' `;
    let bindParams = [id];
    let find_global_payouts = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    if (find_global_payouts[0]) {
        let slabQuery = ` select rate, id, disb_amount_from, disb_amount_to from payout_slabs where payout_id = ? `;
        bindParams = [find_global_payouts[0].id];
        let slabs = await sequelize.query(slabQuery, { replacements: bindParams, type: QueryTypes.SELECT });
        find_global_payouts[0].payout_slabs = slabs;
    }
    return find_global_payouts[0] ? find_global_payouts[0] : null;
}

const updatePayouts = async (id, data) => {
    let { bank_name, short_name, avg_achievement, product, registered_on_company_name, main_product, sub_product, product_group, agreement_expired_by, enrollment_date, billing_mode, login_code, address, max_payout, billing_date_from, billing_date_to, applicable_from, applicable_to, remarks, type, type_of_payout, company_category, billing_cycle, payment_term, minimum_pf, minimum_irr, minimum_insurance, link,bank_id, product_id } = data;
    let query = ` update payouts set bank_name = ?,  short_name=?,avg_achievment=?,product =?,registered_on_company_name = ?, main_product = ?, sub_product = ?, product_group = ?, agreement_expired_by = ?,  enrollment_date = ?, billing_mode = ?, login_code = ?, address = ?,  max_payout = ?, billing_date_from = ?, billing_date_to = ?, applicable_from = ?, applicable_to = ?,  remarks = ?, type = ?, type_of_payout = ?, company_category = ?, billing_cycle = ?, payment_term = ?, minimum_pf = ?, minimum_irr = ?, minimum_insurance = ?, link = ?, bank_id =?, product_id = ? where id = ?`;
    let bindParams = [bank_name, short_name, avg_achievement, product, registered_on_company_name, main_product, sub_product, product_group, agreement_expired_by, enrollment_date, billing_mode, login_code, address, max_payout, billing_date_from, billing_date_to, applicable_from, applicable_to, remarks, type, type_of_payout, company_category, billing_cycle, payment_term, minimum_pf, minimum_irr, minimum_insurance, link, bank_id, product_id,id]
    let update = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return update;
}

const getAllPayouts = async (offset, limit, where, search) => {
    let bindParams = [];
    let query = ` SELECT * FROM payouts p  ` ;
    let queryCount = ` SELECT count(*) as totalCount  FROM  payouts p  `;
    let and = false;
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
            if (where[i][2] || where[i][2] === 0) {
                query += where[i][0] + where[i][1] + ' ? ';
                queryCount += where[i][0] + where[i][1] + ' ? ';
                bindParams.push(where[i][2]);
            } else {
                query += where[i][0] + where[i][1] + ' ';
                queryCount += where[i][0] + where[i][1] + '  ';
            }
        }
    }
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += `order by bank_name desc `
    query += ` limit ${offset},${limit} `;
    let allPayouts = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    let payoutIds  = [];
    for(let i=0;i<allPayouts.length;i++){
        allPayouts[i].slabs = [];
        payoutIds.push(allPayouts[i].id)
    }
    if(payoutIds.length==0) return { users: allPayouts, totalCount: totalCount[0].totalCount };
    let slabQuery = ` select * from payout_slabs where payout_id in (?) `;
    bindParams = [payoutIds];
    let slabs = await sequelize.query(slabQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    for(let i=0;i<allPayouts.length;i++){
        for(let j=0;j<slabs.length;j++){
            if(allPayouts[i].id == slabs[j].payout_id){
                allPayouts[i].slabs.push(slabs[j]);
            }
        }
    }
    // for(let i=0;i<allPayouts.length;i++){
    //     let slabQuery = ` select * from payout_slabs where payout_id = ? `;
    //     bindParams = [allPayouts[i].id];
    //     let slabs = await sequelize.query(slabQuery, { replacements: bindParams, type: QueryTypes.SELECT });
    //     allPayouts[i].slabs = slabs;
    // }
    return { users: allPayouts, totalCount: totalCount[0].totalCount };
}

const deletePayouts = async (id) => {
    let query = ` delete from  payouts  where id = ? `;
    let bindParams = [id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    query = ` delete from payout_slabs where payout_id  = ?`;
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
}

const deleteAllPayouts = async () => {
    let query = ` truncate  payouts `;
    await sequelize.query(query, { type: QueryTypes.DELETE });
    query = ` truncate payout_slabs `;
    await sequelize.query(query, { type: QueryTypes.DELETE });

    query = `alter table payouts auto_increment = 1`
    await sequelize.query(query, { type: QueryTypes.DELETE });
    query = `alter table payout_slabs auto_increment = 1`
    await sequelize.query(query, { type: QueryTypes.DELETE });
}

const createPayoutSlab = async (id, rate, disb_amount_from, disb_amount_to) => {
    let query = `insert into payout_slabs( payout_id,rate,disb_amount_from,disb_amount_to) values ( ?,?,?,? ) `;
    let bindParams = [id, rate, disb_amount_from, disb_amount_to];
    let payouts = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
}
const updatePayoutSlab = async (id, rate, disb_amount_from, disb_amount_to) => {
    let query = `update payout_slabs set rate=?,disb_amount_from=?,disb_amount_to=?  where id = ?`;
    let bindParams = [rate, disb_amount_from, disb_amount_to, id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}
const findGlobalPayoutByBankName = async (bank_name,product_name) => {
    let query = `SELECT * from payouts pl  where bank_name = ? and product = ? `;
    let bindParams = [bank_name,product_name];
    let payouts = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return payouts[0];
}
module.exports = {
    createPayouts,
    findGlobalPayoutsId,
    updatePayouts,
    getAllPayouts,
    deletePayouts,
    createPayoutSlab,
    updatePayoutSlab,
    deleteAllPayouts,
    findGlobalPayoutByBankName
}