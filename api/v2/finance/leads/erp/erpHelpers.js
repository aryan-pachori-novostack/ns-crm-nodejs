const LeadService = require("../../../../services/lead-services");
const BankService = require("../../../../services/bank-services");
const {
    getDsaPartnerAndBusinessHeadDetails,
    getLeadAdminByDsaId
} = require("../../../../services/dsa-services");

const PAN_PROGRESS_START = 25;
const PAN_PROGRESS_END = 59;
const ERP_PROGRESS_START = 60;
const ERP_PROGRESS_END = 95;

function panLeadProgressPercent(index, total) {
    if (total <= 0) return PAN_PROGRESS_START;
    return Math.round(PAN_PROGRESS_START + ((index + 1) / total) * (PAN_PROGRESS_END - PAN_PROGRESS_START));
}

function erpLeadProgressPercent(index, total) {
    if (total <= 0) return ERP_PROGRESS_START;
    return Math.round(ERP_PROGRESS_START + ((index + 1) / total) * (ERP_PROGRESS_END - ERP_PROGRESS_START));
}

/**
 * Centralizes `sse.sendProgress` for the ERP SSE submit flow (validation → PAN → ERP).
 */
class SSEProgressHandler {
    constructor(sse) {
        this.sse = sse;
    }

    validationLeads(leadCount) {
        this.sse.sendProgress(1, "Validating lead IDs...", 10);
        this.sse.sendProgress(1, `Found ${leadCount} leads to process`, 20);
    }

    panAndErpBatchIntro(finalObjLength) {
        this.sse.sendProgress(2, `Partner email, PAN & ERP (${finalObjLength} leads)...`, PAN_PROGRESS_START - 1);
    }

    emailLead(index, total) {
        this.sse.sendProgress(2, `Checking partner (DSA) email ${index + 1}/${total}`, panLeadProgressPercent(index, total));
    }

    panLead(index, total) {
        this.sse.sendProgress(2, `Verifying PAN ${index + 1}/${total}`, panLeadProgressPercent(index, total));
    }

    erpLeadProcessed(index, total, { error = false } = {}) {
        const suffix = error ? " (error)" : "";
        this.sse.sendProgress(
            3,
            `Processed ${index + 1}/${total}${suffix}`,
            erpLeadProgressPercent(index, total)
        );
    }
}

/** Attach vendor payout caps from DSA service onto a lead claim row (row-level ERP state). */
function attachVendorPayoutCapsToRow(result, caps) {
    result._erpVendorPayoutCaps = caps;
}

/**
 * Load matched bank file for a lead: confirmed BF first, then tentative TBF.
 * @param {object} lead - Row with is_bank_file_matched, bank_file_id, is_tentative_matched, tentative_bank_file_id
 * @returns {Promise<object|null>}
 */
async function resolveMatchedBankFileForLead(lead) {
    const isBankFileMatched = Number(lead?.is_bank_file_matched) === 1;
    const isTentativeMatched = Number(lead?.is_tentative_matched) === 1;

    if (isBankFileMatched && lead?.bank_file_id) {
        return BankService.getBankFileDetail(lead.bank_file_id, 0);
    }
    if (isTentativeMatched && lead?.tentative_bank_file_id) {
        return BankService.getBankFileDetail(lead.tentative_bank_file_id, 1);
    }
    return null;
}

/**
 * Suffix for payout limit errors when subvention exists on the matched bank file.
 * @param {string|number|null} subventionPercentage
 * @returns {string}
 */
function formatSubventionPayoutLimitSuffix(subventionPercentage) {
    const amount = Number(subventionPercentage);
    if (!amount || amount <= 0) {
        return "";
    }
    return `, subvention amount in matched bank file ${subventionPercentage}`;
}

async function buildErpSseContext({ req, sse, isMaster = false }) {
    const {
        id: leadIds = [],
        skipVerification = false,
        skipEmailVerification = false,
        skipEmailCheckLeadIds = []
    } = req.body || {};
    if (!leadIds.length) {
        return { noLeads: true, leads: [], errorObj: [], errorMsg: [], finalObj: [] };
    }
    const leads = (await LeadService.getFreshLeadClaimsByIdsForErp(leadIds)) || [];
    if (!isMaster) {
        await Promise.all(
            leads.map(async (lead) => {
                if (!lead) return;
                const bankFile = await resolveMatchedBankFileForLead(lead);
                lead._erpMatchedBankFile = bankFile;
                lead._erpMatchedBankFileSubvention = bankFile?.subvention_percentage ?? null;
            })
        );
    }

    const errorObj = [];
    const errorMsg = [];
    const finalObj = [];

    return {
        req,
        sse,
        leads,
        skipVerification,
        skipEmailVerification,
        skipEmailCheckLeadIds: Array.isArray(skipEmailCheckLeadIds) ? skipEmailCheckLeadIds : [],
        errorObj,
        errorMsg,
        finalObj
    };
}


async function buildAutoErpContext({ req }) {
    const {
        id: leadIds = [],
        skipEmailVerification = false,
        skipEmailCheckLeadIds = []
    } = req?.body || {};

    if (!leadIds.length) {
        return { noLeads: true, leads: [], errorObj: [], errorMsg: [], finalObj: [] };
    }

    const leads = (await LeadService.getFreshLeadClaimsByIdsForErp(leadIds)) || [];
    await Promise.all(
        leads.map(async (lead) => {
            if (!lead) return;
            const bankFile = await resolveMatchedBankFileForLead(lead);
            lead._erpMatchedBankFile = bankFile;
            lead._erpMatchedBankFileSubvention = bankFile?.subvention_percentage ?? null;
        })
    );

    const errorObj = [];
    const errorMsg = [];
    const finalObj = [];

    // Scheduler / external-auth: `loggedInUser` is not set — always non-master (strict payouts, etc.).
    const isMaster = false;

    return {
        req,
        sse: null,
        leads,
        isMaster,
        skipEmailVerification,
        skipEmailCheckLeadIds: Array.isArray(skipEmailCheckLeadIds) ? skipEmailCheckLeadIds : [],
        errorObj,
        errorMsg,
        finalObj
    };
}

/**
 * Returns `onCustomError` for `ErpValidatorPipeline`. The pipeline calls `(error, leadRunContext)`;
 * this closure mutates the root SSE `rootContext` (not the per-lead `{ lead, isMaster, req }` object).
 *
 * @param {object} rootContext - Root ERP handler context (`errorObj`, `errorMsg`, …).
 * @returns {(error: object, leadRunContext: object) => Promise<void>}
 */
function createErpPipelineOnCustomError(rootContext) {
    return async (error, leadRunContext) => {
        const data = error?.data && typeof error.data === "object" ? error.data : {};
        const freshLeadId = data.freshLeadId ?? leadRunContext?.lead?.fresh_lead_id;
        const errorMessage = error?.message || "Validation failed";

        if (!rootContext.errorObj) rootContext.errorObj = [];
        if (!rootContext.errorMsg) rootContext.errorMsg = [];

        rootContext.errorObj.push(freshLeadId);
        rootContext.errorMsg.push(errorMessage);
    };
}

function normalizeErpSubmit({ status, message, data }) {
    const errorMsg = data?.errorArray?.[0] || message;
    const ok = Boolean(status) && !(data?.errorArray?.length);
    return {
        ok,
        message: errorMsg,
        sentIds: data?.sentToErpArray || [],
        errorIds: data?.errorArray || []
    };
}

function groupLeadsByDsa(leads) {
    const map = new Map();
    for (let i = 0; i < (leads || []).length; i++) {
        const lead = leads[i];
        const dsaId = lead?.dsa_id;
        if (dsaId === null || dsaId === undefined) continue;
        if (!map.has(dsaId)) map.set(dsaId, []);
        map.get(dsaId).push(lead);
    }
    return map;
}

async function buildDsaEmailRecipientMap(leads) {
    const grouped = groupLeadsByDsa(leads);
    const dsaIds = [...grouped.keys()];
    if (!dsaIds.length) return new Map();

    const dsaDetails = (await getDsaPartnerAndBusinessHeadDetails(dsaIds)) || [];
    const detailsByDsaId = new Map(dsaDetails.map((r) => [r.dsa_id, r]));

    const leadAdminLookupIds = new Set();
    for (let i = 0; i < dsaDetails.length; i++) {
        const row = dsaDetails[i] || {};
        if (row.dsa_id !== null && row.dsa_id !== undefined) leadAdminLookupIds.add(row.dsa_id);
        if (row.partner_dsa_id !== null && row.partner_dsa_id !== undefined) leadAdminLookupIds.add(row.partner_dsa_id);
        if (row.business_head_dsa_id !== null && row.business_head_dsa_id !== undefined) leadAdminLookupIds.add(row.business_head_dsa_id);
    }

    const leadAdmins = leadAdminLookupIds.size
        ? (await getLeadAdminByDsaId([...leadAdminLookupIds])) || []
        : [];

    const leadAdminEmailsByDsaId = new Map();
    for (let i = 0; i < leadAdmins.length; i++) {
        const row = leadAdmins[i] || {};
        const dsaId = row.dsa_id;
        const email = row.email;
        if (dsaId === null || dsaId === undefined) continue;
        if (!email) continue;
        if (!leadAdminEmailsByDsaId.has(dsaId)) leadAdminEmailsByDsaId.set(dsaId, new Set());
        leadAdminEmailsByDsaId.get(dsaId).add(email);
    }

    const recipientsByRootDsaId = new Map();
    for (let i = 0; i < dsaIds.length; i++) {
        const rootDsaId = dsaIds[i];
        const row = detailsByDsaId.get(rootDsaId) || {};
        const set = new Set();

        if (row.partner_email) set.add(row.partner_email);

        const idsToCollect = [row.dsa_id, row.partner_dsa_id, row.business_head_dsa_id];
        for (let j = 0; j < idsToCollect.length; j++) {
            const id = idsToCollect[j];
            const emails = leadAdminEmailsByDsaId.get(id);
            if (!emails) continue;
            for (const e of emails) set.add(e);
        }

        recipientsByRootDsaId.set(rootDsaId, set);
    }

    return recipientsByRootDsaId;
}

function buildDsaSummary(dsaLeads, globalSummary) {
    const summary = globalSummary && typeof globalSummary === "object" ? globalSummary : {};

    const leadIds = new Set((dsaLeads || []).map((l) => l?.fresh_lead_id).filter((x) => x !== null && x !== undefined));

    const sentToErpArray = (summary.sentToErpArray || []).filter((id) => leadIds.has(id));
    const notSentToErpArray = (summary.notSentToErpArray || []).filter((id) => leadIds.has(id));

    const errorByLeadId = new Map();
    const globalNotSent = summary.notSentToErpArray || [];
    const globalErrors = summary.errorArray || [];
    for (let i = 0; i < globalNotSent.length; i++) {
        if (globalNotSent[i] === null || globalNotSent[i] === undefined) continue;
        errorByLeadId.set(globalNotSent[i], globalErrors[i] || "");
    }
    const errorArray = notSentToErpArray.map((id) => errorByLeadId.get(id) || "");

    return {
        ...summary,
        successCount: sentToErpArray.length,
        errorCount: notSentToErpArray.length,
        sentToErpArray,
        notSentToErpArray,
        errorArray
    };
}

module.exports = {
    attachVendorPayoutCapsToRow,
    resolveMatchedBankFileForLead,
    formatSubventionPayoutLimitSuffix,
    buildErpSseContext,
    buildAutoErpContext,
    createErpPipelineOnCustomError,
    normalizeErpSubmit,
    SSEProgressHandler,
    groupLeadsByDsa,
    buildDsaEmailRecipientMap,
    buildDsaSummary,
    panLeadProgressPercent,
    erpLeadProgressPercent
};
