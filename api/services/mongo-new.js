require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');
const { logger } = require('../helpers/logger');

let client;
let db;

/**
 * Indexes for generic `drafts` collection.
 * Optional TTL: set MONGO_DRAFT_TTL_SECONDS (e.g. 7776000 for 90 days after updated_at) to enable auto-expiry.
 */
async function ensureDraftIndexes(database) {
    const collection = database.collection('drafts');
    await collection.createIndexes([
        {
            key: { user_id: 1, module: 1, updated_at: -1 },
            name: 'drafts_user_id_module_updated_at',
        },
        {
            key: { user_id: 1, module: 1, draft_id: 1 },
            name: 'drafts_user_id_module_draft_id',
            unique: true,
        },
    ]);

    // const ttlSeconds = parseInt(process.env.MONGO_DRAFT_TTL_SECONDS || '', 10);
    // Enable this if you want to delete the Draft after the time period
    // const ttlSeconds = 60 * 60 * 24 * 30;
    const ttlSeconds = '';
    if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
        await collection.createIndex(
            { updated_at: 1 },
            { name: 'drafts_ttl_updated_at', expireAfterSeconds: ttlSeconds }
        );
        logger.info(`MongoDB drafts TTL index: expireAfterSeconds=${ttlSeconds}`);
    }
}

const connectToMongoDB = async (connect = true) => {
    if (!connect) {
        client.close();
        global.db = null;
        return;
    };

    if (db) {
        logger.info('Already connected to MongoDB');
        return db;
    };
    const uri = process.env.MONGO_MIS_URI;
    const dbName = process.env.MONGO_MIS_DB_NAME;

    try {
        client = new MongoClient(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: false,
        });
        await client.connect();
        db = client.db(dbName);
        global.db = db;
        await ensureDraftIndexes(db);
        return db;
    } catch (err) {
        logger.error('Error connecting to MongoDB', err);
        throw err;
    }
};

module.exports = connectToMongoDB;


