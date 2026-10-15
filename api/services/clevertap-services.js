const axios = require('axios');

// CleverTap configuration
const config = {
    accountId: process.env.CLEVERTAP_ACCOUNT_ID,
    passcode: process.env.CLEVERTAP_PASSCODE,
    region: process.env.CLEVERTAP_REGION || 'in1',
    baseUrl: `https://${process.env.CLEVERTAP_REGION || 'in1'}.api.clevertap.com/1`
};

// Track an event in CleverTap
exports.trackEvent = async (identity, eventName, eventData = {}) => {
    try {
        const payload = {
            d: [{
                identity: identity,
                type: 'event',
                evtName: eventName,
                evtData: eventData
            }]
        };

        return await makeRequest('/upload', payload, eventName);
    } catch (error) {
        console.error(`CleverTap API Error (trackEvent):`, error);
        return null;
    }
};

// Update user profile in CleverTap
exports.updateUserProfile = async (identity, profileData) => {
    try {
        const payload = {
            d: [{
                identity: identity,
                type: 'profile',
                profileData: profileData
            }]
        };
        return await makeRequest('/upload', payload, 'profile');
    } catch (error) {
        console.error(`CleverTap API Error (updateUserProfile):`, error);
        return null;
    }
};

// Make HTTP request to CleverTap API
const makeRequest = async (endpoint, payload, context) => {
    try {
        const headers = {
            'X-CleverTap-Account-Id': config.accountId,
            'X-CleverTap-Passcode': config.passcode,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${config.baseUrl}${endpoint}`, payload, { headers });
        
        if (!response.data) {
            console.error(`CleverTap API Error (${context}): Request failed`, {
                payload: payload
            });
            return null;
        }

        return response.data;
    } catch (error) {
        console.error(`CleverTap API Error (${context}):`, error, {
            payload: payload
        });
        return null;
    }
};
