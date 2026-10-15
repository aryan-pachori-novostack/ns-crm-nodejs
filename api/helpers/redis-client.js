const redis = require('redis');
const bluebird = require('bluebird');
const { logger } = require('./logger');

// Promisify Redis prototypes globally so *Async methods work out of the box
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient(6379, process.env.REDIS_CONNECTION, {
    no_ready_check: true,
    retry_strategy: function (options) {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis connection refused.');
        }
        // Gracefully attempt reconnection, backing off up to 3000ms
        return Math.min(options.attempt * 100, 3000);
    }
});

client.on('error', (err) => {
    logger.error('Redis error: ' + (err ? err.message : 'Unknown error'));
});

client.on('connect', () => {
    logger.info('Connected to Redis successfully.');
});

module.exports = client;
