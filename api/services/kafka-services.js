const { QueryTypes } = require("sequelize");
const { jsonDifferenceForNestedObjects } = require("../helpers/commonhelper");
const { KAFKA_TOPIC_INSTANT_CLAIM, KAFKA_TOPIC_DSA_BUSINESS_STARTED, KAFKA_TOPIC_VENDOR_SNAPSHOT } = require("../helpers/constantdata/config");
const { logger } = require("../helpers/logger");

exports.connectKafkaProducer = async () => {
    await global._producer.connect();
};

exports.connectKafkaConsumer = async () => {
    await global._consumer.connect();
}

exports.sendToKafka = async (notification) => {
    console.log('NOTIFICATION STRUCT SENT TO KAFKA', notification);
    return await global._producer.send({
        topic: process.env.KAFKA_TOPIC_PY,
        messages: [{ value: notification.encode() }],
    });
};

exports.sendToKafkaEngine = async (notification) => {
    console.log('NOTIFICATION STRUCT SENT TO KAFKA', notification);
    return await global._producer.send({
        topic: process.env.KAFKA_TOPIC,
        messages: [{ value: notification.encode() }],
    });
};

exports.sendToKafkaLoggerService = async (notification) => {
    console.log('NOTIFICATION STRUCT SENT TO KAFKA', notification);
    return await global._producer.send({
        topic: process.env.KAFKA_TOPIC_LOGGER,
        messages: [{ value: notification.encode() }],
    });
};

/** Sends VendorSnapshotEvent to dedicated vendor snapshot topic (for hierarchy snapshot worker). */
exports.sendToKafkaVendorSnapshot = async (notification) => {
    return await global._producer.send({
        topic: KAFKA_TOPIC_VENDOR_SNAPSHOT,
        messages: [{ value: notification.encode() }],
    });
};

exports.sendBatchToKafka = async (notifications) => {
    if (!Array.isArray(notifications)) {
        throw new Error('Notifications must be an array');
    }

    console.log(`Sending batch of ${notifications.length} notifications to Kafka`);
    return await global._producer.send({
        topic: process.env.KAFKA_TOPIC,
        messages: notifications.map((notification) => ({
            value: notification.encode(),
        })),
    });
};

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
class BaseNotification {
    constructor() {
        this.environment = ENVIRONMENT;
    };

    encode() {
        return Buffer.from(JSON.stringify(this)).toString('base64');
    };

    static decode(encoded) {
        const dicc = JSON.parse(Buffer.from(encoded, 'base64').toString());
        const NotificationClass = notificationClasses[dicc.type]; // Lookup class by name
        if (!NotificationClass) throw new Error(`Unknown notification type: ${dicc.type}`);
        return new NotificationClass(...Object.values(dicc));
    };
};

// Store class references in a dictionary
const notificationClasses = {
    WhatsAppSendNotification: exports.WhatsAppSendNotification,
    EmailSendEmail: exports.EmailSendEmail,
    SendPushNotificationCRM: exports.SendPushNotificationCRM,
    AppNotificationCRM: exports.AppNotificationCRM,
    SMSSendNotification: exports.SMSSendNotification,
    EventLogger: exports.EventLogger,
};
exports.WhatsAppSendNotification = class WhatsAppSendNotification extends BaseNotification {
    constructor(type, filter, templateName, headerParams, bodyParams, buttonParams, logged_in_user_id) {
        super()
        this.type = type
        this.filter = filter
        this.templateName = templateName
        this.headerParams = headerParams
        this.bodyParams = bodyParams
        this.buttonParams = buttonParams
        this.logged_in_user_id = logged_in_user_id

    }
};
exports.EmailSendEmail = class EmailSendEmail extends BaseNotification {

    constructor(type, filter, subject, body, logged_in_user_id) {
        super()
        this.type = type
        this.filter = filter;
        this.subject = subject;
        this.body = body;
        this.logged_in_user_id = logged_in_user_id;

    };
};
exports.SendPushNotificationCRM = class SendPushNotificationCRM extends BaseNotification {

    constructor(type, filter, title, topic, image, link, body, logged_in_user_id) {
        super()
        this.type = type
        this.filter = filter;
        this.title = title;
        this.topic = topic;
        this.image = image;
        this.link = link;
        this.body = body;
        this.logged_in_user_id = logged_in_user_id;

    }
};
exports.AppNotificationCRM = class AppNotificationCRM extends BaseNotification {

    constructor(type, filter, channel, title, body, image, url, logged_in_user_id) {
        super()
        this.type = type
        this.filter = filter;
        this.channel = channel;
        this.title = title;
        this.body = body;
        this.image = image;
        this.url = url;
        this.logged_in_user_id = logged_in_user_id;

    }
};
exports.SMSSendNotification = class SMSSendNotification extends BaseNotification {
    constructor(type, filter, message, dynamic_values, logged_in_user_id) {
        super()
        this.type = type
        this.filter = filter;
        this.message = message;
        this.dynamic_values = dynamic_values;
        this.logged_in_user_id = logged_in_user_id;
    }
};
exports.EventLogger = class EventLogger extends BaseNotification {
    constructor(event, from, to, ref_id, createdBy, createdAt) {
        super()
        this.event = event;
        this.from = from,
            this.to = to,
            this.ref_id = ref_id,
            this.createdBy = createdBy,
            this.createdAt = createdAt
    }
};
exports.EmailSendEmailPayout = class EmailSendEmailPayout extends BaseNotification {
    constructor(nid, to_email, subject, plain_text_content, html_text_content = null, ref_id, createdBy, className) {
        super();
        this.nid = nid
        this.to_email = to_email;
        this.subject = subject;
        this.plain_text_content = plain_text_content;
        this.html_text_content = html_text_content;
        this.ref_id = ref_id
        this.createdBy = createdBy
        this['class'] = className;
    }
};
exports.SMSSendNotificationEngine = class SMSSendNotificationEngine extends BaseNotification {
    constructor(nid, number, message, ref_id, createdBy, className) {
        super();
        this.nid = nid
        this.number = number;
        this.message = message;
        this.ref_id = ref_id;
        this.createdBy = createdBy
        this['class'] = className;
    }
};
exports.SendPayoutNotificationCRM = class SendPayoutNotificationCRM extends BaseNotification {
    constructor(nid, email, title, topic, image, link, body, ref_id, createdBy, className) {
        super();
        this.nid = nid
        this.email = email;
        this.title = title;
        this.topic = topic;
        this.image = image;
        this.link = link;
        this.body = body;
        this.ref_id = ref_id;
        this.createdBy = createdBy
        this['class'] = className;
    }
};
exports.ReassignDsaCRM = class ReassignDsaCRM extends BaseNotification {
    constructor(url, method, body, header, className) {
        super();
        this.url = url;
        this.method = method;
        this.body = body;
        this.header = header;
        this['class'] = className;
    }
};

/** For vendor hierarchy snapshot worker: action + dsa_id + changes. Use in try/catch so API never fails on Kafka. */
exports.VendorSnapshotEvent = class VendorSnapshotEvent extends BaseNotification {
    constructor(action, dsa_id, changes = {}, triggered_by = null) {
        super();
        this.type = 'VendorSnapshotEvent';
        this.action = action;
        this.dsa_id = dsa_id;
        this.changes = changes;
        this.triggered_by = triggered_by;
        this.occurred_at = new Date().toISOString();
    }
};

exports.createActivityLogKafka = async (data) => {
    let { old_data, new_data, log_type, application_id, created_by, crm_user } = data;
    if (crm_user) {
        let query = ` select * from ru_direct_selling_agents where dsa_mobile_number = ? `;
        let dsa = await _db2.query(query, { replacements: [crm_user?.userPhone], type: QueryTypes.SELECT });
        dsa = dsa[0];
    };

    let diff = jsonDifferenceForNestedObjects(old_data, new_data);
    let fromDetails = {};
    let toDetails = {};

    diff.forEach(([key, oldValue, newValue]) => {
        fromDetails[key] = oldValue;
        toDetails[key] = newValue;
    });

    await this.connectKafkaProducer();
    const logs = new this.EventLogger(
        log_type,
        JSON.stringify(fromDetails),
        JSON.stringify(toDetails),
        application_id,
        created_by,
        new Date(),
    );
    await this.sendToKafkaLoggerService(logs);
};


exports.sendToInstantClaimKafka = async (payload) => {
    await this.connectKafkaProducer();
    await global._producer.send({
        topic: KAFKA_TOPIC_INSTANT_CLAIM,
        messages: [{ value: JSON.stringify(payload) }]
    });
}
exports.InvoiceSignTrigger = class InvoiceSignTrigger extends BaseNotification {
    constructor(type,invoice_ids, createdBy, className) {
        super();
        this.type = type
        this.invoice_ids = invoice_ids;
        this.createdBy = createdBy;
        this['class'] = className;
    }
};

exports.sendToInstantClaimKafka = async (payload) => {
    await this.connectKafkaProducer();
    await global._producer.send({
        topic: KAFKA_TOPIC_INSTANT_CLAIM,
        messages: [{ value: JSON.stringify(payload) }]
    });
}

class DsaBusinessStartedPayload {
    constructor(payload) {
        const { mode, date, dsa_id, api_path, form_type } = payload;
        //const validModes = ['manual', 'online', 'offline'];
        const validModes = ['offline', 'manual'];

        if (!validModes.includes(mode)) {
            throw new Error(`[${api_path || 'unknown-path'}:${form_type || 'unknown-form'}] Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
        }
        if (!date || !dsa_id) {
            throw new Error(`[${api_path || 'unknown-path'}:${form_type || 'unknown-form'}] date and dsa_id are required fields`);
        }

        this.mode = mode;
        this.date = date;
        this.dsa_id = dsa_id;
    }
}

exports.handleDsaBusinessStarted = async (payload) => {
    try {
          console.log({ topic: KAFKA_TOPIC_DSA_BUSINESS_STARTED})
        await this.connectKafkaProducer();
        const validatedPayload = new DsaBusinessStartedPayload(payload);
        await global._producer.send({
            topic: KAFKA_TOPIC_DSA_BUSINESS_STARTED,
            messages: [{ value: JSON.stringify(validatedPayload) }]
        });

        logger.info(`DSA Business Started event sent successfully for dsa_id: ${payload.dsa_id}`);

    } catch (error) {
        console.log(error);
        logger.error(`Kafka Error [${payload?.api_path || 'unknown-path'}:${payload?.form_type || 'unknown-form'}]:`, {
            error: error.message,
            payload: payload,
            timestamp: new Date().toISOString()
        });
    }
}
