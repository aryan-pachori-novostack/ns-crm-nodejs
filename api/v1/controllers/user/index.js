const bcrypt = require("bcrypt");
const xlsx = require('xlsx');
const LeadLogService = require(_pathconst.ServicesPath.LeadLogService);
const { uploadRmUsersQueue } = require("../../../../jobs");
const { logger } = require("../../../helpers/logger");
const nodeAcl = require("../../../helpers/acl-middleware/acl-permissions.js");
const { minuteDiffence, sendEmail, checkWhereInQueryString, sendEmailSmtp, jsonDifferenceForNestedObjects, readSamplesFromS3 } = require("../../../helpers/commonhelper");
const crypto = require('crypto');
const client = require("../../../helpers/redis-client");
const { createExportLog } = require("../../../services/application-log-services");
const { sendNotificationByEmail } = require("../../../services/socket-services.js");
const { encryptionSlashRtcSSOLogin } = require("../../../helpers/constantdata/authhelper.js");
const { getPushNotifcationData, setPushNotificationData, getPushNotifcationDataReaded, markAllasReadNotificationMongo } = require("../../../services/mongo.js");
const { B2B_URL } = require("../../../helpers/constantdata/config.js");
const { getPermissions, mergePermissionsForBackendAccess } = require("../../../helpers/acl-middleware/rbac-middleware.js");
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let AuthHelper = require(_pathconst.FilesPath.AuthHelper);
const { rolesTree, getAllChildNodes, findParent } = require(_pathconst.FilesPath.RoleTree);
let UserService = require(_pathconst.ServicesPath.UserService);
let TrustedDeviceService = require(_pathconst.ServicesPath.TrustedDeviceService);
let DSAService = require(_pathconst.ServicesPath.DSAService);
let LeadService = require(_pathconst.ServicesPath.LeadService);
let PicklistValuesServices = require(_pathconst.ServicesPath.PicklistValuesServices);
let UserValidationV1 = require(_pathconst.ReqModelsPath.UserValidationV1);
const KafkaServices = require(_pathconst.ServicesPath.KafkaServices);

const pickUserForKafkaLog = (u) => {
    if (!u) return null;
    return {
        id: u.id ?? u.user_id ?? null,
        name: u.userName ?? u.name ?? null,
        email: u.userEmail ?? u.email ?? null,
        phone: u.userPhone ?? u.phone ?? null,
        role: u.role ?? null,
        parentEmail: u.parentEmail ?? null,
        parentName: u.parentName ?? null,
        status: u.status ?? null,
        statusName: u.statusName ?? null,
        isDeleted: u.isDeleted ?? null,
        bank: u.bank ?? null,
        payout: u.payout ?? null,
        backend_access: u.backend_access ?? null,
        bank_file_access: u.bank_file_access ?? null,
        bank_file_payout_access: u.bank_file_payout_access ?? null
    };
};

const safeKafkaUserEvent = async ({ event, from, to, ref_id, createdBy }) => {
    try {
        let fromPayload = from;
        let toPayload = to;

        if (from && to && typeof from === 'object' && typeof to === 'object') {
            const diff = jsonDifferenceForNestedObjects(from, to);
            const fromDetails = {};
            const toDetails = {};
            diff.forEach(([key, oldValue, newValue]) => {
                fromDetails[key] = oldValue;
                toDetails[key] = newValue;
            });
            fromPayload = fromDetails;
            toPayload = toDetails;
        }

        await KafkaServices.connectKafkaProducer();
        const log = new KafkaServices.EventLogger(
            event,
            typeof fromPayload === 'string' ? fromPayload : JSON.stringify(fromPayload ?? '-'),
            typeof toPayload === 'string' ? toPayload : JSON.stringify(toPayload ?? '-'),
            ref_id != null ? String(ref_id) : '',
            createdBy || null,
            new Date()
        );
        await KafkaServices.sendToKafkaLoggerService(log);
        return true;
    } catch (e) {
        logger.error(`Kafka EventLogger failed for ${event}:`, e);
        return false;
    }
};

const signUpCEO = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.signUpCEO.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { email, phone, name, password, dsa_id } = req.body;
            let user = await UserService.findUser(email);
            if (!user) {
                let role = await UserService.findRole("CEO");
                password = await bcrypt.hash(password, 10);
                user = await UserService.signUpCEO({ email, phone, role: role.id, name, password, payout: true, bank: true });
                nodeAcl.nodeAcl.addUserRoles(user.id, "CEO");//Users
                ResHelper.apiResponse(res, true, "Success", 201, user, "");
            } else {
                ResHelper.apiResponse(res, false, "User already exists", 204, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getAllUsers = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getAllUsers.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { id, startDateFilter, endDateFilter, pageNumber, pageSize, isDeleted, search, userName, userEmail, parent, role, status, bank, payout, phone } = req.body;
            let where = [];
            let searchList = [];
            if (isDeleted) {
                if (isDeleted == 0 || isDeleted == 1) {
                    where.push(['u.isDeleted', isDeleted]);
                }
            } else {
                where.push(['u.isDeleted', 0]);
            }
            if (search) {
                searchList.push(['u.name', 'like', `%${search}%`]);
                searchList.push(['u.email', 'like', `%${search}%`]);
                searchList.push(['u.phone', 'like', `%${search}%`]);
            }
            if (startDateFilter || endDateFilter) {
                where.push([`DATE(u.createdAt) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `, null]);
            }
            if (userName) {
                where.push([`u.name like '%${userName}%' `, null]);
            }
            if (userEmail) {
                where.push([`u.email like '%${userEmail}%' `, null]);
            }
            if (parent) {
                where.push([`p.email like '%${parent}%' `, null]);
            }
            if (role) {
                where.push([`r.role like '%${role}%' `, null]);
            }
            if (status) {
                where.push([`s.name like '%${status}%' `, null]);
            }
            if (phone) {
                where.push([`u.phone like '%${phone}%' `, null]);
            }
            if (bank || bank == 0) {
                where.push([`u.bank = ${bank} `, null]);
            }
            if (payout || payout == 0) {
                where.push([`u.payout =  ${payout} `, null]);
            }
            if (id) {
                where.push([`BIN_TO_UUID(u.id) like '%${id}%' `, null]);
            }
            let users = await UserService.getAllUsers(where, searchList, pageNumber * pageSize, pageSize);

            const parseSettingList = (settingValue) => {
                if (!settingValue || typeof settingValue !== "string") {
                    return [];
                }
                return settingValue
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean);
            };

            const [autoAssignConfig, autoAllocationRoleConfig] = await Promise.all([
                DSAService.getAllGlobalConfiguration(0, 1, "", "customer_leads_auto_assign"),
                DSAService.getAllGlobalConfiguration(0, 1, "", "customer_leads_auto_allocation_roles")
            ]);

            const autoAssignPhones = parseSettingList(autoAssignConfig?.lntApplications?.setting_value);
            const autoAllocationRoles = new Set(parseSettingList(autoAllocationRoleConfig?.lntApplications?.setting_value));
            const autoAssignUsers = await UserService.getUsersByPhones(autoAssignPhones);
            const parentEmailAllowList = new Set(
                autoAssignUsers
                    .map((user) => user?.userEmail)
                    .filter(Boolean)
            );

            users.users = (users?.users || []).map((user) => ({
                ...user,
                autoallocation: Boolean(
                    parentEmailAllowList.has(user?.parentEmail) &&
                    autoAllocationRoles.has((user?.role || "").trim())
                )
            }));
            ResHelper.apiResponse(res, true, "Success", 200, users, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getTelecallerDailyCapacity = async (req, res) => {
    try {
        const startedAt = Date.now();
        const { error } = UserValidationV1.getTelecallerDailyCapacity.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        const { telecaller_id } = req.body;
        const allocation_date = req.body?.allocation_date || new Date().toISOString().slice(0, 10);
        logger.info("getTelecallerDailyCapacity request", { telecaller_id, allocation_date });
        const record = await UserService.getTelecallerDailyCapacity({ telecaller_id, allocation_date });
        logger.info("getTelecallerDailyCapacity result", { hasRecord: Boolean(record), durationMs: Date.now() - startedAt });

        return ResHelper.apiResponse(res, true, "Success", 200, {
            telecaller_id,
            allocation_date,
            current_allocation: record?.allocated_count || 0,
            max_capacity: record?.max_capacity || 0,
            remaining_capacity: record?.remaining_capacity || 0,
            details: record || null
        }, "");
    } catch (err) {
        logger.error("getTelecallerDailyCapacity failed", { error: err?.message || err, stack: err?.stack });
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getTelecallerDailyCapacityHistory = async (req, res) => {
    try {
        const startedAt = Date.now();
        const { error } = UserValidationV1.getTelecallerDailyCapacityHistory.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        const { telecaller_id, startDateFilter, endDateFilter, pageNumber = 0, pageSize = 10 } = req.body;
        logger.info("getTelecallerDailyCapacityHistory request", { telecaller_id, startDateFilter, endDateFilter, pageNumber, pageSize });
        const data = await UserService.getTelecallerDailyCapacityHistory({
            telecaller_id: telecaller_id || null,
            startDateFilter: startDateFilter || null,
            endDateFilter: endDateFilter || null,
            offset: pageNumber * pageSize,
            limit: pageSize
        });
        logger.info("getTelecallerDailyCapacityHistory result", { totalRecords: data?.totalCount || 0, durationMs: Date.now() - startedAt });

        return ResHelper.apiResponse(res, true, "Success", 200, {
            records: data.records,
            totalRecords: data.totalCount
        }, "");
    } catch (err) {
        logger.error("getTelecallerDailyCapacityHistory failed", { error: err?.message || err, stack: err?.stack });
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateTelecallerDailyCapacity = async (req, res) => {
    try {
        const { error } = UserValidationV1.updateTelecallerDailyCapacity.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        const { id, max_capacity } = req.body;
        const existing = await UserService.getTelecallerDailyCapacityById(id);
        if (!existing) {
            return ResHelper.apiResponse(res, false, "Record not found", 404, {}, "");
        }

        const telecallerUser = await UserService.findUserByUserId(existing.telecaller_id);
        if (!telecallerUser) {
            return ResHelper.apiResponse(res, false, "Telecaller CRM user not found", 404, {}, "");
        }
        if (Number(telecallerUser.status) !== 1) {
            return ResHelper.apiResponse(res, false, "Cannot edit allocation for inactive CRM user", 400, {}, "");
        }

        if (Number(max_capacity) < Number(existing.allocated_count || 0)) {
            return ResHelper.apiResponse(res, false, "max_capacity cannot be less than allocated_count", 400, {}, "");
        }

        const updated = await UserService.updateTelecallerDailyCapacity({ id, max_capacity });

        await safeKafkaUserEvent({
            event: "telecaller_daily_capacity_updated",
            from: existing,
            to: updated,
            ref_id: telecallerUser.user_id,
            createdBy: req?.loggedInUser?.id
        });

        return ResHelper.apiResponse(res, true, "Capacity updated successfully", 200, updated, "");
    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllRmUsers = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getAllRmUsers.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, approved_status, city_filter, code_filter, branch_name_filter, sp_id_filter, sp_name_filter, sp_email_filter, sp_mobile_filter, reference_id_filter, location_tag_filter, is_active_filter, product_id_filter, created_by_filter, updated_by_filter, startDateFilter, endDateFilter, pincode_filter } = req.body;

            pageNumber = pageNumber || 0;
            pageSize = pageSize || 10;

            let where = "";
            if (city_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.city like '%${city_filter}%' `;
            }
            if (code_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.code like '%${code_filter}%' `;
            }
            if (branch_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.branch_name like '%${branch_name_filter}%' `;
            }
            if (sp_id_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.sp_id like '%${sp_id_filter}%' `;
            }
            if (sp_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.sp_name like '%${sp_name_filter}%' `;
            }
            if (sp_email_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.sp_email like '%${sp_email_filter}%' `;
            }
            if (sp_mobile_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.sp_mobile like '%${sp_mobile_filter}%' `;
            }
            if (reference_id_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.reference_id like '%${reference_id_filter}%' `;
            }
            if (pincode_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.pincode like '%${pincode_filter}%' `;
            }
            if (product_id_filter) {
                where = checkWhereInQueryString(where);
                where += ` p.product_name like '%${product_id_filter}%' `;
            }
            if (location_tag_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.location_tag like '%${location_tag_filter}%' `;
            }
            if (true) {
                where = checkWhereInQueryString(where);
                where += approved_status ? ` rbsp.is_approved = '1' ` : ` (rbsp.is_approved = '0' or rbsp.is_approved is null) `;
            }
            if (is_active_filter) {
                where = checkWhereInQueryString(where);
                let is_active = ` case when rbsp.is_active = 1 then "active" when rbsp.is_active = 2 then "red-flag" when rbsp.is_active = 3 then "blacklisted" else "inactive" end  `;
                if (is_active_filter?.toLowerCase() == "active") {
                    where += `${is_active} = '${is_active_filter}' `;
                } else {
                    where += `${is_active} like '%${is_active_filter}%' `;
                }
            };

            if (created_by_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.created_by like '%${created_by_filter}%' `;
            }
            if (updated_by_filter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.updated_by like '%${updated_by_filter}%' `;
            }
            if (startDateFilter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.created_at >= '${startDateFilter} 00:00:00' `;
            }

            if (endDateFilter) {
                where = checkWhereInQueryString(where);
                where += ` rbsp.updated_at <= '${endDateFilter} 23:59:59' `;
            }

            let RmUser = await UserService.getAllRmUsers(pageNumber * pageSize, pageSize, where);
            return ResHelper.apiResponse(res, true, "Success", 200, RmUser, "");
        }
    } catch (e) {
        console.log(e);
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getRmUserByPhone = async (req, res, next) => {
    try {
        req.body = req.loggedInUser ? req.body : req.query;
        const { error } = UserValidationV1.getRmUserByPhone.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let RmUser = await UserService.getRmUserByPhone(req?.body?.sp_mobile, req?.body?.sp_email);
            return ResHelper.apiResponse(res, true, "Success", 200, RmUser, "");
        }
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getRmUserByEmail = async (req, res, next) => {
    try {
        // For CRM use req.body, for external GET use req.query.
        req.body = req.loggedInUser ? req.body : req.query;
        // Validate that only sp_email based lookup payload is accepted.
        const { error } = UserValidationV1.getRmUserByEmail.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            // Normalize user input once before sending it to DB layer.
            req.body.sp_email = (req?.body?.sp_email || "").trim();
            const pageNumber = Number(req?.body?.pageNumber ?? 0);
            const pageSize = Number(req?.body?.pageSize ?? 10);
            // Search RM details by sp_email with pagination support.
            let rmUsers = await UserService.getRmUserByEmail(req?.body?.sp_email, pageNumber, pageSize);
            return ResHelper.apiResponse(res, true, "Success", 200, rmUsers, "");
        }
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getProductDropdown = async (req, res, next) => {
    console.log("Request Body:", req.body);
    try {
        const { error } = UserValidationV1.getProductDropdown.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { type } = req?.body;
            let data = await UserService.getProductDropdown(type);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};


const createRmUser = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.createRmUser.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            console.log("Validation Error:", error.message);
        } else {
            await UserService.createRmUser({ ...req.body, created_by: req?.loggedInUser?.id });
            ResHelper.apiResponse(res, true, "RM user created successfully", 200, {}, "");
        }
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const deleteRmUser = async (req, res, next) => {
    try {
        console.log("Request body before validation:", req.body.id);
        const id = req.body.id;
        console.log("$$$4" + id);
        const { error } = UserValidationV1.deleteRmUser.validate({ id });
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            console.log("Validation Error:", error.message);
        } else {
            let rmUser = await UserService.deleteRmUser({ id });
            console.log({ id });
            ResHelper.apiResponse(res, true, "RM user deleted successfully", 200, rmUser, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};



const addUser = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.addUser.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { email, phone, role, name, password, parent, business_head, dsa_id } = req.body;
            let isBlacklisted = await UserService.checkIfBlacklistedUserExist(email, phone);
            if (isBlacklisted) {
                return ResHelper.apiResponse(res, false, "User Blacklisted", 400, {}, "");
            };
            let status = await UserService.findUserCyclicDependency(parent, email);

            if (status && status != "69") {
                status = await UserService.isCyclicHierarchyCRM(status);
            };

            if (status == "69") {
                return ResHelper.apiResponse(res, false, "User Cyclic Dependency", 400, {}, "");
            };

            parent = await UserService.findUser(parent);
            if (!parent) {
                ResHelper.apiResponse(res, false, "Parent User not found", 400, {}, "");
            } else {
                let createdByUser = await UserService.findUser(req.loggedInUser.userEmail)
                let user = await UserService.findUser(email);
                if (!user) {
                    password = await bcrypt.hash(password, 10);
                    let verifyOtp = Math.floor(1000 + Math.random() * 900000);
                    role = await UserService.findRole(role);
                    user = await UserService.addUser({ email, phone, role: role.id, name, password, parent: parent.id, createdBy: createdByUser.id, otp: verifyOtp, otpCreatedAt: new Date(), dsa_id: dsa_id || null });

                    dsa_id && sendEmail({
                        to: email,
                        subject: 'Default Password',
                        body: `Here is your password: ${password} and email: ${email} for CRM login`
                    });

                    business_head && await UserService.updateSalesAdmin(business_head, email);
                    ResHelper.apiResponse(res, true, "Success", 201, user, "");
                } else {
                    if (dsa_id) {
                        let user = await UserService.addUser({ phone, email, password, dsa_id: dsa_id || null }, true);
                        dsa_id && sendEmail({
                            to: email,
                            subject: 'Default Password',
                            body: `Here is your password: ${password} and email: ${email} for CRM login`
                        });
                        business_head && await UserService.updateSalesAdmin(business_head, email);
                        return ResHelper.apiResponse(res, true, "Success", 201, user, "");
                    };
                    return ResHelper.apiResponse(res, false, "User already exists", 204, {}, "");
                }
            }
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const updateUser = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.updateUser.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { email, phone, role, name, parent, user_id, business_head } = req.body;
            let isBlacklisted = await UserService.checkIfBlacklistedUserExist(email, phone);
            if (isBlacklisted) {
                return ResHelper.apiResponse(res, false, "User Blacklisted", 400, {}, "");
            };
            let status = await UserService.findUserCyclicDependency(parent, email);
            if (status && status != "69") {
                status = await UserService.isCyclicHierarchyCRM(status);
            };
            if (status == "69") {
                return ResHelper.apiResponse(res, false, "User Cyclic Dependency", 400, {}, "");
            };

            parent = await UserService.findUser(parent);
            if (!parent) {
                ResHelper.apiResponse(res, false, "Parent User not found", 400, {}, "");
            } else {
                let user = await UserService.findUserById(user_id);
                if (!user) {
                    ResHelper.apiResponse(res, false, "User not found", 400, {}, "");
                    return;
                }
                const oldUser = await UserService.findUserByUserId(user_id);
                user = await UserService.findOtherUser(email, user_id);
                if (!user) {
                    role = await UserService.findRole(role);
                    user = await UserService.updateUserWithId({ where: { id: user_id } }, { email, phone, role: role.id, name, parent: parent.id });
                    business_head && await UserService.updateSalesAdmin(business_head, email);
                    const newUser = await UserService.findUserByUserId(user_id);
                    await safeKafkaUserEvent({
                        event: "user_profile_updated",
                        from: pickUserForKafkaLog(oldUser),
                        to: pickUserForKafkaLog(newUser),
                        ref_id: user_id,
                        createdBy: req?.loggedInUser?.id
                    });
                    ResHelper.apiResponse(res, true, "Success", 201, user, "");
                } else {
                    ResHelper.apiResponse(res, false, "Other User with given email Already Exists ", 400, {}, "");
                }
            }
        }
    }
    catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

const resendOtp = async (req, res, next) => {
    try {
        let verifyOtp = Math.floor(1000 + Math.random() * 900000);
        let user = await UserService.findUser(req.loggedInUser.userEmail);
        if (user.isDeleted == true) {
            ResHelper.apiResponse(res, false, "This User is disabled", 400, {}, "");
        } else {
            sendEmail({
                to: user.userEmail,
                subject: 'Verify OTP',
                body: `Here is your otp ${verifyOtp} for verifying the user account for user ${user.userEmail}`
            });
            await UserService.updateUserOtp({ where: { email: user.userEmail } }, { otp: verifyOtp, otpCreatedAt: new Date() });
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const validateOtp = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.validateOtp.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { otp } = req.body;
            let user = await UserService.findUser(req.loggedInUser.userEmail);
            if (user) {
                if (user.isDeleted == true) {
                    ResHelper.apiResponse(res, false, "This User is disabled", 400, {}, "");
                } else {
                    if (minuteDiffence(new Date(user.otpCreatedAt), new Date()) <= 5) {
                        if (otp == user.otp) {
                            await UserService.updateUserValidateOtp({ where: { email: req.loggedInUser.userEmail } }, { otpValidatedAt: new Date() });
                            ResHelper.apiResponse(res, true, "Otp validated", 201, {}, "");
                        } else {
                            ResHelper.apiResponse(res, false, "Incorrect Otp", 400, {}, "");
                        }
                    } else {
                        ResHelper.apiResponse(res, false, "Otp expired", 400, {}, "");
                    }
                }
            } else {
                ResHelper.apiResponse(res, false, "User not exists", 204, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const DEVICE_COOKIE_NAME = "device_token";

// CRM (crm-dev.ruloans.com) and API (dev-api.ruloans.com) are different sites — Strict blocks the cookie.
const trustedDeviceCookieSameSite = () =>
    process.env.TRUSTED_DEVICE_COOKIE_SAME_SITE || "none";

const trustedDeviceCookieSecure = () => {
    const sameSite = trustedDeviceCookieSameSite();
    if (sameSite === "none") {
        return true;
    }
    return process.env.ENVIRONMENT !== "dev";
};

const deviceCookieOptions = () => ({
    httpOnly: true,
    secure: trustedDeviceCookieSecure(),
    sameSite: trustedDeviceCookieSameSite(),
    path: "/",
    maxAge: 45 * 24 * 60 * 60 * 1000
});

const clearDeviceCookieOptions = () => ({
    httpOnly: true,
    secure: trustedDeviceCookieSecure(),
    sameSite: trustedDeviceCookieSameSite(),
    path: "/"
});

const isRememberDeviceRequested = (value) =>
    value === true || value === "true" || value === 1 || value === "1";

const getDeviceTokenHashFromRequest = (req) => {
    const rawToken = req.cookies?.[DEVICE_COOKIE_NAME];
    if (!rawToken) {
        return null;
    }
    return TrustedDeviceService.sha256(rawToken);
};

const assertUserCanLogin = (user) => {
    if (!user) {
        return { ok: false, message: "Invalid Credentials", code: 400 };
    }
    if (user.status != 1) {
        return { ok: false, message: "This User is disabled/blocked. Please Contact Admin", code: 400 };
    }
    if (user.isDeleted == true) {
        return { ok: false, message: "This User is disabled", code: 400 };
    }
    if (user.tokenUpdatedAt && user.tokenUpdatedAt !== "0000-00-00 00:00:00" && user.tokenUpdatedAt != null) {
        const lastLogin = new Date(user.tokenUpdatedAt);
        const daysSinceLogin = Math.floor((new Date() - lastLogin) / (1000 * 60 * 60 * 24));
        if (daysSinceLogin >= 45) {
            return {
                ok: false,
                message: "Account deactivated due to 45 days of inactivity. Please contact Admin.",
                code: 400
            };
        }
    }
    return { ok: true };
};

const completeCrmLogin = async (req, res, email) => {
    let user = await UserService.findUser(email);
    const gate = assertUserCanLogin(user);
    if (!gate.ok) {
        return ResHelper.apiResponse(res, false, gate.message, gate.code, {}, "");
    }

    let tokenDate = new Date();
    tokenDate = tokenDate.toString();
    await client.setAsync(user.userEmail, tokenDate, "EX", 86400); // 24-hour TTL session expiry
    await UserService.updateTokenDate(user.userEmail, new Date());
    user = await UserService.findUser(email);
    user.tokenUpdateDate = tokenDate;
    let token = await AuthHelper.createJWToken(user);

    try {
        let oldRoles = await new Promise((resolve) => {
            nodeAcl.nodeAcl.userRoles(user.id, (err, roles) => resolve(roles || []));
        });
        if (oldRoles && oldRoles.length > 0) {
            await new Promise((resolve) => {
                nodeAcl.nodeAcl.removeUserRoles(user.id, oldRoles, () => resolve());
            });
        }
    } catch (e) {
        logger.error("Error clearing old redis acl roles: " + e.message);
    }
    nodeAcl.nodeAcl.addUserRoles(user.id, user.role);
    nodeAcl.nodeAcl.addUserRoles(user.id, "BASE_USER");

    const isSuperAdmin = user.role === "CEO" && user.is_superadmin;
    const permissions = await getPermissions(user.role_id, isSuperAdmin);
    user.permissions = permissions;

    const loggedReq = { ...req, loggedInUser: user };
    await createExportLog(loggedReq, "post_login");
    logger.info(`User logged In ${email}`);

    let slash_rtc_sso_login = null;
    try {
        slash_rtc_sso_login = encryptionSlashRtcSSOLogin(user?.id);
    } catch (ssoErr) {
        logger.warn("encryptionSlashRtcSSOLogin failed: " + (ssoErr && ssoErr.message));
    }
    user = { ...user, slash_rtc_sso_login };
    return ResHelper.apiResponse(res, true, "otp_validated", 200, user, token);
};

const loginCEOGet = async (req, res) => {
    try {
        if (process.env.TRUSTED_DEVICE_ENABLED !== "true") {
            return ResHelper.apiResponse(res, true, "Success", 200, { trusted: false }, "");
        }
        const tokenHash = getDeviceTokenHashFromRequest(req);
        if (!tokenHash) {
            return ResHelper.apiResponse(res, true, "Success", 200, { trusted: false }, "");
        }
        const trustedRow = await TrustedDeviceService.isTrustedDevice(tokenHash);
        if (!trustedRow?.userEmail) {
            return ResHelper.apiResponse(res, true, "Success", 200, { trusted: false }, "");
        }
        // Status only — do not issue JWT here. User must POST loginCEO (password) to sign in;
        // OTP is skipped when this device is still trusted.
        return ResHelper.apiResponse(res, true, "Success", 200, {
            trusted: true,
            email: trustedRow.userEmail,
            name: trustedRow.userName
        }, "");
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const loginCEO = async (req, res, next) => {
    try {
        if (req.body?.otp) {
            return loginCEOVerifyOtp(req, res, next);
        }

        const { error } = UserValidationV1.loginCEO.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        const { email, password } = req.body;
        let user = await UserService.findUser(email);
        if (!user) {
            return ResHelper.apiResponse(res, false, "Invalid Credentials", 400, {}, "");
        }

        const gate = assertUserCanLogin(user);
        if (!gate.ok) {
            return ResHelper.apiResponse(res, false, gate.message, gate.code, {}, "");
        }

        const passwordMatched = await bcrypt.compare(password, user.password);
        if (!passwordMatched) {
            return ResHelper.apiResponse(res, false, "Invalid Credentials", 400, {}, "");
        }

        if (process.env.TRUSTED_DEVICE_ENABLED === "true") {
            const tokenHash = getDeviceTokenHashFromRequest(req);
            if (tokenHash) {
                const trustedRow = await TrustedDeviceService.isTrustedDevice(tokenHash);
                if (trustedRow && trustedRow.userEmail === email) {
                    return completeCrmLogin(req, res, email);
                }
            }
            await TrustedDeviceService.storePendingFingerprint(client, user.id, "1");
            return ResHelper.apiResponse(res, true, "Success", 200, { status: "need_otp" }, "");
        }

        return ResHelper.apiResponse(res, true, "Success", 200, { status: "need_otp" }, "");
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const loginCEOVerifyOtp = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.loginCEOVerifyOtp.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        const { email, password, otp, rememberDevice } = req.body;
        let user = await UserService.findUser(email);
        if (!user) {
            return ResHelper.apiResponse(res, false, "Invalid Credentials", 400, {}, "");
        }

        const gate = assertUserCanLogin(user);
        if (!gate.ok) {
            return ResHelper.apiResponse(res, false, gate.message, gate.code, {}, "");
        }

        const passwordMatched = await bcrypt.compare(password, user.password);
        if (!passwordMatched) {
            return ResHelper.apiResponse(res, false, "Invalid Credentials", 400, {}, "");
        }

        const verifyOTP = await verifyOTPEmail({ email, otp, res, user });
        if (!verifyOTP?.status) {
            return ResHelper.apiResponse(res, verifyOTP?.status, verifyOTP?.message, verifyOTP?.code);
        }

        if (process.env.TRUSTED_DEVICE_ENABLED === "true" && isRememberDeviceRequested(rememberDevice)) {
            const pending = await TrustedDeviceService.getPendingFingerprint(client, user.id);
            if (!pending) {
                logger.warn(`rememberDevice: no pending_trust for user ${user.id} — run POST loginCEO (password) before verify-otp`);
            } else {
                const { rawToken, tokenHash } = TrustedDeviceService.generateDeviceToken();
                const ip = TrustedDeviceService.extractClientIp(req);
                const userAgent = req.headers["user-agent"] ?? null;
                await TrustedDeviceService.trustDevice(user.id, tokenHash, ip, userAgent);
                res.cookie(DEVICE_COOKIE_NAME, rawToken, deviceCookieOptions());
                await TrustedDeviceService.clearPendingFingerprint(client, user.id);
                logger.info(`Trusted device cookie set for user ${user.id}`);
            }
        }

        return completeCrmLogin(req, res, email);
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const checkDevice = async (req, res) => {
    try {
        if (process.env.TRUSTED_DEVICE_ENABLED !== "true") {
            return ResHelper.apiResponse(res, true, "Success", 200, { trusted: false }, "");
        }
        const tokenHash = getDeviceTokenHashFromRequest(req);
        if (!tokenHash) {
            return ResHelper.apiResponse(res, true, "Success", 200, { trusted: false }, "");
        }
        const trustedRow = await TrustedDeviceService.isTrustedDevice(tokenHash);
        if (!trustedRow) {
            return ResHelper.apiResponse(res, true, "Success", 200, { trusted: false }, "");
        }
        return ResHelper.apiResponse(res, true, "Success", 200, {
            trusted: true,
            email: trustedRow.userEmail,
            name: trustedRow.userName
        }, "");
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const logout = async (req, res) => {
    try {
        const email = req.loggedInUser?.userEmail;
        if (email) {
            try {
                await client.delAsync(email);
                await client.delAsync(`${email}:last_activity`);
            } catch (redisErr) {
                logger.warn("logout redis cleanup: " + (redisErr && redisErr.message));
            }
        }

        // Logout ends the JWT session only. Remember-me stays active (DB + cookie) until
        // expiry or explicit revokeTrustedDevice (e.g. "Forget this device").
        const revokeTrustedDevice =
            req.body?.revokeTrustedDevice === true ||
            req.body?.revokeTrustedDevice === "true";

        if (process.env.TRUSTED_DEVICE_ENABLED === "true" && revokeTrustedDevice) {
            const rawToken = req.cookies?.[DEVICE_COOKIE_NAME];
            if (rawToken) {
                const tokenHash = TrustedDeviceService.sha256(rawToken);
                await TrustedDeviceService.revokeDevice(tokenHash);
            }
            res.clearCookie(DEVICE_COOKIE_NAME, clearDeviceCookieOptions());
        }

        return ResHelper.apiResponse(res, true, "Logged out successfully", 200, {}, "");
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getRoles = async (req, res, next) => {
    try {
        let roles = await UserService.getRoles();
        ResHelper.apiResponse(res, true, "Success", 200, roles, "");
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res.false, "Error occured during execution", 500, {}, "");
    }
}


const deleteUser = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.deleteUser.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { email, isDeleted } = req.body;
            let user = await UserService.findUser(email);
            if (!user) {
                ResHelper.apiResponse(res, false, "User does not exist", 400, {}, "");
            } else {
                const oldUser = await UserService.findUserByUserId(user.id);
                await UserService.updateUserDelete({ where: { email } }, { isDeleted });
                const newUser = await UserService.findUserByUserId(user.id);
                await safeKafkaUserEvent({
                    event: "user_deleted",
                    from: pickUserForKafkaLog(oldUser),
                    to: pickUserForKafkaLog(newUser),
                    ref_id: user.id,
                    createdBy: req?.loggedInUser?.id
                });
                ResHelper.apiResponse(res, true, "User deleted", 201, {}, "");
            }
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res.false, "Error occured during execution", 500, {}, "");
    }
}

const changePassword = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.changePassword.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { password, confirmPassword } = req.body;
            let email = req.loggedInUser.userEmail;
            if (confirmPassword !== password) ResHelper.apiResponse(res, true, "Confirm Password doesnot match", 400, {}, "");
            else {
                let user = await UserService.findUser(email);
                if (user.isDeleted == true) {
                    return ResHelper.apiResponse(res, false, "This User is disabled", 400, {}, "");
                } else {
                    if (user) {
                        let data = {};
                        if (user.dummyPassword) data.dummyPassword = false;
                        else data.dummyPassword = true;
                        password = await bcrypt.hash(password, 10);
                        data.password = password;
                        data.tokenUpdatedAt = new Date()
                        await UserService.updateUserPassword({ where: { email } }, data);
                        return ResHelper.apiResponse(res, true, "Password Changed Successfully", 201, {}, "");
                    } else {
                        return ResHelper.apiResponse(res, false, "Unauthorised", 404, {}, "");
                    }
                }
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const changePasswordNew = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.changePasswordNew.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { new_password } = req.body;
            let password = await bcrypt.hash(new_password, 10);
            let email = req.loggedInUser.userEmail;
            await UserService.changeUserPassword(email, password, new Date());
            ResHelper.apiResponse(res, true, "success", 400, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getParentRole = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getParentRole.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { role } = req.body
            const parentRole = findParent(rolesTree, role);
            ResHelper.apiResponse(res, true, "Parent Role Fetched Success", 200, { parentRole }, "");
        }
    } catch (err) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getChildRoles = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getParentRole.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { role } = req.body
            const childRoles = getAllChildNodes(rolesTree, role);
            ResHelper.apiResponse(res, true, "Child Roles Fetched Success", 200, { childRoles }, "");
        }
    } catch (err) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}
const getUserByRole = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getUserByRole.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { role, pageNumber, pageSize, search, user_filter, backend_access } = req.body;
            // if (!role) role = req.loggedInUser.role;
            let where = [['u.status', 1], ['u.isDeleted', 0]];
            parentId = Boolean(role == "childs_only") ? req?.loggedInUser?.id : null;
            // parentId = null;
            if (role && !parentId) {
                where.push(['r.role', role]);
            };
            if (backend_access) {
                where.push(['u.backend_access', backend_access]);
            };

            let searchList = [];
            if (search) {
                searchList.push(['u.name', 'like', `%${search}%`]);
                searchList.push(['u.phone', 'like', `%${search}%`]);
                searchList.push(['u.email', 'like', `%${search}%`]);
            };
            const childRoles = await UserService.getAllUsers(where, searchList, pageNumber * pageSize, pageSize || null, null);
            ResHelper.apiResponse(res, true, "Users Fetched Success", 200, { childRoles }, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getUserById = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getUserById.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { id } = req.body;
            const user = await UserService.getUserById(id);
            ResHelper.apiResponse(res, true, "User Found", 200, user, "");
        }
    } catch (err) {
        logger.error(err)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const getUserTrustedDevices = async (req, res, next) => {
    try {
        if (process.env.TRUSTED_DEVICE_ENABLED !== "true") {
            return ResHelper.apiResponse(res, true, "Trusted device feature disabled", 200, {
                devices: [],
                last_active_device: null,
                this_request_device: null
            }, "");
        }
        const { error } = UserValidationV1.getUserTrustedDevices.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }
        const { user_id } = req.body;
        const devices = await TrustedDeviceService.getTrustedDevicesForUser(user_id);
        const tokenHash = getDeviceTokenHashFromRequest(req);
        const thisRequestDevice = tokenHash
            ? await TrustedDeviceService.getTrustedDeviceRowByTokenHash(tokenHash)
            : null;
        const last_active_device = devices.length ? devices[0] : null;
        return ResHelper.apiResponse(res, true, "Success", 200, {
            devices,
            last_active_device,
            this_request_device: thisRequestDevice
        }, "");
    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

/** Revoke remember-me for one device without ending the JWT session. Next login on that device requires OTP. */
const revokeTrustedDeviceHandler = async (req, res) => {
    try {
        if (process.env.TRUSTED_DEVICE_ENABLED !== "true") {
            return ResHelper.apiResponse(res, true, "Trusted device feature disabled", 200, { revoked: false }, "");
        }
        const { error } = UserValidationV1.revokeTrustedDevice.validate(req.body || {});
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        const userId = req.loggedInUser?.id;
        if (!userId) {
            return ResHelper.apiResponse(res, false, "Unauthorized", 401, {}, "");
        }

        const { device_id } = req.body || {};
        let revoked = false;
        let clearedCurrentCookie = false;

        if (device_id != null) {
            revoked = await TrustedDeviceService.revokeTrustedDeviceById(device_id, userId);
            if (!revoked) {
                return ResHelper.apiResponse(res, false, "Trusted device not found", 404, {}, "");
            }
            const tokenHash = getDeviceTokenHashFromRequest(req);
            if (tokenHash) {
                const currentRow = await TrustedDeviceService.getTrustedDeviceRowByTokenHash(tokenHash);
                if (currentRow && Number(currentRow.id) === Number(device_id)) {
                    res.clearCookie(DEVICE_COOKIE_NAME, clearDeviceCookieOptions());
                    clearedCurrentCookie = true;
                }
            }
        } else {
            const tokenHash = getDeviceTokenHashFromRequest(req);
            if (!tokenHash) {
                return ResHelper.apiResponse(res, false, "No trusted device cookie on this browser", 400, {}, "");
            }
            const currentRow = await TrustedDeviceService.getTrustedDeviceRowByTokenHash(tokenHash);
            if (!currentRow || currentRow.user_id !== userId) {
                return ResHelper.apiResponse(res, false, "No active trusted device for this browser", 404, {}, "");
            }
            revoked = await TrustedDeviceService.revokeDevice(tokenHash);
            res.clearCookie(DEVICE_COOKIE_NAME, clearDeviceCookieOptions());
            clearedCurrentCookie = true;
        }

        return ResHelper.apiResponse(res, true, "Trusted device revoked", 200, {
            revoked,
            cleared_current_cookie: clearedCurrentCookie
        }, "");
    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const resetPasswordLink = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.resetPasswordLink.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { email } = req.body;
            const user = await UserService.findUser(email);
            if (!email) {
                ResHelper.apiResponse(res, false, "If the email exists, you will receive further instructions.", 400, user, "");
            } else {
                let otp = Math.floor(1000 + Math.random() * 900000);
                sendEmail({ to: email, subject: ` Password reset otp ${otp} `, body: ` Here is your Otp ` });
                await UserService.updateUserOtp({ where: { email } }, { otp, otpCreatedAt: new Date() });
                ResHelper.apiResponse(res, true, "Otp Send SuccessFully ", 200, user, "");
            }
        }
    } catch (err) {
        logger.error(err)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}



const resetPassword = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.resetPassword.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { otp, password, confirmPassword, email } = req.body;
            if (confirmPassword !== password) ResHelper.apiResponse(res, true, "Confirm Password doesnot match", 400, {}, "");
            else {
                let user = await UserService.findUser(email);
                if (!user) {
                    ResHelper.apiResponse(res, false, " Invalid Email ", 400, {}, "");
                } else {
                    if (user.isDeleted == true) {
                        ResHelper.apiResponse(res, false, "This User is disabled", 400, {}, "");
                    } else {
                        if (user) {
                            if (minuteDiffence(new Date(user.otpCreatedAt), new Date()) <= 5) {
                                if (otp == user.otp) {
                                    await UserService.updateUserValidateOtp({ where: { email } }, { otpValidatedAt: new Date() });
                                    let data = {};
                                    password = await bcrypt.hash(password, 10);
                                    data.password = password;
                                    data.dummyPassword = false;
                                    await UserService.updateUserPassword({ where: { email } }, data);
                                    ResHelper.apiResponse(res, true, "Password Reset Successfully", 201, {}, "");
                                } else {
                                    ResHelper.apiResponse(res, false, "Incorrect Otp", 400, {}, "");
                                }
                            } else {
                                ResHelper.apiResponse(res, false, "Otp expired", 400, {}, "");
                            }
                        } else {
                            ResHelper.apiResponse(res, false, "Unauthorised", 404, {}, "");
                        }
                    }
                }
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const resetPasswordLinkUrl = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.resetPasswordLink.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { email } = req.body;
            let user = await UserService.findUser(email);
            if (!user) {
                ResHelper.apiResponse(res, true, "If the email exists, you will receive further instructions.", 200, {}, "");
            } else {
                await UserService.deleteResetToken(user.id);
                let token = await crypto.randomBytes(32).toString('hex');
                let hash = await bcrypt.hash(token, 10);
                await UserService.createResetToken(user.id, hash);
                let baseUrl = process.env.BASE_URL;
                let url = `${baseUrl}?token=${token}&id=${user.id}`;
                sendEmail({
                    to: user.userEmail,
                    subject: 'Reset Password Link ',
                    body: `<html><body><h1>Here is your Password rest link for RuLoans .</h1><a href='${url}'>Reset Password</a></body></html>`
                }, true)
                ResHelper.apiResponse(res, true, "Reset Password Link Sent", 201, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const verifyResetPasswordLink = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.verifyResetPasswordLink.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id, token } = req.body;
            let reset_password_link = await UserService.getResetToken(user_id);
            await UserService.deleteResetToken(user_id);
            if (!reset_password_link) {
                ResHelper.apiResponse(res, false, "Invalid Token", 400, {}, "");
            } else {
                const now = new Date();
                const istOffset = 5.5 * 60 * 60 * 1000;
                const istTime = new Date(now.getTime() + istOffset);
                if (minuteDiffence(istTime, new Date(reset_password_link.created_at)) <= 20) {
                    console.log(await bcrypt.compare(token, reset_password_link.reset_token), "=====")
                    if (await bcrypt.compare(token, reset_password_link.reset_token)) {
                        let user = await UserService.getUserById(user_id);
                        await UserService.updateTokenDate(user.userEmail, new Date());
                        user = await UserService.getUserById(user_id);
                        let token = await AuthHelper.createJWToken(user);
                        ResHelper.apiResponse(res, true, "Success", 200, { token }, "");
                    } else {
                        ResHelper.apiResponse(res, false, "Inavlaid Token", 400, {}, "");
                    }
                } else {
                    ResHelper.apiResponse(res, false, "Inavlaid Token", 4012, {}, "");
                }
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const changePasswordByAdmin = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.changePasswordByAdmin.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id, password, oldPassword, isNormalUser } = req.body;
            let user = await UserService.findUserByUserId(user_id);
            if (!user) {
                ResHelper.apiResponse(res, false, "User does not exist", 400, {}, "");
            } else {
                if (user) {
                    if (isNormalUser) {
                        if (!oldPassword) {
                            ResHelper.apiResponse(res, false, "Old password is required", 400, {}, "");
                            return;
                        };
                        let passwordMatched = await bcrypt.compare(oldPassword, user.password);
                        if (!passwordMatched) {
                            ResHelper.apiResponse(res, false, "Old password not matched", 400, {}, "");
                            return;
                        };
                    };
                    let data = {};
                    password = await bcrypt.hash(password, 10);
                    data.password = password;
                    await UserService.changePasswordByUserId({ where: { user_id } }, data);
                    await safeKafkaUserEvent({
                        event: "user_password_changed",
                        from: { user_id },
                        to: { user_id, changed: true },
                        ref_id: user_id,
                        createdBy: req?.loggedInUser?.id
                    });
                    ResHelper.apiResponse(res, true, "Password Changed Successfully", 201, {}, "");
                } else {
                    ResHelper.apiResponse(res, false, "Unauthorised", 404, {}, "");
                }
            }

        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateStatus = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.updateStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id, status_id } = req.body;
            let user = await UserService.findUserByUserId(user_id);
            if (!user) {
                ResHelper.apiResponse(res, false, "User does not exist", 400, {}, "");
            } else {
                const oldUser = user;
                await UserService.updateStatus(user_id, status_id, user.email);
                //    if(status_id == 3) await DSAService.updateDsaStatusByPhone(user.phone,51)
                const newUser = await UserService.findUserByUserId(user_id);
                await safeKafkaUserEvent({
                    event: "user_status_updated",
                    from: pickUserForKafkaLog(oldUser),
                    to: pickUserForKafkaLog(newUser),
                    ref_id: user_id,
                    createdBy: req?.loggedInUser?.id
                });
                ResHelper.apiResponse(res, true, "Success", 201, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}


const getUserDsaProfile = async (req, res, next) => {
    try {
        let user = await DSAService.getUserDsaProfileByPhone(req.loggedInUser.userPhone);
        ResHelper.apiResponse(res, true, "Success", 201, user, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updatePayoutStatus = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.updatePayoutStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id, status } = req.body;
            let user = await UserService.findUserByUserId(user_id);
            if (!user) {
                ResHelper.apiResponse(res, false, "User does not exist", 400, {}, "");
            } else {
                const oldUser = user;
                await UserService.updatePayoutStatus(user_id, status);
                const newUser = await UserService.findUserByUserId(user_id);
                await safeKafkaUserEvent({
                    event: "user_payout_access_updated",
                    from: pickUserForKafkaLog(oldUser),
                    to: pickUserForKafkaLog(newUser),
                    ref_id: user_id,
                    createdBy: req?.loggedInUser?.id
                });
                ResHelper.apiResponse(res, true, "Success", 201, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateBackendAccessStatus = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.updateBackendAccessStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id, status } = req.body;
            let user = await UserService.findUserByUserId(user_id);
            if (!user) {
                ResHelper.apiResponse(res, false, "User does not exist", 400, {}, "");
            } else {
                const oldUser = user;
                await UserService.updateBackendAccessStatus(user_id, status);
                const newUser = await UserService.findUserByUserId(user_id);
                await safeKafkaUserEvent({
                    event: "user_backend_access_updated",
                    from: pickUserForKafkaLog(oldUser),
                    to: pickUserForKafkaLog(newUser),
                    ref_id: user_id,
                    createdBy: req?.loggedInUser?.id
                });
                ResHelper.apiResponse(res, true, "Success", 201, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateBankFilePayoutAccessStatus = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.updateBankFilePayoutAccessStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id, status } = req.body;
            let user = await UserService.findUserByUserId(user_id);
            if (!user) {
                ResHelper.apiResponse(res, false, "User does not exist", 400, {}, "");
            } else {
                const oldUser = user;
                await UserService.updateBankFilePayoutAccessStatus(user_id, status);
                const newUser = await UserService.findUserByUserId(user_id);
                await safeKafkaUserEvent({
                    event: "user_bank_file_payout_access_updated",
                    from: pickUserForKafkaLog(oldUser),
                    to: pickUserForKafkaLog(newUser),
                    ref_id: user_id,
                    createdBy: req?.loggedInUser?.id
                });
                ResHelper.apiResponse(res, true, "Success", 201, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}


const updateBankFileAccessStatus = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.updateBackendAccessStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id, status } = req.body;
            let user = await UserService.findUserByUserId(user_id);
            if (!user) {
                ResHelper.apiResponse(res, false, "User does not exist", 400, {}, "");
            } else {
                const oldUser = user;
                await UserService.updateBankFileAccessStatus(user_id, status);
                const newUser = await UserService.findUserByUserId(user_id);
                await safeKafkaUserEvent({
                    event: "user_bank_file_access_updated",
                    from: pickUserForKafkaLog(oldUser),
                    to: pickUserForKafkaLog(newUser),
                    ref_id: user_id,
                    createdBy: req?.loggedInUser?.id
                });
                ResHelper.apiResponse(res, true, "Success", 201, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateBankStatus = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.updateBankStatus.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id, status } = req.body;
            let user = await UserService.findUserByUserId(user_id);
            if (!user) {
                ResHelper.apiResponse(res, false, "User does not exist", 400, {}, "");
            } else {
                const oldUser = user;
                await UserService.updateBankStatus(user_id, status);
                const newUser = await UserService.findUserByUserId(user_id);
                await safeKafkaUserEvent({
                    event: "user_bank_access_updated",
                    from: pickUserForKafkaLog(oldUser),
                    to: pickUserForKafkaLog(newUser),
                    ref_id: user_id,
                    createdBy: req?.loggedInUser?.id
                });
                ResHelper.apiResponse(res, true, "Success", 201, {}, "");
            }
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const addCallerId = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.addCallerId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id, caller_id } = req.body;
            let caller = await UserService.getCallerId(user_id);
            if (caller) {
                return ResHelper.apiResponse(res, false, "Caller Id Already Exists", 400, {}, "");
            }
            await UserService.updateOtherUserForSameCallerId(user_id, caller_id)
            await UserService.addCallerId(user_id, caller_id);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCallerId = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getCallerId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_id } = req.body;
            let caller = await UserService.getCallerId(user_id);
            ResHelper.apiResponse(res, true, "Success", 200, caller, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}


const getAllCallerId = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getAllCallerId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, mobile } = req.body;
            if (!pageSize) {
                pageSize = 100;
            }
            if (!pageNumber) {
                pageNumber = 0;
            }
            let result = await UserService.getAllCallerId(mobile, pageNumber * pageSize, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, result, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const updateCallerId = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.updateCallerId.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            await UserService.updateOtherUserForSameCallerId(user_id, caller_id)
            let { user_id, caller_id, has_calling_enabled } = req.body;
            await UserService.updateCallerId(user_id, caller_id, has_calling_enabled);
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const clickToCall = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.clickToCall.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { reciever_mobile } = req.body;
            let caller_id = await UserService.getCallerId(req.loggedInUser.id);
            if (!(caller_id && caller_id.has_calling_enabled)) {
                return ResHelper.apiResponse(res, false, "No Active Caller Id Found For the User", 400, {}, "");
            }
            let response = await UserService.clickToCall(reciever_mobile, caller_id.caller_id, req.loggedInUser.id);
            if (response.has_error) {
                ResHelper.apiResponse(res, false, response.error_message, 201, {}, "");
            } else {
                ResHelper.apiResponse(res, true, "Success", 201, {}, "");
            }

        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const despositionWebhook = async (req, res, next) => {
    try {

        let user_type = 'customer';
        let dsa_mobile = req.body.lead_fields["f0"];
        if (dsa_mobile) {
            if (dsa_mobile.startsWith('+91')) {
                dsa_mobile = dsa_mobile.slice(3); // Remove the first 3 characters (+91)
            }
        }
        let dsa = await DSAService.getDsaByPhone(dsa_mobile);
        let createdBy = null;
        let callerId = await UserService.getUserIdByCallerId(req.body.agent.extension);
        if (callerId) {
            createdBy = callerId.user_id;
        }
        let user_id = dsa ? dsa.customer_id : null;
        let call_status = req.body.disposition.name;
        call_status = await PicklistValuesServices.getPicklistValueByValue(call_status);
        call_status = call_status ? call_status.id : null;
        let remarks = req.body.disposition.note;
        let call_id = req.body.call_id;
        let disposition = req.body.disposition.name;
        let caller_id = req.body.caller_id_number;
        await LeadService.addDispostionToCallLogs(user_type, createdBy, user_id, call_status, remarks, call_id, disposition, caller_id, req.body);
        ResHelper.apiResponse(res, true, "Success", 201, {}, "");
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getUserActivityLogs = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getUserActivityLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, api_type, name_filter, email_filter, api_filter, ip_filter, startDateFilter, dateEndFilter, endDateFilter } = req.body;
            let where = ` where ul.api_type = "${api_type}" `;
            if (name_filter) {
                where += ` and u.name like '%${name_filter}%' `
            }
            if (email_filter) {
                where += ` and u.email like '%${email_filter}%' `
            }
            if (api_filter) {
                where += ` and ul.api like '%${api_filter}%' `
            }
            if (ip_filter) {
                where += ` and ul.payload like '%${ip_filter}%' `
            }
            if (startDateFilter) {
                where += ` and DATE(ul.created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}") `
            }
            let result = await UserService.getUserActivityLogs(pageNumber * pageSize, pageSize, req?.loggedInUser?.id, where);
            ResHelper.apiResponse(res, true, "Success", 200, result, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getUserByBusinessHead = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getUserByBusinessHead.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, search } = req.body;
            let where = "";
            if (search) {
                where += ` and full_name like '%${search}%' or  dsa_mobile_number like '%${search}%' `;
            }
            const childRoles = await DSAService.getUserByBusinessHead(req?.loggedInUser?.userPhone, where, pageNumber * pageSize, pageSize || null);
            ResHelper.apiResponse(res, true, "Users Fetched Success", 200, { childRoles }, "");
        }
    } catch (err) {
        logger.error(err)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

//Blacklisted Users

const getAllBlacklistedUsers = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.getAllBlacklistedUsers.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, user_email_filter, user_phone_filter, blacklisted_by_filter, comment_filter } = req.body;
            let where = "";
            if (user_email_filter) {
                where = checkWhereInQueryString(where)
                where += ` bu.user_email like '%${user_email_filter}%' `;
            };
            if (user_phone_filter) {
                where = checkWhereInQueryString(where)
                where += ` bu.user_phone like '%${user_phone_filter}%' `;
            };
            if (blacklisted_by_filter) {
                where = checkWhereInQueryString(where)
                where += ` u.name like '%${blacklisted_by_filter}%' `;
            };
            if (comment_filter) {
                where = checkWhereInQueryString(where)
                where += ` bu.comments like '%${comment_filter}%' `;
            };
            const data = await UserService.getAllBlacklistedUsers(pageNumber * pageSize, pageSize || null, where);
            ResHelper.apiResponse(res, true, "Users Fetched Success", 200, data, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const insertBlacklistedUser = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.insertBlacklistedUser.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { user_email, user_phone } = req.body;
            const userExist = await UserService.checkIfBlacklistedUserExist(user_email, user_phone);
            if (userExist) {
                ResHelper.apiResponse(res, false, "User already blacklisted", 400, {}, "");
                return;
            };
            await UserService.insertBlacklistedUser({ ...req?.body, blacklisted_by: req?.loggedInUser?.id });
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteBlacklistedUser = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.deleteBlacklistedUser.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            await UserService.deleteBlacklistedUser({ ...req?.body, blacklisted_by: req?.loggedInUser?.id });
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const sendSocketNotificationCRM = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.sendSocketNotificationCRM.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { email, topic, title, body, image, link } = req.body
            let { message, code } = await sendNotificationByEmail(email, topic, title, body, image, link);
            if (code === 400) {
                return ResHelper.apiResponse(res, false, message, code, {}, "");
            }
            ResHelper.apiResponse(res, true, message, code, {}, "");
        };
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const bulkApproveRMUser = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.bulkApproveRMUser.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            const { user } = req?.body;
            await UserService.bulkApproveRMUser(user);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getUserPushNotificationLogs = async (req, res) => {


    try {
        const { error } = UserValidationV1.getUserPushNotificationLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, error.errors, error.data);
        } else {
            const { page, pageSize } = req?.body;
            let logs = await getPushNotifcationData(req.loggedInUser.userEmail, page, pageSize);
            ResHelper.apiResponse(res, true, "Success", 200, logs, "");

        }

    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};
const getUserPushNotificationLogsReaded = async (req, res) => {
    try {
        const { error } = UserValidationV1.getUserPushNotificationLogsReaded.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { page, pageSize } = req.body;
            let logs = await getPushNotifcationDataReaded(req.loggedInUser.userEmail, page, pageSize)
            ResHelper.apiResponse(res, true, "Success", 200, logs, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};
const markasReadNotification = async (req, res) => {
    try {
        const { error } = UserValidationV1.markasReadNotification.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { id } = req.body;
            await setPushNotificationData(id)
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const markAllasReadNotification = async (req, res) => {
    try {
        const email = req?.loggedInUser.userEmail;
        await markAllasReadNotificationMongo(email)
        ResHelper.apiResponse(res, true, "Success", 200, {}, "");
    }

    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const otpTemplate = (otp) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ruloans CRM OTP Verification</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f4f7fa;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa; padding:30px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width:500px; background:#ffffff; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.08); overflow:hidden;">
          <tr>
           <td align="center" style="background-color:#666CFF; padding:20px;">
                <table cellpadding="0" cellspacing="0" border="0" style="display:inline-block;">
                  <tr>
                    <td>
                      <img src="https://crm.ruloans.com/images/logo.png" alt="Ruloans" width="40" style="display:block; vertical-align:middle;">
                    </td>
                    <td style="padding-left:10px;">
                      <span style="font-size:20px; font-weight:bold; color:#ffffff; font-family:Arial, sans-serif;">RULoans</span>
                    </td>
                  </tr>
                </table>
          <td>
          </tr>
          <tr>
            <td style="padding:30px; text-align:center;">
              <h1 style="margin:0; color:#333333; font-size:22px;">OTP Verification</h1>
              <p style="margin-top:10px; font-size:15px; color:#555555;">Please use the following OTP to complete your CRM verification. This OTP is valid for <strong>2 minutes</strong>.</p>
              <div style="margin:25px 0;">
                <span style="font-size:28px; letter-spacing:10px; font-weight:bold; color:#004aad;">${otp}</span>
              </div>
              <p style="font-size:14px; color:#777777; margin:0;">If you did not request this OTP, please ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f7fa; padding:20px; text-align:center; font-size:12px; color:#888888;">
              © ${new Date().getFullYear()} Ruloans Distribution Services Pvt. Ltd.<br>
              All Rights Reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const ALLOWED_DOMAINS = ['ruloans.com', 'ruconnect.in', 'novostack.com', 'ext.ruloans.com'];

const logAllOtpKeys = (emailKeyBase, reset = false) => {
    const keys = {
        otp: `otp:${emailKeyBase}`,
        otp_hash: `otp_hash:${emailKeyBase}`,
        attempts: `otp_attempts:${emailKeyBase}`,
        cooldown: `otp_cooldown:${emailKeyBase}`,
        sendCount15: `otp_send_15min:${emailKeyBase}`,
        sendCountHour: `otp_send_hour:${emailKeyBase}`,
        lock: `otp_lock:${emailKeyBase}`
    };
    (async () => {
        const result = {};
        for (let key of Object.values(keys)) {
            result[key] = await client.getAsync(key);
            if (reset) {
                await client.delAsync(key);
            };
        };
        !reset && console.log(result);
    })();
};

const sendOTPToEmail = async (req, res) => {
    try {
        const { error } = UserValidationV1.sendOTPToEmail.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { email, type, reset, send_to_me } = req?.body;

            // 1. Validate email domain
            if (!ALLOWED_DOMAINS.some(domain => email.split("@")[1] == domain)) {
                return ResHelper.apiResponse(res, false, "Email must be a registered corporate address", 400, {}, "");
            };

            const emailKeyBase = `${email}:${type}`;
            const otpKey = `otp:${emailKeyBase}`;
            const otpHashKey = `otp_hash:${emailKeyBase}`;
            const attemptsKey = `otp_attempts:${emailKeyBase}`;
            const cooldownKey = `otp_cooldown:${emailKeyBase}`;
            const sendCount15Key = `otp_send_15min:${emailKeyBase}`;
            const sendCountHourKey = `otp_send_hour:${emailKeyBase}`;
            const lockKey = `otp_lock:${emailKeyBase}`;

            if (reset) {
                logAllOtpKeys(emailKeyBase, true);
                return ResHelper.apiResponse(res, true, "OTP state reset", 200, {});
            };

            // 2. Check if locked
            if (await client.getAsync(lockKey)) {
                return ResHelper.apiResponse(res, false, "You are temporarily locked fro 5 mins due to repeated failures", 429, {}, "");
            };

            // 3. Enforce cooldown
            if (await client.getAsync(cooldownKey)) {
                return ResHelper.apiResponse(res, false, "Please wait before requesting a new OTP", 429, {}, "");
            };

            // 4. Rate limiting
            let sends15 = parseInt(await client.getAsync(sendCount15Key) || 0);
            let sendsHour = parseInt(await client.getAsync(sendCountHourKey) || 0);

            if (sends15 >= 5) return ResHelper.apiResponse(res, false, "Max OTP requests reached. Try again later.", 429, {}, "");
            if (sendsHour >= 10) return ResHelper.apiResponse(res, false, "Max OTP requests reached. Try again later.", 429, {}, "");

            // 5. Check if existing OTP is valid
            let otp = null;
            let existingOtpHash = await client.getAsync(otpHashKey);
            if (existingOtpHash) {
                // OTP still valid, reuse same code
                otp = await client.getAsync(otpKey); // only if stored separately
            } else {
                // Generate new OTP
                otp = Math.floor(100000 + Math.random() * 900000).toString();
                const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

                await client.setAsync(otpKey, otp);
                await client.expireAsync(otpKey, 120); // 2 mmins

                await client.setAsync(otpHashKey, hashedOtp);
                await client.expireAsync(otpHashKey, 120); // 2 mmins

                await client.setAsync(attemptsKey, 0);
                await client.expireAsync(attemptsKey, 120); // 2 mins
            };

            // 7. Set cooldown
            await client.setAsync(cooldownKey, 1); // 45 seconds
            await client.expireAsync(cooldownKey, 45); // 2 mins

            // 6. Increment send counters
            await client.incrAsync(sendCount15Key);
            await client.incrAsync(sendCountHourKey);

            await client.expireAsync(sendCount15Key, 900); // 15 mins
            await client.expireAsync(sendCountHourKey, 3600); // 1 hour

            // 8. Send email
            await sendEmailSmtp({
                to: send_to_me ? `${email},${send_to_me}` : email,
                subject: `Login OTP for RULoans CRM`,
                text: `Here is your login OTP for RULoans CRM`,
                body: otpTemplate(otp),
            }, true);

            return ResHelper.apiResponse(res, true, "OTP sent to your registered email", 200, {}, "");
        };
    } catch (e) {
        logger.error(e);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const verifyOTPEmail = async ({ otp, email }) => {
    try {

        // 1. Validate email domain
        if (!ALLOWED_DOMAINS.some(domain => email.split("@")[1] == domain)) {
            return { status: false, code: 400, message: "Email must be a registered corporate address" };
        };

        const emailKeyBase = `${email}:crm_login_otp`;
        const otpHashKey = `otp_hash:${emailKeyBase}`;
        const attemptsKey = `otp_attempts:${emailKeyBase}`;
        const lockKey = `otp_lock:${emailKeyBase}`;

        // 2. Check lockout
        if (await client.getAsync(lockKey)) {
            return { status: false, code: 429, message: "You are locked due to repeated OTP failures" };
        };

        // 3. Get stored OTP hash
        const storedHash = await client.getAsync(otpHashKey);
        if (!storedHash) {
            return { status: false, code: 400, message: "OTP Expired" };
        };

        // 4. Check attempts
        let attempts = parseInt(await client.getAsync(attemptsKey) || 0);
        if (attempts >= 3) {
            await client.setAsync(lockKey, 1);
            await client.expireAsync(lockKey, 300); // lock for 5 minutes
            return { status: false, code: 429, message: "Maximum OTP attempts exceeded" };
        };

        // 5. Compare hashes
        let incomingHash = crypto.createHash('sha256').update(otp).digest('hex');
        if (process.env.ENVIRONMENT == "dev") {
            incomingHash = storedHash;
        };
        if (incomingHash == storedHash) {
            // Success — cleanup
            // await client.delAsync(otpHashKey);
            // await client.delAsync(attemptsKey);
            // await client.delAsync(`otp:${emailKeyBase}`);
            logAllOtpKeys(emailKeyBase, true);
            return { status: true };

        } else {
            // Fail — increment attempts
            attempts += 1;
            await client.setAsync(attemptsKey, attempts);
            await client.expireAsync(attemptsKey, 120); // lock for 2 minutes
            if (attempts >= 3) {
                await client.setAsync(lockKey, 1);
                await client.expireAsync(lockKey, 300); // lock for 5 minutes
                let response = { status: false, code: 429, message: "Maximum OTP attempts exceeded (locked for 5 mins)!" };
                logger.info(response);
                return response;
            }
            return { status: false, code: 400, message: "Invalid OTP" };
        }
    } catch (e) {
        logger.error(e);
        return { status: false, code: 500, message: "Error occurred during execution" };
    };
};

const getUserDynamicRoutes = async (req, res) => {
    try {
        const routes = [{
            name: "Bank Account",
            alias: "bank_account",
            url: `${B2B_URL}/sso/?route=profile&token=`,
        }, {
            name: "Instant Claim",
            alias: "instant_claim",
            url: `${B2B_URL}/sso/?route=my-earnings/instant-claim&token=`,
        }, {
            name: "Claim Cases",
            alias: "claim_cases",
            url: `${B2B_URL}/sso/?route=my-earnings/claim-cases&token=`,
        }, {
            name: "Claim Form",
            alias: "claim_form",
            url: `${B2B_URL}/sso/?route=my-earnings/select-claim&token=`,
        }, {
            name: "Find Payout",
            alias: "find_payout",
            url: `${B2B_URL}/sso/?route=tools/your-payout&token=`,
        }, {
            name: "Find Bank RM",
            alias: "find_banks",
            url: `${B2B_URL}/sso/?route=tools/find-bank-rm&token=`,
        }, 
        {
            name: "Invoices",
            alias: "my_invoices",
            url: `${B2B_URL}/sso/?route=my-earnings/invoices&token=`
        }, {
            name: "Expense Bills",
            alias: "my_bills",
            url: `${B2B_URL}/sso/?route=my-earnings/bills&token=`
        }, 
        {
            name: "Ledger",
            alias: "ledger_report",
            url: `${B2B_URL}/sso/?route=my-earnings/ledger-report&token=`
        }, {
            name: "Web app base url",
            alias: "web_app_base_url",
            url: `${B2B_URL}/`
        }]
        ResHelper.apiResponse(res, true, "Success", 200, routes, "");
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
}

const reactivateUser = async (req, res, next) => {
    try {
        const { error } = UserValidationV1.reactivateUser.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
            return;
        }

        let { user_id } = req.body;

        let user = await UserService.findUserByUserId(user_id);
        if (!user) {
            ResHelper.apiResponse(res, false, "User does not exist", 400, {}, "");
        } else {
            const oldUser = user;
            await UserService.reactivateUser(user_id);
            const newUser = await UserService.findUserByUserId(user_id);
            await safeKafkaUserEvent({
                event: "user_reactivated",
                from: pickUserForKafkaLog(oldUser),
                to: pickUserForKafkaLog(newUser),
                ref_id: user_id,
                createdBy: req?.loggedInUser?.id
            });
            ResHelper.apiResponse(res, true, "Success", 201, {}, "");
        }
        
    } catch (e) {
        logger.error("Error in reactivateUser:", e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
}


const bulkUploadRmUsers = async (req, res) => {
    try {
        const { base64, file_name } = req.body;

        if (!base64 || !file_name) {
            return ResHelper.apiResponse(res, false, "base64 and file_name are required", 400, {}, "");
        }

        // Check if file already exists in logs
        const fileExists = await LeadLogService.checkFileAlreadyExists(req.loggedInUser.id, file_name, 'rm_user_upload');
        if (fileExists) {
            return ResHelper.apiResponse(res, false, "Same file name already uploaded", 400, {}, "");
        }

        // Parse Excel
        const buf = Buffer.from(base64, 'base64');
        const sheet = await xlsx.read(buf, { type: 'buffer' });
        
        let sheetNames = sheet.SheetNames;
        const json = xlsx.utils.sheet_to_json(sheet.Sheets[sheetNames[0]]);

        if (!json || json.length === 0) {
            return ResHelper.apiResponse(res, false, "Uploaded file has no data rows", 400, {}, "");
        }

        // Queue job
        await uploadRmUsersQueue.add({
            json,
            file_name,
            userId: req.loggedInUser.id
        });

        return ResHelper.apiResponse(res, true, "File upload queued successfully", 200, {}, "");

    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

const getSampleTemplateData = async (req, res) => {
    try {
        const { error } = UserValidationV1.getSampleTemplateData.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        }

        const { key } = req.body;
        const templates = require('../../../helpers/constantdata/sampleTemplates.json');

        const template = templates[key];
        if (!template) {
            return ResHelper.apiResponse(res, false, "Invalid sample template key", 400, {}, "");
        }

        return ResHelper.apiResponse(res, true, "Success", 200, template, "");
    } catch (err) {
        logger.error(err);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};


module.exports = {
    markAllasReadNotification,
    getUserPushNotificationLogsReaded,
    signUpCEO,
    loginCEO,
    loginCEOGet,
    loginCEOVerifyOtp,
    checkDevice,
    logout,
    changePassword,
    changePasswordNew,
    addUser,
    validateOtp,
    getAllUsers,
    getAllRmUsers,
    createRmUser,
    deleteRmUser,
    getProductDropdown,
    resendOtp,
    getRoles,
    deleteUser,
    updateUser,
    getParentRole,
    getChildRoles,
    getUserByRole,
    getUserById,
    getUserTrustedDevices,
    revokeTrustedDeviceHandler,
    resetPasswordLink,
    resetPassword,
    resetPasswordLinkUrl,
    verifyResetPasswordLink,
    changePasswordByAdmin,
    updateStatus,
    getUserDsaProfile,
    updatePayoutStatus,
    updateBankStatus,
    updateBackendAccessStatus,
    updateBankFilePayoutAccessStatus,
    addCallerId,
    updateCallerId,
    getCallerId,
    clickToCall,
    despositionWebhook,
    getAllCallerId,
    getUserActivityLogs,
    updateBankFileAccessStatus,
    getUserByBusinessHead,
    getAllBlacklistedUsers,
    insertBlacklistedUser,
    deleteBlacklistedUser,
    sendSocketNotificationCRM,
    bulkApproveRMUser,
    getRmUserByPhone,
    getRmUserByEmail,
    getUserPushNotificationLogs,
    markasReadNotification,
    sendOTPToEmail,
    verifyOTPEmail,
    getUserDynamicRoutes,
    reactivateUser,
    getTelecallerDailyCapacity,
    getTelecallerDailyCapacityHistory,
    updateTelecallerDailyCapacity,
    bulkUploadRmUsers,
    getSampleTemplateData
};


