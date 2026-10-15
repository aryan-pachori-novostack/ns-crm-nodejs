const DSAService = require('../../../services/dsa-services');
const { jsonDifference } = require('../../../helpers/commonhelper');
const { createActivityLogKafka } = require('../../../services/kafka-services');

/**
 * Context Builder Pattern
 * Extracts and flattens request data into a single context object
 *
 * @param {Object} req - Express request object
 * @returns {Object} - Flat context object with all necessary data
 */
const buildPayoutContext = (req) => {
    const {
        bank_product_combinations_id,
        dsa_id,
        payoutLock,
        rate,
        ratio,
        is_autonomous_enabled,
        autonomous_rate,
        autonomous_ratio,
        disb_date_from,
        disb_date_to,
        default_payout_type,
        default_autonomous_payout_type
    } = req.body;

    return {
        bank_product_combinations_id,
        dsa_id,
        payoutLock,
        rate,
        ratio,
        is_autonomous_enabled,
        autonomous_rate,
        autonomous_ratio,
        disb_date_from,
        disb_date_to,
        default_payout_type,
        default_autonomous_payout_type,
        loggedIn_user_id: req?.loggedInUser?.id || req?.dsa?.dsa_id,
        loggedIn_user_full_name: req?.loggedInUser?.userName || req?.dsa?.dsa_full_name,
        platform: req?.loggedInUser?.id ? "crm_id" : "dsa_id",
        DSAService
    };
};

/**
 * Audit Log Handler - Extracted Logic Pattern
 * Creates activity log for payout updates
 * Separated from main controller for single responsibility
 *
 * @param {Object} context - Validation context
 * @param {Object} payout_details - Previous payout details from database
 */
const handlePayoutAuditLog = async (context, payout_details) => {
    const {
        rate,
        ratio,
        payoutLock,
        is_autonomous_enabled,
        autonomous_rate,
        autonomous_ratio,
        disb_date_from,
        disb_date_to,
        loggedIn_user_id,
        loggedIn_user_full_name,
        platform,
        dsa_id
    } = context;

    const prefix = `${payout_details?.bank_name} ${payout_details?.product_name}`;
    const prev_details = {};
    const new_details = {};

    if (rate !== null) {
        prev_details.rate = `${prefix} : rate : ${payout_details?.rate}`;
        new_details.rate = `${prefix} : rate : ${rate}`;
    }
    if (ratio !== null) {
        prev_details.ratio = `${prefix} : ratio : ${payout_details?.ratio}`;
        new_details.ratio = `${prefix} : ratio : ${ratio}`;
    }
    if (payoutLock !== null) {
        prev_details.payoutLock = `${prefix} : payout lock : ${payout_details?.payout_lock ? "true" : "false"}`;
        new_details.payoutLock = `${prefix} : payout lock : ${payoutLock ? "true" : "false"}`;
    }
    if (is_autonomous_enabled) {
        prev_details.autonomous_rate = `${prefix} : autonomous_rate : ${payout_details?.autonomous_rate ?? '-'}`;
        new_details.autonomous_rate = `${prefix} : autonomous_rate : ${autonomous_rate}`;
        prev_details.autonomous_ratio = `${prefix} : autonomous_ratio : ${payout_details?.autonomous_ratio ?? '-'}`;
        new_details.autonomous_ratio = `${prefix} : autonomous_ratio : ${autonomous_ratio}`;
        prev_details.disb_date_from = `${prefix} : disb_date_from : ${payout_details?.disb_date_from ?? '-'}`;
        new_details.disb_date_from = `${prefix} : disb_date_from : ${disb_date_from}`;
        prev_details.disb_date_to = `${prefix} : disb_date_to : ${payout_details?.disb_date_to ?? '-'}`;
        new_details.disb_date_to = `${prefix} : disb_date_to : ${disb_date_to}`;
    }

    const difference = jsonDifference(prev_details, new_details);
    if (Array.isArray(difference) && difference.length) {
        createActivityLogKafka({
            old_data: prev_details,
            new_data: new_details,
            log_type: 'vendor_payout_details',
            application_id: dsa_id,
            created_by: `${loggedIn_user_full_name} || ${platform} : ${loggedIn_user_id}`
        });
    }
};

module.exports = {
    buildPayoutContext,
    handlePayoutAuditLog
};

