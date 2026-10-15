const axios = require("axios");
const { MS_URL, AUTH_KEY_RULOANS_BANK_CLAIM } = require("../../FinanceConfig");

async function erpSubmitFreshLeads(freshLeadIdArray, { isGetError = 1 } = {}) {
    const response = await axios.post(
        `${MS_URL}/api/fresh-lead/erp-submit`,
        { freshLeadIdArray, isGetError },
        {
            headers: {
                'api-key': AUTH_KEY_RULOANS_BANK_CLAIM,
                'device-type': '1',
                'Content-Type': 'application/json'
            }
        }
    );

    const { status, message, data } = response?.data || {};

    return { status, message, data, raw: response };
}

module.exports = {
    erpSubmitFreshLeads
};

