const Queue = require('bull');
const path = require('path');
const currentPath = __dirname;
const parentPath = path.dirname(currentPath);
global.appRoot = parentPath;
global._pathconst = require('../api/helpers/constantdata/pathconst');
const runWatchProcessor = require('./processors/emailQueueLead');
updateCCApplicationsProcessor = require('./processors/updateCCApplicationsProcessor');
const calculatePayoutForLeadProcessor = require('./processors/calculatePayoutForLead');
const calculatePayoutPercentageBankProductNewProcessor = require('./processors/calculatePayoutPercentageBankProductNew')
const uploadPayoutProcessor = require('./processors/uploadPayout');
const uploadBankProcessor = require('./processors/uploadBank');
const uploadBankFileDataProcessor = require('./processors/uploadBankFileData');
const getDsaUpdatedStepsProcessor = require('./processors/getDsaUpdatedSteps');
const sendNotificationProcessor = require('./processors/sendNotification');
const uploadLeadFormDataProcessor = require("../api/v2/finance/leads/uploadExcel").processUploadLeadFormData;
const uploadInvoiceDataProcessor = require("./processors/uploadInvoiceData");
const uploadAndEditDsaProcessor = require("./processors/uploadAndEditDsa");
const sendDsaExportEmail = require("./processors/sendDsaExportEmail");
const sendMisReportExportEmail = require("./processors/sendMisReportExportEmail");
const getLedgerDataOnEmailJob = require("./processors/getLedgerDataOnEmail");
const getLedgerDataOnEmailJobNew = require("./processors/getLedgerDataOnEmailNew");
const createBulkLog = require('./processors/createBulkLog');
const mergeDsa = require('./processors/mergeDsa');
const approvalReplayProcessor = require('./processors/approvalReplay');
const uploadRmUsersProcessor = require('./processors/uploadRmUsers');
const redisUrl = process.env.REDIS_CONNECTION_WITH_PORT;
const instantClaimKafkaConsumer = require('./processors/instantClaimskafkaConsumer');

const defaultOptions = {
    redis: redisUrl,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true
    }
};

const emailQueueLead = new Queue('Email Queue', defaultOptions);
const cplq = new Queue('Payout For Lead Calculate', defaultOptions);
const cplqn = new Queue('Payout For Lead Calculate New', defaultOptions);
const uploadPayoutQueue = new Queue('Upload Payout Queue', defaultOptions);
const uploadBankQueue = new Queue('Upload Bank Queue', defaultOptions);
const uploadBankFileDataQueue = new Queue('Upload Bank File Data', defaultOptions);
const getDsaUpdatedStepsQueue = new Queue('Get Updated Dsa Queue', defaultOptions);
const uploadLeadFormDataQueue = new Queue('Upload Lead Form Data', defaultOptions);
const uploadInvoiceDataQueue = new Queue('Upload Invoice Data', defaultOptions);
const uploadAndEditDsaQueue = new Queue('Upload and Edit DSA', defaultOptions);
const sendDsaExportEmailQueue = new Queue('Send Dsa Export Email', defaultOptions);
const sendMisReportExportEmailQueue = new Queue('Send Mis Report Export Email', defaultOptions);
const getLedgerDataOnEmail = new Queue('Get Ledger Data', defaultOptions);
const getLedgerDataOnEmailNew = new Queue('Get New Ledger Data', defaultOptions);
const updateCCApplicationsQueue = new Queue('Update CC Application', defaultOptions);
const sendNotificationQueue = new Queue('Send Notification', defaultOptions);
const createBulkLogQueue = new Queue('Create Activity Logs', defaultOptions);
const mergeDsaQueue = new Queue('Merge Dsa Queue', defaultOptions);
const approvalReplayQueue = new Queue('Approval Replay', defaultOptions);

// Add repeatable cron job to run daily at 11:00 PM (23:00)
approvalReplayQueue.add({}, {
    repeat: { cron: '0 21 * * *' }
}).catch(err => {
    console.error('[Bull] Failed to register repeatable approval replay job:', err);
});
const uploadRmUsersQueue = new Queue('Upload RM Users', defaultOptions);


emailQueueLead.process((job) => runWatchProcessor(job));
uploadPayoutQueue.process((job) => uploadPayoutProcessor(job));
uploadBankQueue.process((job) => uploadBankProcessor(job));
uploadBankFileDataQueue.process((job) => uploadBankFileDataProcessor(job));
cplq.process((job) => calculatePayoutForLeadProcessor(job));
cplqn.process((job) => calculatePayoutPercentageBankProductNewProcessor(job));
getDsaUpdatedStepsQueue.process((job) => getDsaUpdatedStepsProcessor(job));
uploadLeadFormDataQueue.process((job) => uploadLeadFormDataProcessor(job));
uploadInvoiceDataQueue.process((job) => uploadInvoiceDataProcessor(job));
uploadAndEditDsaQueue.process((job) => uploadAndEditDsaProcessor(job));
sendDsaExportEmailQueue.process((job) => { sendDsaExportEmail(job) });
sendMisReportExportEmailQueue.process((job) => { sendMisReportExportEmail(job) });
getLedgerDataOnEmail.process((job) => { getLedgerDataOnEmailJob(job) });
getLedgerDataOnEmailNew.process((job) => { getLedgerDataOnEmailJobNew(job) });
updateCCApplicationsQueue.process((job) => { updateCCApplicationsProcessor(job) });
sendNotificationQueue.process((job) => sendNotificationProcessor(job));
createBulkLogQueue.process((job) => { createBulkLog(job) });
mergeDsaQueue.process((job) => { mergeDsa(job) });
approvalReplayQueue.process((job) => approvalReplayProcessor(job));
uploadRmUsersQueue.process((job) => uploadRmUsersProcessor(job));

exportObj = {
    sendNotificationQueue,
    createBulkLogQueue,
    emailQueueLead,
    cplq,
    cplqn,
    uploadPayoutQueue,
    uploadBankQueue,
    uploadBankFileDataQueue,
    getDsaUpdatedStepsQueue,
    uploadLeadFormDataQueue,
    uploadInvoiceDataQueue,
    uploadAndEditDsaQueue,
    sendDsaExportEmailQueue,
    sendMisReportExportEmailQueue,
    getLedgerDataOnEmail,
    getLedgerDataOnEmailNew,
    updateCCApplicationsQueue,
    mergeDsaQueue,
    approvalReplayQueue,
    uploadRmUsersQueue,
};

/**********************************************/
const cleanupInterval = 3600000;
const jobAgeMs = 3600000;

const cleanupQueues = async () => {
    for (const [name, queue] of Object.entries(exportObj)) {
        try {
            await queue.clean(jobAgeMs, 'completed');
            await queue.clean(jobAgeMs, 'failed');
            console.log(`[${new Date().toISOString()}] Cleaned queue: ${name}`);
        } catch (err) {
            console.error(`Error cleaning queue "${name}":`, err);
        }
    }
};

setInterval(cleanupQueues, cleanupInterval);
/**********************************************/


/**********************************************/
instantClaimKafkaConsumer().catch((error) => {
    console.log(error, "log: Filed to connect to kafka Consumer")
});
/**********************************************/

module.exports = exportObj;

