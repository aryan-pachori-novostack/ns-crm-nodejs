exports.reportsBaseUrl = process.env.REPORT_BASE_URL || "https://ruloans-dev-crm.racecondition.io/api/reports/";;
// "viewed" intentionally has no entry: it maps to the same approval_status (1) as
// "created", so there's no actual NS-side state change to push for it — calling NS
// on every "viewed" webhook would be a pure no-op round trip.
exports.NSInvoiceStatusJson = { "completed": 2, "declined": 3, "created": 1 };
exports.OpenSignApiKey = process.env.OPEN_SIGN_API_KEY ? process.env.OPEN_SIGN_API_KEY : 'opensign.ZBRgyUf6ZgslYfMKAXixz';
exports.KAFKA_TOPIC_INSTANT_CLAIM = process.env.KAFKA_TOPIC_INSTANT_CLAIM;
exports.KAFKA_INSTANT_CLAIM_GROUP_ID = process.env.KAFKA_INSTANT_CLAIM_GROUP_ID;
exports.SMPT_DIGISIGN = process.env.SMTP_USER || "digisign@ruloans.com";
exports.SMPT_DIGISIGN_PASSWORD = process.env.SMPT_PASSWORD || "Digi@0525";
exports.KAFKA_TOPIC_DSA_BUSINESS_STARTED = process.env.KAFKA_TOPIC_DSA_BUSINESS_STARTED || "handle_dsa_business_started";
exports.KAFKA_TOPIC_VENDOR_SNAPSHOT = process.env.KAFKA_TOPIC_VENDOR_SNAPSHOT || "vendor_snapshot_events";
exports.SMPT_PORT_2 = process.env.SMPT_PORT_2 || 587;
exports.SMPT_PASSWORD_2 = process.env.SMPT_PASSWORD_2;
exports.SMTP_USER_2 = process.env.SMTP_USER_2 || "emailapikey";
exports.SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL;
exports.SMPT_HOST = process.env.SMPT_HOST;
exports.SAME_DAY_BILLING_TIME = process.env.SAME_DAY_BILLING_TIME || 15
exports.MAX_DISB_DATE_INTERVAL = process.env.MAX_DISB_DATE_INTERVAL || 365;


exports.B2B_URL = process.env.B2B_URL || "https://ruconnect.ruloans.com";
exports.SENTRY_DSN = process.env.SENTRY_DSN || "https://8d46e71a6c110f99a778960f2027c5a2@o4510142678630400.ingest.us.sentry.io/4510153830694912"
exports.ADMIN_CLASS_ID = process.env.ADMIN_CLASS_ID || "111";
exports.RULOANS_HO_ID = process.env.RULOANS_HO_ID || "72609211";

// AuthBridge API Configuration
exports.AUTHBRIDGE_API_URL = process.env.AUTHBRIDGE_API_URL;
exports.AUTHBRIDGE_API_KEY = process.env.AUTHBRIDGE_API_KEY;
exports.AUTHBRIDGE_DOC_TYPE_PAN = parseInt(process.env.AUTHBRIDGE_DOC_TYPE_PAN) || 367;
exports.BACKEND_ACCESS_ROLES = process.env.BACKEND_ACCESS_ROLES || "SALES_ADMIN,LEAD_ADMIN,Finance - Claim & Invoice";
exports.SALES_ACCESS_ROLES = process.env.SALES_ACCESS_ROLES || "SALES_ADMIN";

// Netsuite product IDs (comma-separated) for which banker confirmation mails must be disabled.
// PIL = 206, BIL = 215 (and any sub-products whose parent_product_id is one of these).
exports.DISABLE_CONFIRMATION_MAILS_PRODUCT_ID = process.env.DISABLE_CONFIRMATION_MAILS_PRODUCT_ID || "206,215";
exports.SYSTEM_BOT_UUID = process.env.SYSTEM_BOT_UUID || "489e2c22-329e-450e-a1e6-d06346caf5a4";
exports.SYSTEM_BOT_USER_EMAIL = process.env.SYSTEM_BOT_USER_EMAIL || "system-bot@ruloans.com";

/** Business category ID for in-house leads (locked payout: type Rate, rate 0). */
exports.inHouseCategory = 20;

