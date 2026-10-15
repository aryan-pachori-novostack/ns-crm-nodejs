
const { logger } = require("../../api/helpers/logger");
const { _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const { sendPushNotificationHelper } = require("../../api/helpers/commonhelper");
let DSAService = require(_pathconst.ServicesPath.DSAService);

const getNotificationUsers = async (data, isCountOnly) => {
    try {
        let { offset, limit, verificationFilter, cityFilter, stateFilter, partnerNameFilter, pinCodeFilter, signUpStepsFiltersStart, signUpStepsFiltersEnd, userFilter, statusFilter } = data;
        let banks;
        let getDsa;
        let childPhones = null;
        let levelWise = true;

        if (userFilter) {
            getDsa = await DSAService.getDsaByPhone(userFilter);
        } else {
            levelWise = false;
        }

        if (levelWise) {
            if (!getDsa) {
                return { results: [], totalCount: 0 }
            } else {
                let getCurrentChilds = await DSAService.getCurrentChildsWhereIn(getDsa.customer_mobile_number);
                if (!getCurrentChilds.length) {
                    banks = [];
                    return banks;
                }
                childPhones = [];
                let temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
                if (childPhones.length != 0) getCurrentChilds = await DSAService.getCurrentChildsWhereIn(childPhones);
                temp = [];
                for (let i = 0; i < getCurrentChilds.length; i++) {
                    temp.push(getCurrentChilds[i].customer_mobile_number)
                }
                childPhones = childPhones.concat(temp);
            }
        }

        let where = [];
        if (cityFilter) {
            where.push(['c.home_address_city', '=', `${cityFilter}`]);
        }
        if (stateFilter) {
            where.push(['c.home_address_state', '=', `${stateFilter}`]);
        }
        if (pinCodeFilter) {
            where.push(['c.home_address_pincode', '=', `${pinCodeFilter}`]);
        }
        if (partnerNameFilter) {
            if (partnerNameFilter == "Not Assigned") {
                where.push(['p.full_name', ' is null ', null]);
            } else {
                where.push(['p.full_name', ' = ', partnerNameFilter]);
            }
        }
        if (signUpStepsFiltersStart || signUpStepsFiltersEnd) {
            where.push([' c.signup_steps_completed ', ` between ${signUpStepsFiltersStart / 16.666666666} and ${signUpStepsFiltersEnd / 16.666666666} `, null]);
        }
        if (verificationFilter) {
            where.push(['c.dsa_verification_status', '=', `${verificationFilter}`])
        }
        if (statusFilter) {
            if (statusFilter?.toLowerCase() == "not specified") {
                where.push(["pvs.value", ' is null', null]);
            } else {
                where.push(['pvs.value', '=', statusFilter]);
            }
        }

        banks = await DSAService.getNotificationUsers(where, offset, limit, childPhones, isCountOnly);
        return banks;
    }
    catch (e) {
        logger.error(e)
    }
};

module.exports = async function (job) {
    try {
        let { title, body, dsa_mobile, userId, image, url } = job.data;

        /***********Date formating*************/
        let formattedDateTime = new Date().toLocaleString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).replace(/,/g, '').replace(/ /g, '-');
        let datePart = formattedDateTime.split('-');
        let temp = datePart[0];
        datePart[0] = datePart[1];
        datePart[1] = temp;
        datePart = datePart.join('-');

        formattedDateTime = new Date().toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).replace(/,/g, '').replace(/ /g, '-');
        let timePart = formattedDateTime.split('-').join(' ')
        formattedDateTime = datePart + ' ' + timePart;
        const formattedDateTimeIso = new Date().toISOString().replace(/T/, ' ').slice(0, 19);
        /***********Date formating*************/

        const insertLogs = async (dsa_mobile) => {
            let insertQuery;
            let bindParams = [];
            for (let i = 0; i < dsa_mobile?.length; i++) {
                if (i == 0) {
                    insertQuery = ` insert into ru_firebase_notifications (body, title, image, route, sent_to, notification_date, notification_date_iso, created_by) values(?,?,?,?,?,?,?,?) `;
                } else {
                    insertQuery += `, (?,?,?,?,?,?,?,?) `
                }
                bindParams = bindParams.concat([body, title, image || null, url || null, dsa_mobile[i]?.dsa_mobile || null, formattedDateTime, formattedDateTimeIso, userId || null]);
            }
            await _db2.query(insertQuery, { replacements: bindParams, type: QueryTypes.INSERT });
        };

        if (dsa_mobile) {
            let query = ` select firebase_token from ru_direct_selling_agents where dsa_mobile_number = ? `;
            let api_tokens = await _db2.query(query, { replacements: [dsa_mobile], type: QueryTypes.SELECT });
            insertLogs([{ dsa_mobile }]);
            for (let i = 0; i < api_tokens.length; i++) {
                if (api_tokens[i].firebase_token) {
                    await sendPushNotificationHelper(api_tokens[i].firebase_token, title, body, image, url);
                }
            };
        } else {
            let count = await getNotificationUsers(job.data);
            count = count?.totalCount;
            for (let i = 0; i < count; i = i + 200) {
                let api_tokens = await getNotificationUsers({ ...job.data, offset: i, limit: 200 }, false);
                api_tokens = api_tokens?.results;
                insertLogs(api_tokens);
                for (let j = 0; j < api_tokens.length; j++) {
                    if (api_tokens[j].firebase_token) {
                        await sendPushNotificationHelper(api_tokens[j].firebase_token, title, body, image, url);
                    }
                };
            };
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

