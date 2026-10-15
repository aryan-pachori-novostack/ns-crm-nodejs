const DSAService = require("../../../../services/dsa-services");

function buildInitialSummary(errorObj = [], errorMsg = []) {
    return {
        notSentToErpArray: [...errorObj],
        errorArray: [...errorMsg],
        sentToErpArray: [],
        sentToErpClaimIds: [],
        successCount: 0,
        errorCount: errorObj.length,
        panVerifiedCount: 0,
        panFailedCount: 0,
        emailVerifiedCount: 0,
        emailFailedCount: 0,
        emailSkippedCount: 0,
        /** Populated in SSE ERP flow when partner must verify email in UI before PAN (see leadEmailVerification). */
        partnerEmailVerifyRequired: []
    };
}

/**
 * Single-lead AuthBridge PAN check. Mutates `summary` on failure.
 * @returns {Promise<boolean>} `true` if this lead may proceed to ERP submit.
 */
async function verifyPanForErpLead({ item, summary, sse, skipVerification }) {
    if (skipVerification) {
        return true;
    }

    try {
        const panResult = await DSAService.verifyPanViaAuthBridgeV2(item.id);

        const panOk = panResult.status === 1;
        const skippedNonPerson = panOk && panResult.skipped === true;

        if (sse) {
            sse.sendMessage("panVerification", {
                itemId: item.id,
                status: panOk,
                message: panResult.message,
                ...(skippedNonPerson && {
                    skippedAuthBridge: true,
                    panType: panResult.panType,
                    panTypeLabel: panResult.panTypeLabel
                }),
                ...(!panOk && { canSkip: true })
            });
        }

        if (!panOk) {
            summary.panFailedCount++;
            summary.errorCount++;
            summary.notSentToErpArray.push(item.id);
            summary.errorArray.push(sse ? `Lead ${item.id}: PAN verification failed` : ` PAN verification failed`);
            return false;
        }

        summary.panVerifiedCount++;
        return true;
    } catch (panErr) {
        summary.panFailedCount++;
        summary.errorCount++;
        summary.notSentToErpArray.push(item.id);
        summary.errorArray.push(sse ? `Lead ${item.id}: PAN verification error` : `PAN verification error`);
        return false;
    }
}

module.exports = {
    verifyPanForErpLead,
    buildInitialSummary
};
