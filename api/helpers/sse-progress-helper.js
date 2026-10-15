/**
 * Server-Sent Events (SSE) Progress Helper
 * Provides reusable functions for tracking progress of chunked/looped operations via SSE
 */

/**
 * Setup SSE headers and send initial connection message
 * @param {Object} res - Express response object
 * @param {Object} options - Configuration options
 * @returns {Object} - Object with helper functions and cleanup
 */
const setupSSE = (res, options = {}) => {
    const {
        corsOrigin = '*',
        heartbeatInterval = 30000, // 30 seconds
        enableHeartbeat = true
    } = options;

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);

    let heartbeatTimer = null;

    // Send initial connection message
    sendSSEMessage(res, 'connected', {
        message: 'Connection established',
        timestamp: new Date().toISOString()
    });

    // Set up heartbeat to keep connection alive
    if (enableHeartbeat) {
        heartbeatTimer = setInterval(() => {
            try {
                sendSSEMessage(res, 'heartbeat', {
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                if (heartbeatTimer) clearInterval(heartbeatTimer);
            }
        }, heartbeatInterval);
    }

    // Cleanup function
    const cleanup = () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    };

    return {
        sendMessage: (event, data) => sendSSEMessage(res, event, data),
        sendProgress: (step, message, progress, extraData = {}) => {
            sendSSEMessage(res, 'progress', {
                step,
                message,
                progress,
                ...extraData
            });
        },
        sendComplete: (status, message, data = {}) => {
            cleanup();
            sendSSEMessage(res, 'complete', {
                status,
                message,
                ...data
            });
            res.end();
        },
        sendError: (message, error = null, data = {}) => {
            cleanup();
            sendSSEMessage(res, 'error', {
                status: false,
                message,
                error: error?.message || error,
                ...data
            });
            res.end();
        },
        cleanup,
        end: () => {
            cleanup();
            res.end();
        }
    };
};

/**
 * Send SSE message in proper format
 * @param {Object} res - Express response object
 * @param {String} event - Event type
 * @param {Object} data - Data to send
 */
const sendSSEMessage = (res, event, data) => {
    try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
        // Connection might be closed
        console.error('SSE write error:', err);
        throw err;
    }
};

/**
 * Process items in chunks with progress tracking via SSE
 * @param {Object} options - Configuration options
 * @param {Array} items - Array of items to process
 * @param {Function} processor - Async function to process each item (item, index, total) => Promise<{success: boolean, data?: any, error?: string}>
 * @param {Object} sseHelpers - SSE helper object from setupSSE
 * @param {Object} progressOptions - Progress tracking options
 * @returns {Promise<Object>} - Results object with success, errors, and data
 */
const processWithProgress = async (options = {}) => {
    const {
        items = [],
        processor,
        sseHelpers,
        progressOptions = {}
    } = options;

    const {
        chunkSize = 1,
        startProgress = 0,
        endProgress = 100,
        stepName = 'Processing',
        onChunkComplete = null,
        onItemComplete = null
    } = progressOptions;

    if (!Array.isArray(items) || items.length === 0) {
        return {
            success: true,
            processed: 0,
            errors: [],
            results: []
        };
    }

    const totalItems = items.length;
    const totalChunks = Math.ceil(totalItems / chunkSize);
    const progressRange = endProgress - startProgress;
    const progressPerChunk = progressRange / totalChunks;

    const results = [];
    const errors = [];
    let processed = 0;

    // Send initial progress
    sseHelpers.sendProgress(1, `${stepName}: Starting...`, startProgress, {
        totalItems,
        totalChunks
    });

    try {
        // Process in chunks
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const startIndex = chunkIndex * chunkSize;
            const endIndex = Math.min(startIndex + chunkSize, totalItems);
            const chunk = items.slice(startIndex, endIndex);

            // Process each item in the chunk
            for (let i = 0; i < chunk.length; i++) {
                const item = chunk[i];
                const itemIndex = startIndex + i;

                try {
                    const result = await processor(item, itemIndex, totalItems);
                    
                    if (result && result.success !== false) {
                        results.push({
                            item,
                            index: itemIndex,
                            data: result.data || result
                        });
                        processed++;
                    } else {
                        errors.push({
                            item,
                            index: itemIndex,
                            error: result?.error || 'Processing failed'
                        });
                    }

                    // Call item completion callback
                    if (onItemComplete) {
                        await onItemComplete(item, itemIndex, result, totalItems);
                    }
                } catch (error) {
                    errors.push({
                        item,
                        index: itemIndex,
                        error: error.message || 'Unknown error'
                    });
                }
            }

            // Calculate progress
            const currentProgress = Math.min(
                startProgress + (chunkIndex + 1) * progressPerChunk,
                endProgress
            );

            // Send progress update
            sseHelpers.sendProgress(
                chunkIndex + 1,
                `${stepName}: Processed ${processed}/${totalItems} items`,
                Math.round(currentProgress),
                {
                    processed,
                    totalItems,
                    errors: errors.length,
                    currentChunk: chunkIndex + 1,
                    totalChunks
                }
            );

            // Call chunk completion callback
            if (onChunkComplete) {
                await onChunkComplete(chunk, chunkIndex, processed, totalItems);
            }
        }

        return {
            success: errors.length === 0,
            processed,
            errors,
            results
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Process items in a loop with progress tracking (simpler version for sequential processing)
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Results object
 */
const processLoopWithProgress = async (options = {}) => {
    const {
        items = [],
        processor,
        sseHelpers,
        progressOptions = {}
    } = options;

    const {
        startProgress = 0,
        endProgress = 100,
        stepName = 'Processing',
        onItemComplete = null
    } = progressOptions;

    if (!Array.isArray(items) || items.length === 0) {
        return {
            success: true,
            processed: 0,
            errors: [],
            results: []
        };
    }

    const totalItems = items.length;
    const progressRange = endProgress - startProgress;
    const progressPerItem = progressRange / totalItems;

    const results = [];
    const errors = [];
    let processed = 0;

    // Send initial progress
    sseHelpers.sendProgress(1, `${stepName}: Starting...`, startProgress, {
        totalItems
    });

    try {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            try {
                const result = await processor(item, i, totalItems);

                if (result && result.success !== false) {
                    results.push({
                        item,
                        index: i,
                        data: result.data || result
                    });
                    processed++;
                } else {
                    errors.push({
                        item,
                        index: i,
                        error: result?.error || 'Processing failed'
                    });
                }

                // Call item completion callback
                if (onItemComplete) {
                    await onItemComplete(item, i, result, totalItems);
                }
            } catch (error) {
                errors.push({
                    item,
                    index: i,
                    error: error.message || 'Unknown error'
                });
            }

            // Calculate and send progress
            const currentProgress = Math.min(
                startProgress + (i + 1) * progressPerItem,
                endProgress
            );

            sseHelpers.sendProgress(
                i + 1,
                `${stepName}: Processed ${processed}/${totalItems} items`,
                Math.round(currentProgress),
                {
                    processed,
                    totalItems,
                    errors: errors.length,
                    currentIndex: i + 1
                }
            );
        }

        return {
            success: errors.length === 0,
            processed,
            errors,
            results
        };
    } catch (error) {
        throw error;
    }
};

module.exports = {
    setupSSE,
    sendSSEMessage,
    processWithProgress,
    processLoopWithProgress
};
