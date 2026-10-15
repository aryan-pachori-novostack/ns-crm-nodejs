exports.reportsBaseUrl = process.env.REPORT_BASE_URL;
// "viewed" intentionally has no entry: it maps to the same approval_status (1) as
// "created", so there's no actual NS-side state change to push for it — calling NS
// on every "viewed" webhook would be a pure no-op round trip.
exports.NSInvoiceStatusJson = { "completed": 2, "declined": 3, "created": 1 };
exports.OpenSignApiKey = process.env.OPEN_SIGN_API_KEY;
exports.KAFKA_TOPIC_INSTANT_CLAIM = process.env.KAFKA_TOPIC_INSTANT_CLAIM;
exports.KAFKA_INSTANT_CLAIM_GROUP_ID = process.env.KAFKA_INSTANT_CLAIM_GROUP_ID;
exports.SMPT_DIGISIGN = process.env.SMTP_USER;
exports.SMPT_DIGISIGN_PASSWORD = process.env.SMPT_PASSWORD;
exports.KAFKA_TOPIC_DSA_BUSINESS_STARTED = process.env.KAFKA_TOPIC_DSA_BUSINESS_STARTED;
exports.KAFKA_TOPIC_VENDOR_SNAPSHOT = process.env.KAFKA_TOPIC_VENDOR_SNAPSHOT;
exports.SMPT_PORT_2 = process.env.SMPT_PORT_2;
exports.SMPT_PASSWORD_2 = process.env.SMPT_PASSWORD_2;
exports.SMTP_USER_2 = process.env.SMTP_USER_2;
exports.SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL;
exports.SMPT_HOST = process.env.SMPT_HOST;
exports.SAME_DAY_BILLING_TIME = process.env.SAME_DAY_BILLING_TIME;
exports.MAX_DISB_DATE_INTERVAL = process.env.MAX_DISB_DATE_INTERVAL;

exports.B2B_URL = process.env.B2B_URL;
exports.SENTRY_DSN = process.env.SENTRY_DSN;
exports.ADMIN_CLASS_ID = process.env.ADMIN_CLASS_ID;
exports.RULOANS_HO_ID = process.env.RULOANS_HO_ID;

// AuthBridge API Configuration
exports.AUTHBRIDGE_API_URL = process.env.AUTHBRIDGE_API_URL;
exports.AUTHBRIDGE_API_KEY = process.env.AUTHBRIDGE_API_KEY;
exports.AUTHBRIDGE_DOC_TYPE_PAN = process.env.AUTHBRIDGE_DOC_TYPE_PAN ? parseInt(process.env.AUTHBRIDGE_DOC_TYPE_PAN) : undefined;
exports.BACKEND_ACCESS_ROLES = process.env.BACKEND_ACCESS_ROLES;
exports.SALES_ACCESS_ROLES = process.env.SALES_ACCESS_ROLES;

// Netsuite product IDs (comma-separated) for which banker confirmation mails must be disabled.
// PIL = 206, BIL = 215 (and any sub-products whose parent_product_id is one of these).
exports.DISABLE_CONFIRMATION_MAILS_PRODUCT_ID = process.env.DISABLE_CONFIRMATION_MAILS_PRODUCT_ID;
exports.SYSTEM_BOT_UUID = process.env.SYSTEM_BOT_UUID;
exports.SYSTEM_BOT_USER_EMAIL = process.env.SYSTEM_BOT_USER_EMAIL;

/** Business category ID for in-house leads (locked payout: type Rate, rate 0). */
exports.inHouseCategory = 20;

