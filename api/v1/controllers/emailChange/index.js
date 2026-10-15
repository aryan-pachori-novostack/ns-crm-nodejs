let ResHelper = require(_pathconst.FilesPath.ResHelper);
let EmailChangeService = require(_pathconst.ServicesPath.EmailChangeService);
let DSAService = require(_pathconst.ServicesPath.DSAService);

/** CEO, BH, Lead Admin — admin DSA email change / resend verification. */
const ADMIN_EMAIL_CHANGE_ROLES = new Set(["CEO", "BUSINESS_HEAD", "LEAD_ADMIN"]);

const normalizeCrmRole = (role) => String(role || "").trim().toUpperCase();

const canAdminChangeDsaEmail = (role) => ADMIN_EMAIL_CHANGE_ROLES.has(normalizeCrmRole(role));

const assertAdminEmailChangeRoleOrRespond = (req, res, instance) => {
    const role = req?.loggedInUser?.role;
    if (!canAdminChangeDsaEmail(role)) {
        ResHelper.apiResponseV2(
            res,
            false,
            "Only CEO, Business Head, or Lead Admin can change a DSA email from user management.",
            403,
            {},
            "",
            req,
            instance
        );
        return false;
    }
    return true;
};

const resolveChannelPartnerDsaId = async (req) => {
    const fromDsaObject = req?.dsa?.dsa_id || req?.dsa?.id;
    if (fromDsaObject) {
        return fromDsaObject;
    }
    const bodyDsaId = req?.body?.dsa_id && String(req.body.dsa_id).trim();
    if (bodyDsaId) {
        return bodyDsaId;
    }
    if (req?.loggedInUser) {
        if (req.loggedInUser.userPhone) {
            const dsaData = await DSAService.getDsaByPhone(req.loggedInUser.userPhone);
            const fromPhone = dsaData?.dsa_id || dsaData?.customer_id;
            if (fromPhone) {
                return fromPhone;
            }
        }
        if (req.loggedInUser.dsa_id) {
            return req.loggedInUser.dsa_id;
        }
        if (req.loggedInUser.id) {
            const rows = await DSAService.getLoggedInUserDsaAndBhDetails(req.loggedInUser.id);
            if (Array.isArray(rows) && rows.length && rows[0]?.dsa_id) {
                return rows[0].dsa_id;
            }
        }
    }
    return null;
};

const resolveDsaIdOrRespond = async (req, res) => {
    const dsa_id = await resolveChannelPartnerDsaId(req);
    if (!dsa_id) {
        ResHelper.apiResponseV2(
            res,
            false,
            "Could not resolve DSA. Pass dsa_id in the body when acting for another partner, or use a DSA-authenticated session.",
            400,
            {},
            ""
        );
        return null;
    }
    return dsa_id;
};

const handleServiceError = (res, err, instance) => {
    const message = err?.message || "Something went wrong";
    const code = message.includes("Too many") || message.includes("wait") ? 429 : 400;
    ResHelper.apiResponseV2(res, false, message, code, {}, "", res.req, instance);
};

exports.sendOtpOld = async (req, res) => {
    const instance = "sendOtpOld";
    try {
        const dsa_id = await resolveDsaIdOrRespond(req, res);
        if (!dsa_id) return;
        const result = await EmailChangeService.sendOtpOldEmail(dsa_id);
        ResHelper.apiResponseV2(res, true, result.message, 200, {}, "", req, instance);
    } catch (err) {
        handleServiceError(res, err, instance);
    }
};

exports.verifyOtpOld = async (req, res) => {
    const instance = "verifyOtpOld";
    try {
        const dsa_id = await resolveDsaIdOrRespond(req, res);
        if (!dsa_id) return;
        const { otp } = req.body || {};
        const result = await EmailChangeService.verifyOtpOldEmail(dsa_id, otp);
        ResHelper.apiResponseV2(res, true, result.message, 200, {}, "", req, instance);
    } catch (err) {
        handleServiceError(res, err, instance);
    }
};

exports.resendOtpOld = async (req, res) => {
    const instance = "resendOtpOld";
    try {
        const dsa_id = await resolveDsaIdOrRespond(req, res);
        if (!dsa_id) return;
        const result = await EmailChangeService.resendOtpOldEmail(dsa_id);
        ResHelper.apiResponseV2(res, true, result.message, 200, {}, "", req, instance);
    } catch (err) {
        handleServiceError(res, err, instance);
    }
};

exports.sendOtpNew = async (req, res) => {
    const instance = "sendOtpNew";
    try {
        const dsa_id = await resolveDsaIdOrRespond(req, res);
        if (!dsa_id) return;
        const { new_email } = req.body || {};
        const result = await EmailChangeService.sendOtpNewEmail(dsa_id, new_email);
        ResHelper.apiResponseV2(res, true, result.message, 200, {}, "", req, instance);
    } catch (err) {
        handleServiceError(res, err, instance);
    }
};

exports.verifyOtpNew = async (req, res) => {
    const instance = "verifyOtpNew";
    try {
        const dsa_id = await resolveDsaIdOrRespond(req, res);
        if (!dsa_id) return;
        const { new_email, otp } = req.body || {};
        const result = await EmailChangeService.verifyOtpNewEmail(dsa_id, new_email, otp);
        ResHelper.apiResponseV2(res, true, result.message, 200, { email: result.email }, "", req, instance);
    } catch (err) {
        handleServiceError(res, err, instance);
    }
};

exports.resendOtpNew = async (req, res) => {
    const instance = "resendOtpNew";
    try {
        const dsa_id = await resolveDsaIdOrRespond(req, res);
        if (!dsa_id) return;
        const { new_email } = req.body || {};
        const result = await EmailChangeService.resendOtpNewEmail(dsa_id, new_email);
        ResHelper.apiResponseV2(res, true, result.message, 200, {}, "", req, instance);
    } catch (err) {
        handleServiceError(res, err, instance);
    }
};

exports.adminChangeEmail = async (req, res) => {
    const instance = "adminChangeEmail";
    try {
        if (!assertAdminEmailChangeRoleOrRespond(req, res, instance)) {
            return;
        }
        const { dsa_id, new_email } = req.body || {};
        if (!dsa_id || !String(dsa_id).trim()) {
            return ResHelper.apiResponseV2(res, false, "dsa_id is required", 400, {}, "", req, instance);
        }
        if (!new_email || !String(new_email).trim()) {
            return ResHelper.apiResponseV2(res, false, "new_email is required", 400, {}, "", req, instance);
        }
        const result = await EmailChangeService.adminChangeDsaEmail(String(dsa_id).trim(), new_email);
        ResHelper.apiResponseV2(res, true, result.message, 200, { email: result.email }, "", req, instance);
    } catch (err) {
        handleServiceError(res, err, instance);
    }
};

exports.adminResendVerificationEmail = async (req, res) => {
    const instance = "adminResendVerificationEmail";
    try {
        if (!assertAdminEmailChangeRoleOrRespond(req, res, instance)) {
            return;
        }
        const { dsa_id } = req.body || {};
        if (!dsa_id || !String(dsa_id).trim()) {
            return ResHelper.apiResponseV2(res, false, "dsa_id is required", 400, {}, "", req, instance);
        }
        const result = await EmailChangeService.adminResendVerificationEmail(String(dsa_id).trim());
        ResHelper.apiResponseV2(res, true, result.message, 200, {}, "", req, instance);
    } catch (err) {
        handleServiceError(res, err, instance);
    }
};

/** CRM SPA calls this with Accept: application/json; email links open the CRM /verify-email page instead. */
const wantsJsonResponse = (req) => {
    const accept = String(req.get("accept") || "");
    return accept.includes("application/json");
};

/** Public — no auth. GET /v1/dsa/verifyDsaEmail?token= (also /crm/v1/dsa/verifyDsaEmail via app.js) */
exports.verifyEmailPublic = async (req, res) => {
    const crmPage = EmailChangeService.getCrmVerifyEmailBaseUrl();
    try {
        const { token } = req.query || {};
        const result = await EmailChangeService.verifyEmailByToken(token);
        if (!wantsJsonResponse(req)) {
            const tokenQ = token ? `&token=${encodeURIComponent(token)}` : "";
            return res.redirect(302, `${crmPage}?verified=1${tokenQ}`);
        }
        return res.status(200).json({ success: true, message: result.message });
    } catch (err) {
        const message = err?.message || "Verification failed";
        if (!wantsJsonResponse(req)) {
            return res.redirect(302, `${crmPage}?error=${encodeURIComponent(message)}`);
        }
        return res.status(400).json({ success: false, message });
    }
};
