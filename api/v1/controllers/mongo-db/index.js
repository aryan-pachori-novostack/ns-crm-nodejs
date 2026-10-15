const connectToMongoDB = require('../../../services/mongo-new');
const { logger } = require("../../../helpers/logger");
const { getDsaParentRecursively } = require('../../../services/dsa-services');
const { _db2 } = require('../../../../models');
const { QueryTypes } = require('sequelize');
const { getTableNameFromLoanType } = require('../../../helpers/commonhelper');
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let DSAService = require(_pathconst.ServicesPath.DSAService);
let DSAValidationV1 = require(_pathconst.ReqModelsPath.DSAValidationV1);
let ProductServices = require(_pathconst.ServicesPath.ProductServices);

// ============================================================================================ //
const updateHierarchyName = async () => {
    let offset = 0;
    const limit = 1000;

    while (true) {
        let query = `SELECT dsa_mobile_number FROM ru_direct_selling_agents WHERE hierarchy_crm IS NULL LIMIT ${limit} OFFSET ${offset}`;
        let dsa = await _db2.query(query, { type: QueryTypes.SELECT });

        if (!dsa.length) break; // Stop when no more records are found

        let updates = [];

        for (let i = 0; i < dsa.length; i++) {
            if (dsa[i]?.dsa_mobile_number) {
                let result = await getDsaParentRecursively(dsa[i]?.dsa_mobile_number, "full_name");
                if (result?.toString()?.length) {
                    updates.push([result.toString(), dsa[i]?.dsa_mobile_number]);
                }
            }
        }

        if (updates.length) {
            let updateQuery = `UPDATE ru_direct_selling_agents SET hierarchy_crm = ? WHERE dsa_mobile_number = ?`;
            await Promise.all(updates.map(([hierarchy_crm, dsa_mobile_number]) =>
                _db2.query(updateQuery, { replacements: [hierarchy_crm, dsa_mobile_number], type: QueryTypes.UPDATE })
            ));
        }

        console.log(`<======== Processed ${offset + dsa.length} records ========>`);
        offset += limit;
    }

    console.log("<======== End of loop ========>");
};


const updateHierarchy = async () => {
    if (!global.db) {
        await connectToMongoDB();
    }

    const collection = global.db.collection("mis");

    let offset = 0;
    const limit = 1;

    while (true) {
        const result = await collection.find({
            $and: [
                { custom_status: { $ne: "processed" } },
                { created_at: { $lt: new Date("2025-02-13T00:00:00Z") } }
            ]
        })
            .sort({ created_at: 1 })
            .skip(offset)
            .limit(limit)
            .toArray();

        if (result.length === 0) {
            console.log("No more records to process.");
            break;
        }

        const record = result[0];
        await performOperation(record, offset);
        offset++;
    }
};

const performOperation = async (record, offset) => {
    let query = ` select dsa_id FROM ${getTableNameFromLoanType(record?.loan_type, "table_name")} a2 where application_id = '${record?.application_id}' `;
    let dsa_id = await _db2.query(query, { type: QueryTypes.SELECT });
    dsa_id = dsa_id[0]?.dsa_id;

    if (!global.db) {
        await connectToMongoDB();
    }

    const collection = global.db.collection("mis");

    if (dsa_id) {
        let recursive = `SELECT dsa_id FROM ru_direct_selling_agents WHERE dsa_id IN (
        WITH RECURSIVE DSAHierarchy AS (
            SELECT dsa_mobile_number, partner_code, dsa_id
            FROM ru_direct_selling_agents
            WHERE dsa_id = ?
            UNION ALL
            SELECT t.dsa_mobile_number, t.partner_code, t.dsa_id
            FROM ru_direct_selling_agents t
            INNER JOIN DSAHierarchy d ON t.dsa_mobile_number = d.partner_code
            WHERE t.partner_code IS NOT NULL
        )
        SELECT dsa_id FROM DSAHierarchy
    )`;
        let data = await _db2.query(recursive, { replacements: [dsa_id], type: QueryTypes.SELECT });
        data = data?.map((obj) => obj?.dsa_id);
        data?.push("30468787");

        collection.updateOne(
            { application_id: record?.application_id, lender: record?.lender },
            { $set: { users_new: data, users: data, user_id: dsa_id, custom_status: "processed" } }
        );
    }

    else {

        const tableObj = {
            lnt_pl: "ru_lt_personal_loan_applications",
            paysense_pl: "ru_pay_u_personal_loan_applications",
            bajaj_pl: "ru_bajaj_finance_personal_loan_applications",
            prefer_pl: "ru_credit_vidya_personal_loan_applications",
            prefr: "ru_credit_vidya_personal_loan_applications",
            prefr_pl: "ru_credit_vidya_personal_loan_applications",
            piramal_lap: "ru_piramal_lap_applications",
            piramal_hl: "ru_piramal_home_loan_applications"
        };

        if (tableObj[record?.lender]) {
            let query = ` select dsa_mobile_number FROM ${tableObj[record?.lender]} a2 where application_id = '${record?.application_id}' `;
            let dsa_mobile_number = await _db2.query(query, { type: QueryTypes.SELECT });
            dsa_mobile_number = dsa_mobile_number[0]?.dsa_mobile_number;

            if (dsa_mobile_number) {
                let recursive = `SELECT dsa_id FROM ru_direct_selling_agents WHERE dsa_id IN (
                    WITH RECURSIVE DSAHierarchy AS (
                        SELECT dsa_mobile_number, partner_code, dsa_id
                        FROM ru_direct_selling_agents
                        WHERE dsa_mobile_number = ?
                        UNION ALL
                        SELECT t.dsa_mobile_number, t.partner_code, t.dsa_id
                        FROM ru_direct_selling_agents t
                        INNER JOIN DSAHierarchy d ON t.dsa_mobile_number = d.partner_code
                        WHERE t.partner_code IS NOT NULL
                    )
                    SELECT dsa_id FROM DSAHierarchy
                )`;
                let data = await _db2.query(recursive, { replacements: [dsa_mobile_number], type: QueryTypes.SELECT });
                data = data?.map((obj) => obj?.dsa_id);
                data?.push("30468787");

                collection.updateOne(
                    { application_id: record?.application_id, lender: record?.lender },
                    { $set: { users_new: data, users: data, user_id: data[0], custom_status: "processed" } }
                );
            } else {
                collection.updateOne(
                    { application_id: record?.application_id, lender: record?.lender },
                    { $set: { users_new: "old_integration", users: "", user_id: "", custom_status: "processed" } }
                );
            }

        } else {
            collection.updateOne(
                { application_id: record?.application_id, lender: record?.lender },
                { $set: { users_new: "old_integration", users: "", user_id: "", custom_status: "processed" } }
            );
        }
    }
};

// updateHierarchy();
// updateHierarchyName();-

// ============================================================================================ //

exports.getYearlyMisMongoDB = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getYearlyMisMongoDB.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            if (!global.db) {
                await connectToMongoDB();
            }

            const collection = global.db.collection("mis");
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();

            const currentFinancialYear = currentMonth < 4 ? currentYear - 1 : currentYear;

            const pipeline = [
                { $match: { created_at: { $exists: true } } }, // Ensure created_at exists
                {
                    $addFields: {
                        month: { $month: "$created_at" },
                        year: { $year: "$created_at" }
                    }
                },
                {
                    $addFields: {
                        financial_year: {
                            $cond: [
                                { $lt: ["$month", 4] },
                                { $subtract: ["$year", 1] },
                                "$year"
                            ]
                        },
                        financial_month: {
                            $cond: [
                                { $lt: ["$month", 4] },
                                { $add: ["$month", 9] },
                                { $subtract: ["$month", 3] }
                            ]
                        }
                    }
                },
                {
                    $match: { financial_year: currentFinancialYear }
                },
                {
                    $group: {
                        _id: { financial_month: "$financial_month", financial_year: "$financial_year" },
                        total_rejected: {
                            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
                        },
                        total_disbursed: {
                            $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, 1, 0] }
                        },
                        total_approved: {
                            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
                        },
                        total_in_progress: {
                            $sum: {
                                $cond: [{
                                    $or: [{ $in: ["$status", ["pending", null]] }]
                                }, 1, 0]
                            }
                        },
                        total_disbursed_amount: {
                            $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, "$disbursed_amount", 0] }
                        },
                        total_approved_amount: {
                            $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$approved_amount", 0] }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        financial_month: "$_id.financial_month",
                        financial_year: "$_id.financial_year",
                        month_name: {
                            $arrayElemAt: [
                                [
                                    "", "April", "May", "June", "July", "August", "September", "October",
                                    "November", "December", "January", "February", "March"
                                ],
                                "$_id.financial_month"
                            ]
                        },
                        total_rejected: 1,
                        total_disbursed: 1,
                        total_approved: 1,
                        total_in_progress: 1,
                        total_disbursed_amount: 1,
                        total_approved_amount: 1
                    }
                },
                {
                    $addFields: {
                        month_with_year: { $concat: ["$month_name", " ", { $toString: "$financial_year" }] }
                    }
                },
                {
                    $sort: { financial_month: 1 }
                }
            ];

            const data = await collection.aggregate(pipeline).toArray();

            // finalize and format mis
            const result = {};
            data.forEach(item => {
                if (item.month_name !== null) {
                    const mainObj = [{
                        total_rejected: item.total_rejected,
                        total_disbursed: item.total_disbursed,
                        total_approved: item.total_approved,
                        total_in_progress: item.total_in_progress,
                        total_disbursed_amount: item.total_disbursed_amount,
                        total_approved_amount: item.total_approved_amount
                    }];
                    result[item.month_name] = {
                        disbursed: mainObj,
                        login: mainObj
                    };
                }
            });

            ResHelper.apiResponse(res, true, "Success", 201, result, "");
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

exports.getMisMongoDB = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getMisMongoDB.validate(req.body);
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 401, {}, "");
        } else {
            if (!global.db) {
                await connectToMongoDB();
            };

            // normal mis
            let { dsa_mobile_number, pageNumber, pageSize, lender, loan_type, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter } = req?.body;
            if (dsa_mobile_number) {
                req.loggedInUser.userPhone = dsa_mobile_number;
            };

            // combined mis filters
            let { is_combined_mis, joiningDateFilterStart, joiningDateFilterEnd, bhCode, utm_main_source, is_export, city, state, status, sub_status } = req?.body;
            if (!is_combined_mis) {
                if (!Boolean(lender && loan_type)) {
                    return ResHelper.apiResponse(res, false, "Product and Loan Type cannot be empty.", 400, {}, "");
                };
            };
            let where = "";
            if (joiningDateFilterStart) {
                where += ` and DATE(c.created_at)  between DATE("${joiningDateFilterStart}") and DATE("${joiningDateFilterEnd}") `;
            };
            if (bhCode) {
                where += ` and c.business_head_code like '%${bhCode}%' `;
            };
            if (utm_main_source) {
                where += ` and c.utm_main_source like '%${utm_main_source}%' `;
            };
            if (city) {
                where += ` and c.home_address_city like '%${city}%' `;
            };
            if (state) {
                where += ` and c.home_address_state like '%${state}%' `;
            };
            if (status) {
                where += ` and c.dsa_status like '%${status}%' `;
            };
            if (sub_status) {
                where += ` and c.dsa_sub_status like '%${sub_status}%' `;
            };
            where += ` and c.signup_steps_completed >= 4 `;

            // get users
            let allDsa = await DSAService.getDirectDsaForMis(req?.loggedInUser?.userPhone, pageSize * pageNumber, is_combined_mis ? pageSize : null, Boolean(dsa_mobile_number), where, is_combined_mis);
            let { records, totalRecords } = allDsa;

            // get mis
            const collection = global.db.collection("mis");
            const promises = records.map(async ({ dsa_mobile_number, dsa_id, dsa, created_at, utm_main_source, home_address_city, home_address_state, business_head_name, dsa_status, dsa_sub_status, }) => {
                const query = {
                    users: dsa_id,
                    created_at: startDateLoginFilter ? {
                        $gte: new Date(startDateLoginFilter),
                        $lte: new Date(endDateLoginFilter)
                    } : { $exists: true },

                    disbursed_date: startDateFilter ? {
                        $gte: new Date(startDateFilter),
                        $lte: new Date(endDateFilter)
                    } : { $exists: true },
                };

                if (loan_type) {
                    query["loan_type"] = loan_type;
                };

                if (lender) {
                    query["lender"] = lender;
                };

                const pipeline = [
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            total_rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
                            total_disbursed: { $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, 1, 0] } },
                            total_approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
                            total_in_progress: { $sum: { $cond: [{ $in: ["$status", ["pending", null]] }, 1, 0] } },
                            total_disbursed_amount: { $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, { $ifNull: ["$disbursed_amount", 0] }, 0] } },
                            total_approved_amount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, { $ifNull: ["$approved_amount", 0] }, 0] } }
                        }
                    }
                ];

                // finalize and format mis
                const result = await collection.aggregate(pipeline).toArray();
                const commonKeys = {
                    dsa_id,
                    dsa_mobile_number,
                    dsa,
                    expanded: false,
                    created_at,
                    utm_main_source,
                    home_address_city,
                    home_address_state,
                    business_head_name,
                    dsa_status,
                    dsa_sub_status,
                };
                const data = result.length > 0
                    ?
                    { ...commonKeys, ...result[0] }
                    :
                    {
                        ...commonKeys,
                        total_rejected: 0,
                        total_disbursed: 0,
                        total_approved: 0,
                        total_in_progress: 0,
                        total_disbursed_amount: 0,
                        total_approved_amount: 0
                    };
                let { _id, ...rest } = data
                return rest;
            });

            const results = await Promise.all(promises);
            let data = results?.filter((obj) => obj?.dsa_mobile_number == req?.loggedInUser?.userPhone);
            let childs = results?.filter((obj) => obj?.dsa_mobile_number != req?.loggedInUser?.userPhone);
            data = dsa_mobile_number ? { records: childs, totalRecords } : { records: pageNumber == 0 ? [data[0], ...childs] : childs, totalRecords };
            data.records = data?.records?.sort((a, b) => a.total_disbursed_amount < b.total_disbursed_amount ? 1 : -1);
            return ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (error) {
        logger.error(error);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getCityWiseMisMongoDB = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getMisMongoDB.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 401, {}, "");
        } else {
            if (!global.db) {
                await connectToMongoDB();
            };

            // normal mis
            let { dsa_mobile_number, pageNumber, pageSize, lender, loan_type, startDateFilter, endDateFilter, startDateLoginFilter, endDateLoginFilter } = req?.body;
            if (dsa_mobile_number) {
                req.loggedInUser.userPhone = dsa_mobile_number;
            };

            // get users
            let allDsa = await DSAService.getDirectDsaForMis(req?.loggedInUser?.userPhone, pageSize * pageNumber, "", Boolean(dsa_mobile_number));
            let { records, totalRecords } = allDsa;

            // get mis
            const collection = global.db.collection("mis");
            // collection.createIndex({ loan_type: 1, lender: 1, users: 1 })
            const promises = records.map(async ({ dsa_mobile_number, dsa_id, dsa }) => {
                const query = {
                    users: dsa_id,
                    created_at: startDateLoginFilter ? {
                        $gte: new Date(startDateLoginFilter),
                        $lte: new Date(endDateLoginFilter)
                    } : { $exists: true },

                    disbursed_date: startDateFilter ? {
                        $gte: new Date(startDateFilter),
                        $lte: new Date(endDateFilter)
                    } : { $exists: true },
                };

                if (loan_type) {
                    query["loan_type"] = loan_type;
                };

                if (lender) {
                    query["lender"] = lender;
                };

                const pipeline = [
                    { $match: query },
                    {
                        $group: {
                            _id: "$city", // group by city
                            total_rejected: {
                                $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
                            },
                            total_disbursed: {
                                $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, 1, 0] }
                            },
                            total_approved: {
                                $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
                            },
                            total_in_progress: {
                                $sum: {
                                    $cond: [{
                                        $or: [
                                            { $in: ["$status", ["pending", null]] }
                                        ]
                                    }, 1, 0]
                                }
                            },
                            total_disbursed_amount: {
                                $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, "$disbursed_amount", 0] }
                            },
                            total_approved_amount: {
                                $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$approved_amount", 0] }
                            }
                        }
                    }
                ];

                // finalize and format mis
                const result = await collection.aggregate(pipeline).toArray();
                const data = result.length > 0
                    ?
                    {
                        dsa_id,
                        dsa_mobile_number,
                        dsa,
                        city_data: result,
                    }
                    :
                    {
                        dsa_id,
                        dsa_mobile_number,
                        dsa,
                        city_data: []
                    };
                let { _id, ...rest } = data
                return rest;
            });

            const results = await Promise.all(promises);
            let data = results?.filter((obj) => obj?.dsa_mobile_number == req?.loggedInUser?.userPhone);
            let childs = results?.filter((obj) => obj?.dsa_mobile_number != req?.loggedInUser?.userPhone);
            data = dsa_mobile_number ? { records: childs, totalRecords } : { records: pageNumber == 0 ? [data[0], ...childs] : childs, totalRecords };
            data.records = data?.records[0]?.city_data?.length ? data.records : [];
            data.totalRecords = data?.records[0]?.city_data?.length ? data.totalRecords : 0;
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getLenderBusinessReport = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getMisMongoDB.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 401, {}, "");
        } else {
            if (!global.db) {
                await connectToMongoDB();
            };
            let { pageNumber, pageSize } = req?.body;

            let allDsa = await DSAService.getDirectDsaForMis(req?.loggedInUser?.userPhone, pageSize * pageNumber, pageSize,);
            let { records, totalRecords } = allDsa;

            // get mis
            const collection = global.db.collection("mis");
            const promises = records.map(async ({ dsa_mobile_number, dsa_id, dsa }) => {

                const currentDate = new Date();
                const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const firstOfYear = new Date(currentDate.getFullYear(), 0, 1);
                const dateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

                const queries = {
                    ftd: {
                        users: dsa_id,
                        created_at: { $gte: dateOnly }
                    },
                    mtd: {
                        users: dsa_id,
                        created_at: {
                            $gte: firstOfMonth,
                            $lte: currentDate
                        }
                    },
                    ytd: {
                        users: dsa_id,
                        created_at: {
                            $gte: firstOfYear,
                            $lte: currentDate
                        }
                    }
                };

                const createPipeline = (dateFilter) => [
                    { $match: queries[dateFilter] },
                    {
                        $group: {
                            _id: null,
                            total_rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
                            total_disbursed: { $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, 1, 0] } },
                            total_approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
                            total_in_progress: { $sum: { $cond: [{ $in: ["$status", ["pending", null]] }, 1, 0] } },
                            total_disbursed_amount: {
                                $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, "$disbursed_amount", 0] }
                            },
                            total_progress_amount: {
                                $sum: { $cond: [{ $in: ["$status", ["pending", null]] }, "$applied_amount", 0] }
                            }
                        }
                    }
                ];

                const [ftdResult, mtdResult, ytdResult] = await Promise.all([
                    collection.aggregate(createPipeline('ftd')).toArray(),
                    collection.aggregate(createPipeline('mtd')).toArray(),
                    collection.aggregate(createPipeline('ytd')).toArray()
                ]);

                const formatResults = (result) => result.length > 0
                    ? { dsa_id, dsa_mobile_number, dsa, ...result[0] }
                    : { dsa_id, dsa_mobile_number, dsa };

                const ftdData = formatResults(ftdResult);
                const mtdData = formatResults(mtdResult);
                const ytdData = formatResults(ytdResult);

                return {
                    dsa_id,
                    dsa_mobile_number,
                    dsa,
                    ftd: ftdData,
                    mtd: mtdData,
                    ytd: ytdData
                };
            });

            const results = await Promise.all(promises);
            let data = results?.filter((obj) => obj?.dsa_mobile_number == req?.loggedInUser?.userPhone);
            let childs = results?.filter((obj) => obj?.dsa_mobile_number != req?.loggedInUser?.userPhone);
            data = { records: pageNumber == 0 ? [data[0], ...childs] : childs, totalRecords };
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getMonthlyComparision = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getMonthlyComparision.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 401, {}, "");
        } else {
            if (!global.db) {
                await connectToMongoDB();
            };
            let { pageNumber, pageSize, month1, month2, loan_type, lender, dsa_mobile_number } = req?.body;

            if (dsa_mobile_number) {
                req.loggedInUser.userPhone = dsa_mobile_number
            };

            let allDsa = await DSAService.getDirectDsaForMis(req?.loggedInUser?.userPhone, pageSize * pageNumber, pageSize,);
            let { records, totalRecords } = allDsa;

            // get mis
            const collection = global.db.collection("mis");
            const promises = records.map(async ({ dsa_mobile_number, dsa_id, dsa }) => {
                const getDateRange = (month) => {
                    const [year, monthIndex] = month.split("-").map(Number);
                    const startOfMonth = new Date(year, monthIndex - 1, 1);
                    const endOfMonth = new Date(year, monthIndex, 0); // Last day of the month.
                    return { $gte: startOfMonth, $lte: endOfMonth };
                };
                // collection.createIndex({ created_at: -1 })
                // Create queries for the specified months
                const queries = {
                    month1: {
                        users: dsa_id,
                        created_at: getDateRange(month1)
                    },
                    month2: {
                        users: dsa_id,
                        created_at: getDateRange(month2)
                    }
                };

                if (loan_type) {
                    queries["month1"]["loan_type"] = loan_type;
                    queries["month2"]["loan_type"] = loan_type;
                };

                if (lender) {
                    queries["month1"]["lender"] = lender;
                    queries["month2"]["lender"] = lender;
                };

                const createPipeline = (dateFilter) => [
                    { $match: queries[dateFilter] },
                    {
                        $group: {
                            _id: lender,
                            total_rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
                            total_disbursed: { $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, 1, 0] } },
                            total_approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
                            total_in_progress: { $sum: { $cond: [{ $in: ["$status", ["pending", null]] }, 1, 0] } },
                            total_disbursed_amount: {
                                $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, "$disbursed_amount", 0] }
                            },
                            total_progress_amount: {
                                $sum: { $cond: [{ $in: ["$status", ["pending", null]] }, "$applied_amount", 0] }
                            }
                        }
                    }
                ];

                const [month1Result, month2Result] = await Promise.all([
                    collection.aggregate(createPipeline("month1")).toArray(),
                    collection.aggregate(createPipeline("month2")).toArray()
                ]);

                return {
                    dsa_id,
                    dsa_mobile_number,
                    dsa,
                    month1: month1Result[0] || {},
                    month2: month2Result[0] || {}
                };
            });

            const results = await Promise.all(promises);
            let data = results?.filter((obj) => obj?.dsa_mobile_number == req?.loggedInUser?.userPhone);
            let childs = results?.filter((obj) => obj?.dsa_mobile_number != req?.loggedInUser?.userPhone);
            data = { records: pageNumber == 0 ? [data[0], ...childs] : childs, totalRecords };
            // data.records = data?.records?.sort((a, b) => a.month2.total_disbursed_amount < b.month2.total_disbursed_amount ? 1 : -1);
            ResHelper.apiResponse(res, true, "Success", 201, data, "");
        }
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getBusinessDetailsForDsa = async (req, res) => {
    try {
        const { error } = DSAValidationV1.getBusinessDetailsForDsa.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 401, {}, "");
        } else {
            if (!global.db) {
                await connectToMongoDB();
            };

            const { month, dsa_mobile_number } = req?.body;
            const dsa = await DSAService?.getDsaFullDetailsPhone(dsa_mobile_number);

            // get mis
            const collection = global.db.collection("mis");
            const getDateRange = (month) => {
                const [year, monthIndex] = month.split("-").map(Number);
                const startOfMonth = new Date(year, monthIndex - 1, 1);
                const endOfMonth = new Date(year, monthIndex, 0); // Last day of the month.
                return { $gte: startOfMonth, $lte: endOfMonth };
            };

            const createPipeline = () => [
                {
                    $match: {
                        users: dsa?.dsa_id,
                        created_at: getDateRange(month)
                    }
                },
                {
                    $group: {
                        _id: "$lender",
                        loan_type: { "$first": "$loan_type" },
                        total_rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
                        total_disbursed: { $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, 1, 0] } },
                        total_approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
                        total_in_progress: { $sum: { $cond: [{ $in: ["$status", ["pending", null]] }, 1, 0] } },
                        total_disbursed_amount: {
                            $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, "$disbursed_amount", 0] }
                        },
                        total_progress_amount: {
                            $sum: { $cond: [{ $in: ["$status", ["pending", null]] }, "$applied_amount", 0] }
                        }
                    }
                }
            ];

            let report = await collection.aggregate(createPipeline()).toArray();
            ResHelper.apiResponse(res, true, "Success", 201, report, "");
        }
    } catch (error) {
        console.log(error);
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

// mis realted ends


const updateMongoData = async () => {
    let insert = true;
    let loan_type = "education_loan";
    try {
        // mongo connection
        if (!global.db) {
            await connectToMongoDB();
        };
        const collection = global.db.collection("mis");

        let query = ' select p.product_vendor, a.updated_at, dsa.dsa_mobile_number, a.approved_loan_amount, a.created_at, meta.approved_date, meta.disbursed_date as disbursed_amt_date, d.address_city, d.address_state, d.address_pincode, a.disbursed_loan_amount, a.applied_loan_amount, a.application_id, a.external_id, a.stage, a.sub_stage, a.status_description, a.status from ru_education_loan_applications a left join ru_customers d on a.customer_id = d.customer_id left join ru_direct_selling_agents dsa on a.dsa_id = dsa.dsa_id left join ru_education_loan_application_metas meta on a.application_id = meta.application_id left join `RUService`.ru_loans_products p on p.id = a.product_id group by a.application_id ';
        // let query = " select p.product_vendor, a.updated_at, dsa.dsa_mobile_number, d.address_city, d.address_state, d.address_pincode, a.created_at, a.application_id, a.external_id, a.stage, a.sub_stage, a.status_description, a.status from ru_cc_applications a inner join ru_customers d on a.customer_id = d.customer_id inner join ru_direct_selling_agents dsa on dsa.dsa_id = a.dsa_id left join `RUService`.ru_loans_products p on p.id = a.product_id group by a.application_id ";
        let application = await _db2.query(query, { type: QueryTypes.SELECT });

        let applicationIds = application.map(app => app.application_id);
        let existing = await collection.find({ application_id: { $in: applicationIds } }).toArray();
        let excludeIds = existing.map(app => app.application_id);

        let insertArr = application.filter(app => !excludeIds.includes(app.application_id));

        console.log(insertArr?.length, insertArr);

        if (insert) {
            for (i = 0; i < insertArr?.length; i++) {
                const { updated_at, application_id, stage, sub_stage, status, applied_loan_amount, disbursed_loan_amount, disbursed_date, dsa_mobile_number, approved_loan_amount, created_at, approved_date, disbursed_amt_date, address_city, address_state, address_pincode, product_vendor } = insertArr[i];
                let statusMapping = { "Pending/WIP": "pending", "Rejected": "rejected", "Approved": "approved", "Card Created": "approved", "Disbursed": "disbursed" }
                const users = await getDsaParentRecursively(dsa_mobile_number);

                // insert
                collection.insertOne({
                    stage,
                    sub_stage,
                    status: statusMapping[status],
                    disbursed_date: disbursed_date || null,
                    applied_amount: applied_loan_amount,
                    disbursed_amount: disbursed_loan_amount,
                    status_updated_at: updated_at,
                    updated_at: updated_at,
                    lender: product_vendor,
                    loan_type,
                    application_id,
                    approved_amount: approved_loan_amount,
                    approved_date: approved_date,
                    pincode: address_pincode,
                    city: address_city,
                    created_at: created_at,
                    state: address_state,
                    users
                });
                console.log(insertArr[i], i, insertArr?.length);
            };
        };
    } catch (err) {
        console.log(err);
    };
};

exports.upsertLeadFormField = async (bank_id, product_id, fields) => {
    try {
        if (!global.db) {
            await connectToMongoDB();
        };
        const collection = global.db.collection('lead_form_fields_regex');
        const filter = { bank_id, product_id };
        const update = {
            $set: { fields },
            $setOnInsert: { created_at: new Date() },
        };
        const options = { upsert: true };
        const result = await collection.updateOne(filter, update, options);

        if (result.upsertedCount > 0) {
            console.log(`Inserted new document with ID: ${result.upsertedId._id}`);
        } else {
            console.log(`Updated existing document`);
        }
    } catch (error) {
        logger.error(error);
    }
};

exports.getLeadFormFields = async () => {
    try {
        if (!global.db) {
            await connectToMongoDB();
        };
        const collection = db.collection('lead_form_fields_regex');

        const record = await collection.find({}).toArray();
        return record;
    } catch (error) {
        logger.error(error);
        console.error('Error upserting data:', error);
    }
};

exports.getLeadFormField = async (bank_id, product_id) => {
    try {
        if (!global.db) {
            await connectToMongoDB();
        };
        const collection = db.collection('lead_form_fields_regex');
        const filter = { bank_id, product_id };
        const record = await collection.findOne(filter);

        if (record) {
            console.log('Record found:', record);
            return record;
        } else {
            console.log('No record found with the given bank_id and product_id.');
            return null;
        };

    } catch (error) {
        logger.error(error);
        throw error;
    }
};

exports.getLeadCaseBusinessCategory = async (case_id) => {
    try {
        if (!global.db) {
            await connectToMongoDB();
        };
        const collection = db.collection('lead_form_business_category')
        const filter = { case_id }
        const record = await collection.findOne(filter)
        return record || null
    }
    catch (error) {
        logger.error(error)
        throw error
    }
}

exports.getLeadCaseBusinessCategories = async () => {
    try {
        if (!global.db) {
            await connectToMongoDB();
        };
        const collection = db.collection('lead_form_business_category')
        const record = await collection.find({}).sort({ case_id: 1 }).toArray();
        return record || null
    }
    catch (error) {
        logger.error(error)
        throw error
    }
}

exports.updateLeadCaseBusinessCategoryMongo = async (case_id, first_allowed, second_allowed) => {
    try {
        if (!global.db) {
            await connectToMongoDB();
        };
        const collection = global.db.collection('lead_form_business_category');
        const filter = { case_id };
        const update = {
            $set: {
                first_allowed,
                second_allowed,
                updated_at: new Date()
            }
        };
        const options = { upsert: false };
        const result = await collection.updateOne(filter, update, options);
        return result
    } catch (error) {
        logger.error(error);
        throw error
    }
};

exports.getDsaOverallReport = async (req, res) => {
    try {
        if (!global.db) {
            await connectToMongoDB();
        };

        const collection = global.db.collection("mis");

        const now = new Date();

        const getDateRange = (type) => {
            const today = new Date();
            const startOfToday = new Date(today.setHours(0, 0, 0, 0));
            const endOfToday = new Date(today.setHours(23, 59, 59, 999));

            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfFY = now.getMonth() >= 3
                ? new Date(now.getFullYear(), 3, 1)
                : new Date(now.getFullYear() - 1, 3, 1);

            switch (type) {
                case "FTD":
                    return { $gte: startOfToday, $lte: endOfToday };
                case "MTD":
                    return { $gte: startOfMonth, $lte: endOfToday };
                case "YTD":
                    return { $gte: startOfFY, $lte: endOfToday };
                default:
                    return {};
            }
        };

        const buildReport = async (type, lenders) => {
            const range = getDateRange(type);
            const matchStage = {
                users: req?.dsa?.dsa_id,
                created_at: range,
                lender: lenders ? { $in: lenders } : { $exists: true },
            };

            const pipeline = [
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        total_rejected: {
                            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
                        },
                        total_disbursed: {
                            $sum: { $cond: [{ $eq: ["$status", "disbursed"] }, 1, 0] }
                        },
                        total_approved: {
                            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
                        },
                        total_in_progress: {
                            $sum: {
                                $cond: [{ $in: ["$status", ["pending", null]] }, 1, 0]
                            }
                        },
                        total_disbursed_amount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "disbursed"] },
                                    "$disbursed_amount",
                                    0
                                ]
                            }
                        },
                        total_progress_amount: {
                            $sum: {
                                $cond: [
                                    { $in: ["$status", ["pending", null]] },
                                    "$applied_amount",
                                    0
                                ]
                            }
                        }
                    }
                }
            ];

            const result = await collection.aggregate(pipeline).toArray();
            return result[0] || {
                total_rejected: 0,
                total_disbursed: 0,
                total_approved: 0,
                total_in_progress: 0,
                total_disbursed_amount: 0,
                total_progress_amount: 0
            };
        };

        let product = await ProductServices.getAllProduct(null, null, `where rlp.status=1`);
        let lenders = (product?.records || [])?.map((p) => p.product_vendor);

        const [ftd, mtd, ytd] = await Promise.all([
            buildReport("FTD", lenders),
            buildReport("MTD", lenders),
            buildReport("YTD", lenders)
        ]);

        return ResHelper.apiResponse(res, true, "Success", 200, {
            lenders: lenders,
            report: {
                ftd,
                mtd,
                ytd
            }
        }, "");
    } catch (error) {
        console.log(error);
        logger.error(error);
        return ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

let draftsMongoIndexesReady = false;
async function ensureDraftsMongoIndexes() {
    if (draftsMongoIndexesReady || !global.db) return;
    const collection = global.db.collection('drafts');
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
    const ttlSeconds = parseInt(process.env.MONGO_DRAFT_TTL_SECONDS || '', 10);
    if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
        await collection.createIndex(
            { updated_at: 1 },
            { name: 'drafts_ttl_updated_at', expireAfterSeconds: ttlSeconds }
        );
    }
    draftsMongoIndexesReady = true;
}

exports.saveLeadClaimDraftMongo = async (req, res) => {
    try {
        const { error, value } = DSAValidationV1.saveLeadClaimDraftMongo.validate(req.body, { stripUnknown: true });
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        if (!global.db) {
            await connectToMongoDB();
        }
        await ensureDraftsMongoIndexes();

        const dsaOwnerId = req.dsa && (req.dsa.dsa_id ?? req.dsa.id);
        const user_id = dsaOwnerId ?? req?.loggedInUser?.id;
        if (!user_id) {
            return ResHelper.apiResponse(res, false, "Unauthorized", 401, {}, "");
        }

        const { draft_id, data, label, module } = value;
        const finalDraftId = draft_id || `${user_id}_${Date.now()}`;
        const collection = global.db.collection("drafts");

        await collection.updateOne(
            { draft_id: finalDraftId, user_id, module },
            {
                $set: {
                    module,
                    data,
                    label: label || null,
                    updated_at: new Date()
                },
                $setOnInsert: {
                    draft_id: finalDraftId,
                    user_id,
                    created_at: new Date()
                }
            },
            { upsert: true }
        );

        return ResHelper.apiResponse(res, true, "Draft saved successfully", 200, { draft_id: finalDraftId, module }, "");
    } catch (error) {
        logger.error(error);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.getLeadClaimDraftsMongo = async (req, res) => {
    try {
        const { error, value } = DSAValidationV1.getLeadClaimDraftsMongo.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        if (!global.db) {
            await connectToMongoDB();
        }
        await ensureDraftsMongoIndexes();

        const dsaOwnerId = req.dsa && (req.dsa.dsa_id ?? req.dsa.id);
        const user_id = dsaOwnerId ?? req?.loggedInUser?.id;
        if (!user_id) {
            return ResHelper.apiResponse(res, false, "Unauthorized", 401, {}, "");
        }

        const { module, startDate, endDate, pageNumber, pageSize } = value;
        const rangeStart = new Date(startDate);
        const rangeEnd = new Date(endDate);

        const filter = {
            user_id,
            module,
            updated_at: { $gte: rangeStart, $lte: rangeEnd },
        };

        const collection = global.db.collection("drafts");
        const skip = pageNumber * pageSize;

        const [totalRecords, records] = await Promise.all([
            collection.countDocuments(filter),
            collection
                .find(filter)
                .project({ _id: 0 })
                .sort({ updated_at: -1 })
                .skip(skip)
                .limit(pageSize)
                .toArray(),
        ]);

        const totalPages = pageSize > 0 ? Math.ceil(totalRecords / pageSize) : 0;

        return ResHelper.apiResponse(res, true, "Success", 200, {
            module,
            records,
            totalRecords,
            pageNumber,
            pageSize,
            totalPages,
            startDate: rangeStart.toISOString(),
            endDate: rangeEnd.toISOString(),
        }, "");
    } catch (error) {
        logger.error(error);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

exports.deleteLeadClaimDraftMongo = async (req, res) => {
    try {
        const { error, value } = DSAValidationV1.deleteLeadClaimDraftMongo.validate(req.body, { stripUnknown: true });
        if (error) {
            return ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        }

        if (!global.db) {
            await connectToMongoDB();
        }
        await ensureDraftsMongoIndexes();

        const dsaOwnerId = req.dsa && (req.dsa.dsa_id ?? req.dsa.id);
        const user_id = dsaOwnerId ?? req?.loggedInUser?.id;
        if (!user_id) {
            return ResHelper.apiResponse(res, false, "Unauthorized", 401, {}, "");
        }

        const { draft_id, module } = value;
        const collection = global.db.collection("drafts");
        const result = await collection.deleteOne({ draft_id, user_id, module });

        if (result.deletedCount === 0) {
            return ResHelper.apiResponse(res, false, "Draft not found", 404, {}, "");
        }

        return ResHelper.apiResponse(res, true, "Draft deleted successfully", 200, { draft_id, module }, "");
    } catch (error) {
        logger.error(error);
        return ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};
