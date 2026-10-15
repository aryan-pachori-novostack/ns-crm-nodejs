"use strict";

const DSAService = require("../../../../services/dsa-services");
const { logger } = require("../../../../helpers/logger");

/** RFC5322-style practical check (local@domain.tld); not exhaustive. */
const BASIC_EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const normEmail = (e) => String(e || "").trim().toLowerCase();

function isBasicEmailFormatValid(email) {
    const n = normEmail(email);
    if (!n || n.length > 254) return false;
    return BASIC_EMAIL_REGEX.test(n);
}

function partnerDisplayName(lead) {
    const n = lead?.partner_full_name != null ? String(lead.partner_full_name).trim() : "";
    return n || "Partner";
}

function isCompanyClaim(lead) {
    return String(lead?.user_type || "").toLowerCase() === "company";
}

/** Extra fields for SSE / CRM when claim is company (verify registered_by DSA email). */
function emailGateMeta(lead, otpDsaId) {
    const company = isCompanyClaim(lead);
    const companyName = company && lead?.company_name != null ? String(lead.company_name).trim() : "";
    const registrarName = partnerDisplayName(lead);
    return {
        claimUserType: company ? "company" : "dsa",
        companyName,
        registeredByDsaId: company ? String(lead?.registered_by || otpDsaId || "").trim() : "",
        registrarDsaName: registrarName,
        gateTitle: company
            ? companyName
                ? `${companyName} · Registrar (DSA): ${registrarName}`
                : `Company claim · Registrar (DSA): ${registrarName}`
            : registrarName
    };
}

/**
 * SSE / CRM: stop before PAN; frontend opens modal (partner name, email, Send OTP, Verify, or skip lead).
 * Does not increment summary.errorCount.
 */
function emitPartnerEmailGate({ sse, summary, item, lead, otpDsaId, suggestedEmail, reason, emailStepProgress }) {
    if (!summary.partnerEmailVerifyRequired) {
        summary.partnerEmailVerifyRequired = [];
    }
    const meta = emailGateMeta(lead, otpDsaId);
    const payload = {
        freshLeadId: item.id,
        partnerName: meta.gateTitle,
        dsaIdForOtp: otpDsaId,
        suggestedEmail: suggestedEmail != null ? String(suggestedEmail).trim() : "",
        customerName: lead?.customer_full_name != null ? String(lead.customer_full_name).trim() : "",
        reason,
        ...meta,
        skipLeadHint:
            "To skip partner email check and still send to ERP, include its fresh_lead_id in skipEmailCheckLeadIds on the next Send to ERP request.",
        sendOtpPath: "/v2/dsa/send-dsa-email-verification-otp",
        verifyOtpPath: "/v2/dsa/verify-dsa-email-verification-otp"
    };
    summary.partnerEmailVerifyRequired.push(payload);

    const companyPrefix = meta.claimUserType === "company" ? "Company registrar (DSA) " : "Partner ";
    const reasonLine = {
        missing_email: `${companyPrefix}email missing — enter email, send OTP, verify, then re-run ERP (or skip email check and send).`,
        invalid_format: `${companyPrefix}email format is invalid — correct it, send OTP, verify, then re-run ERP (or skip email check and send).`,
        unverified:
            meta.claimUserType === "company"
                ? "Company claim — verify the registering DSA's email (registered_by) via OTP, then re-run ERP (or skip email check and send)."
                : "Partner email is on file but not verified — send OTP, verify in dialog, then re-run ERP (or skip email check and send)."
    }[reason] || (meta.claimUserType === "company"
        ? "Company claim — registering DSA email verification required before PAN/ERP."
        : "Partner email verification required before PAN/ERP.");

    if (sse) {
        sse.sendMessage("partnerEmailVerifyRequired", {
            ...payload,
            status: "action_required",
            message: reasonLine
        });
        sse.sendMessage("emailVerification", {
            itemId: item.id,
            status: false,
            partnerEmailGate: true,
            email: payload.suggestedEmail,
            reason,
            message: reasonLine,
            canSkip: true,
            ...payload
        });
        if (typeof emailStepProgress === "number") {
            sse.sendProgress(2, `${meta.gateTitle} — ${reasonLine}`, emailStepProgress, {
                partnerEmailGate: true,
                ...payload
            });
        }
    }
}

/**
 * @returns {Promise<boolean>} true → continue to PAN/ERP; false → skip ERP for this lead (summary updated).
 */
async function verifyCustomerEmailForErpLead({
    item,
    leadById,
    summary,
    sse,
    skipEmailVerification,
    skipEmailCheckLeadIds,
    /** When true (SSE CRM flow): do not auto-send OTP or advance; emit partnerEmailVerifyRequired for UI. */
    interactivePartnerEmailGate = false,
    /** Progress 25–59 for this lead’s email step (SSE bar). */
    emailStepProgress
}) {
    if (skipEmailVerification) {
        return true;
    }

    const skipSet = new Set((skipEmailCheckLeadIds || []).map(String));
    if (skipSet.has(String(item.id))) {
        summary.emailSkippedCount = (summary.emailSkippedCount || 0) + 1;
        if (sse) {
            sse.sendMessage("emailVerification", {
                itemId: item.id,
                status: true,
                skippedByUser: true,
                skipEmailCheckForErp: true,
                message: "Partner email check skipped — continuing to PAN/ERP."
            });
        }
        return true;
    }

    const lead = leadById.get(item.id);
    const emailVerifiedFlag = Number(lead?.dsa_is_email_address_verified) || 0;
    /** DSA row — when already verified, continue. */
    if (emailVerifiedFlag === 1) {
        summary.emailVerifiedCount = (summary.emailVerifiedCount || 0) + 1;
        const verifiedMsg = isCompanyClaim(lead)
            ? "Company registrar (DSA) email already verified — continuing to PAN/ERP"
            : "Partner (DSA) email already verified — validation skipped";
        if (sse) {
            sse.sendMessage("emailVerification", {
                itemId: item.id,
                status: true,
                alreadyVerified: true,
                ...emailGateMeta(lead, lead?.dsa_id_for_email_otp),
                message: verifiedMsg
            });
        }
        return true;
    }

    const otpDsaId = lead?.dsa_id_for_email_otp;
    if (!otpDsaId) {
        summary.emailFailedCount = (summary.emailFailedCount || 0) + 1;
        summary.errorCount++;
        summary.notSentToErpArray.push(item.id);
        summary.errorArray.push(
            `Lead ${item.id}: could not resolve partner (DSA) for email verification — check claim dsa_id / company registered_by.`
        );
        if (sse) {
            sse.sendMessage("emailVerification", {
                itemId: item.id,
                status: false,
                reason: "dsa_unresolved",
                message: "Could not resolve DSA for verification OTP",
                canSkip: true
            });
        }
        return false;
    }

    const rawEmail = lead?.dsa_email_address;
    const email = rawEmail != null ? String(rawEmail).trim() : "";

    /** CRM SSE: user must confirm email in UI before PAN — no auto OTP, no PAN in same request. */
    if (interactivePartnerEmailGate) {
        if (!email) {
            emitPartnerEmailGate({
                sse,
                summary,
                item,
                lead,
                otpDsaId,
                suggestedEmail: "",
                reason: "missing_email",
                emailStepProgress
            });
            return false;
        }
        if (!isBasicEmailFormatValid(email)) {
            emitPartnerEmailGate({
                sse,
                summary,
                item,
                lead,
                otpDsaId,
                suggestedEmail: email,
                reason: "invalid_format",
                emailStepProgress
            });
            return false;
        }
        emitPartnerEmailGate({
            sse,
            summary,
            item,
            lead,
            otpDsaId,
            suggestedEmail: email,
            reason: "unverified",
            emailStepProgress
        });
        return false;
    }

    /** Scheduler / non-interactive: prior behavior (hard errors or auto OTP). */
    if (!email) {
        summary.emailFailedCount = (summary.emailFailedCount || 0) + 1;
        summary.errorCount++;
        summary.notSentToErpArray.push(item.id);
        summary.errorArray.push(`Lead ${item.id}: partner (DSA) email is missing — add email on the DSA profile before ERP.`);
        if (sse) {
            sse.sendMessage("emailVerification", {
                itemId: item.id,
                status: false,
                message: "Partner (DSA) email missing",
                canSkip: true
            });
        }
        return false;
    }

    if (!isBasicEmailFormatValid(email)) {
        summary.emailFailedCount = (summary.emailFailedCount || 0) + 1;
        summary.errorCount++;
        summary.notSentToErpArray.push(item.id);
        summary.errorArray.push(`Lead ${item.id}: partner (DSA) email format is invalid (${email})`);
        if (sse) {
            sse.sendMessage("emailVerification", {
                itemId: item.id,
                status: false,
                email,
                reason: "invalid_format",
                message: "Email format failed validation",
                canSkip: true
            });
        }
        return false;
    }

    try {
        const out = await DSAService.sendDsaEmailAddressVerificationOtpForDsa(otpDsaId, email);
        if (!out.ok) {
            summary.emailFailedCount = (summary.emailFailedCount || 0) + 1;
            summary.errorCount++;
            summary.notSentToErpArray.push(item.id);
            const msg = out.message || "Partner email verification (OTP send) failed";
            summary.errorArray.push(`Lead ${item.id}: ${msg}`);
            if (sse) {
                sse.sendMessage("emailVerification", {
                    itemId: item.id,
                    status: false,
                    email,
                    reason: "otp_send",
                    message: msg,
                    canSkip: true
                });
            }
            return false;
        }
        summary.emailVerifiedCount = (summary.emailVerifiedCount || 0) + 1;
        if (sse) {
            sse.sendMessage("emailVerification", {
                itemId: item.id,
                status: true,
                email,
                otpSent: true,
                message: out.message || "Verification OTP sent to partner email (same as /v2/dsa/send-dsa-email-verification-otp)"
            });
        }
        return true;
    } catch (err) {
        logger.error("[leadEmailVerification] sendDsaEmailAddressVerificationOtpForDsa:", err);
        summary.emailFailedCount = (summary.emailFailedCount || 0) + 1;
        summary.errorCount++;
        summary.notSentToErpArray.push(item.id);
        summary.errorArray.push(`Lead ${item.id}: partner email OTP send error`);
        if (sse) {
            sse.sendMessage("emailVerification", {
                itemId: item.id,
                status: false,
                email,
                reason: "otp_send_error",
                message: err.message || "OTP send failed",
                canSkip: true
            });
        }
        return false;
    }
}

function buildLeadByFreshLeadId(leads) {
    const m = new Map();
    for (let i = 0; i < (leads || []).length; i++) {
        const L = leads[i];
        if (L && L.fresh_lead_id != null) m.set(L.fresh_lead_id, L);
    }
    return m;
}

module.exports = {
    verifyCustomerEmailForErpLead,
    buildLeadByFreshLeadId,
    isBasicEmailFormatValid
};
