const { sequelize, _db2 } = require('../../models');
const { QueryTypes } = require('sequelize');
let uuid = require('node-uuid');
const { logger } = require('../helpers/logger');
const { IST_NOW_SQL } = require('../helpers/sql-time');
let { rolesTree, findParent } = require("../helpers/rolesTree")
const axios = require('axios');

const makeClickToCall = async (data, url, method) => {
    try {
        const config = {
            method: method,
            maxBodyLength: Infinity,
            url: url,
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'Authorization': process.env.CLICK_TO_CALL_API_TOKEN // Using environment variable for Authorization token
            },
            data: data
        };

        const response = await axios.request(config);
        return response.data;
    } catch (error) {
        return { success: false, message: 'Originate failed' }
    }
};

const signUpCEO = async (data) => {
    let query = `insert into users(id,email,name,role,phone,password,payout,bank,createdAt,updatedAt) values(uuid_to_bin(?),?,?,uuid_to_bin(?),?,?,?,?,now(),now()) `
    let bindParams = [uuid.v4(), data.email, data.name, data.role, data.phone, data.password, data.payout, data.bank]
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    query = `select bin_to_uuid(u.id) as id , u.email as email,u.name as name,u.phone as phone  from users u where email = ?`;
    bindParams = [data.email];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return user[0];
};

const addUser = async (data, update_dsa_id) => {
    let query;
    let bindParams;

    if (!update_dsa_id) {
        query = `insert into users(id, email, name, role, phone, password, otp, otpCreatedAt, parent, createdBy, createdAt, updatedAt, dsa_id) values(uuid_to_bin(?), ?, ?, uuid_to_bin(?), ?, ?, ?, ?, uuid_to_bin(?), uuid_to_bin(?), now(), now(), ?) `
        bindParams = [uuid.v4(), data.email, data.name, data.role, data.phone, data.password, data.otp, data.otpCreatedAt, data.parent, data.createdBy, data?.dsa_id || null];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    } else {
        query = `update users set dsa_id = ? and password = ? where phone = ?`;
        bindParams = [data?.dsa_id || null, data.password, data.phone];
        await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    };

    query = `select bin_to_uuid(u.id) as id , u.email as email,u.name as name,u.phone as phone  from users u where email = ?`;
    bindParams = [data.email];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return user[0];
};

const findUserCyclicDependency = async (parent, email) => {
    let query = ` SELECT u2.email as parent_email, bin_to_uuid(u1.id) as id FROM CRMTest.users u1 JOIN CRMTest.users u2 ON u1.parent = u2.id WHERE u1.email = ?`;
    let bindParams = [parent];
    const result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

    if (result.length > 0 && result[0].parent_email === email) {
        return "69";
    };
    return result[0]?.id;
};

const getAllUsers = async (where, search, offset, limit, parentId) => {
    let bindParams = [];
    let query = `WITH RECURSIVE user_hierarchy AS (
    -- Base case: start from each user
    SELECT
        u.id,
        u.name AS hierarchy,
        CAST(BIN_TO_UUID(u.id) AS CHAR(1000)) AS path
    FROM users u
    WHERE ${!parentId ? `u.parent IS NULL` : `u.id = UUID_TO_BIN("${parentId}")`}

    UNION ALL

    -- Recursive step: add children
    SELECT
        child.id,
        CONCAT(uh.hierarchy, ' => ', child.name),
        CONCAT(uh.path, ',', BIN_TO_UUID(child.id))
    FROM users child
    INNER JOIN user_hierarchy uh ON child.parent = uh.id
    WHERE FIND_IN_SET(BIN_TO_UUID(child.id), uh.path) = 0)

    SELECT 
        BIN_TO_UUID(u.id) AS id,
        u.name AS userName,
        u.payout AS payout,
        u.bank AS bank,
        u.backend_access,
        CASE WHEN u.bank_file_payout_access IS NULL THEN 0 ELSE u.bank_file_payout_access END AS bank_file_payout_access,
        u.bank_file_access,
        u.tokenUpdatedAt,
        u.createdAt,
        u.updatedAt,
        u.isDeleted AS isDeleted,
        u.status AS status,
        s.name AS statusName,
        u.email AS userEmail,
        u.phone AS userPhone,
        r.role AS role,
        p.name AS parentName,
        p.email AS parentEmail,
        c.name AS creatorName,
        c.email AS creatorEmail,
        uh.hierarchy AS hierarchy,
        CASE 
            WHEN u.tokenUpdatedAt IS NULL OR u.tokenUpdatedAt = '0000-00-00 00:00:00' THEN 1
            WHEN DATEDIFF(NOW(), u.tokenUpdatedAt) >= 45 THEN 0
            ELSE 1
        END AS login_status,
    
        (
            SELECT JSON_ARRAYAGG(bh.email)
            FROM users bh
            WHERE bh.sales_admin = BIN_TO_UUID(u.id) AND bh.isDeleted = 0
        ) AS business_head
    
    FROM users u
    LEFT JOIN roles r ON u.role = r.id
    LEFT JOIN users p ON u.parent = p.id
    LEFT JOIN users c ON u.createdBy = c.id
    LEFT JOIN status s ON u.status = s.id
    ${!parentId ? `LEFT` : `INNER`} JOIN user_hierarchy uh ON uh.id = u.id `;

    let queryCount = ' SELECT count(*) as totalCount  FROM  users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id left join  status s on u.status= s.id';
    let and = false;
    //apply fiter in the query [Neeraj Singh]
    if (where && where.length != 0) {
        for (let i = 0; i < where.length; i++) {
            if (and == false) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            } else {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (where[i][1] !== null) {
                query += where[i][0] + ' = ? ';
                queryCount += where[i][0] + ' = ? ';
                bindParams.push(where[i][1])
            } else {
                query += where[i][0];
                queryCount += where[i][0];
            }
        }
    }
    //apply search in the query [Neeraj Signh]
    if (search && search.length != 0) {
        for (let i = 0; i < search.length; i++) {
            if (and == false && i == 0) {
                query += ' where ';
                queryCount += ' where ';
                and = true;
            }
            else if (i == 0 && and == true) {
                query += ' and ';
                queryCount += ' and ';
                and = true;
            }
            if (i == 0) {
                query += '  ( ';
                queryCount += ' ( ';
            }
            if (i != 0) {
                query += ' or ';
                queryCount += ' or ';
            }
            query += search[i][0] + ' ' + search[i][1] + ' ? ';
            queryCount += search[i][0] + ' ' + search[i][1] + ' ? ';
            if (i == search.length - 1) {
                query += ' ) ';
                queryCount += ' ) ';
            }
            bindParams.push(search[i][2]);
        }
    }
    query += `order by u.createdAt desc `;
    if (offset || limit) query += ` limit ${offset},${limit} `;
    let users = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    const totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { users: users, totalCount: totalCount[0].totalCount };
};

const getAllRmUsers = async (offset, limit, where) => {
    let is_active = ` case when rbsp.is_active = 1 then "active" when rbsp.is_active = 2 then "red-flag" when rbsp.is_active = 3 then "blacklisted" else "inactive" end as is_active_alias `;
    let query = ` SELECT rbsp.is_approved, p.product_name, rbsp.id, rbsp.city, rbsp.code,rbsp.pincode, rbsp.sp_email, rbsp.sp_mobile, rbsp.reference_id, rbsp.location_tag, rbsp.is_active, rbsp.branch_name, rbsp.sp_id, rbsp.sp_name, rbsp.product_id, rbsp.created_by, rbsp.updated_by, rbsp.created_at, rbsp.updated_at, DATE_FORMAT(rbsp.created_at, '%d-%m-%Y %l:%i %p') AS created_at_display, DATE_FORMAT(rbsp.updated_at, '%d-%m-%Y %l:%i %p') AS updated_at_display, p.loan_type_id, ${is_active} FROM RULoans.ru_branch_sales_people rbsp left join ru_loans_products p on p.id = rbsp.product_id ${where} `;
    let queryCount = ` SELECT COUNT(*) AS count FROM RULoans.ru_branch_sales_people rbsp left join ru_loans_products p on p.id = rbsp.product_id ${where} `;
    query += ` order by rbsp.id desc `;
    if (offset || limit) query += ` limit ${offset},${limit} `;
    let data = await _db3.query(query, { type: QueryTypes.SELECT });

    data = data.map((row, index) => ({ id: index + 1, ...row }));
    let totalCount = await _db3.query(queryCount, { type: QueryTypes.SELECT });

    return { records: data, totalRecords: totalCount[0]?.count };
};

const getRmUserByPhone = async (phone, email) => {
    let query = ` select * from ru_branch_sales_people where ${phone ? `sp_mobile = ?` : `sp_email = ?`} `;
    let bindParams = [phone || email];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data[0] || null;
};

const getRmUserByEmail = async (email, pageNumber = 0, pageSize = 10) => {
    const normalizedEmail = (email || "").trim();
    const safePageNumber = Number.isInteger(pageNumber) && pageNumber >= 0 ? pageNumber : 0;
    const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
    const offset = safePageNumber * safePageSize;
    // Keep query simple: first identify paginated distinct emails, then fetch details.
    const query = `SELECT 
        t.sp_email,
        MAX(t.sp_name) AS sp_name,
        MAX(t.sp_mobile) AS sp_mobile
    FROM RULoans.ru_branch_sales_people t
    INNER JOIN (
        SELECT sp_email
        FROM RULoans.ru_branch_sales_people
        WHERE sp_email IS NOT NULL
          AND sp_email <> ''
          ${normalizedEmail ? `AND sp_email LIKE ?` : ``}
        GROUP BY sp_email
        ORDER BY sp_email
        LIMIT ?, ?
    ) sub ON t.sp_email = sub.sp_email
    GROUP BY t.sp_email
    ORDER BY t.sp_email;`;
    const bindParams = normalizedEmail ? [`%${normalizedEmail}%`, offset, safePageSize] : [offset, safePageSize];
    return await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
};

const updateOrCreateRMUser = async (data) => {
    const {
        email,
        phone,
        name,
        city,
        netsuite_bank_id,
        netsuite_product_id,
        logged_in_user_id
    } = data;

    // Check if the email exists
    let query = `SELECT id FROM ru_branch_sales_people WHERE sp_email = ?`;
    const bindParams = [email];
    const result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let sp_id = result[0]?.id;

    if (sp_id) {
        // Dynamically build the update query for non-null fields
        let updateFields = [];
        let updateValues = [];

        if (email) {
            updateFields.push("sp_email = ?");
            updateValues.push(email);
        }
        if (name) {
            updateFields.push("sp_name = ?");
            updateValues.push(name);
        }
        if (netsuite_bank_id) {
            updateFields.push("netsuite_bank_id = ?");
            updateValues.push(netsuite_bank_id);
        }
        if (netsuite_product_id) {
            updateFields.push("netsuite_product_id = ?");
            updateValues.push(netsuite_product_id);
        }
        if (city) {
            updateFields.push("city = ?");
            updateValues.push(city);
        }
        if (phone) {
            updateFields.push("sp_mobile = ?");
            updateValues.push(phone);
        }
        if (logged_in_user_id) {
            updateFields.push("updated_by = ?");
            updateValues.push(logged_in_user_id);
        }

        // Only update if there are fields to update
        if (updateFields.length > 0) {
            updateFields.push(`updated_at = ${IST_NOW_SQL}`);
            query = `UPDATE ru_branch_sales_people SET ${updateFields.join(", ")} WHERE id = ?`;
            updateValues.push(sp_id);
            await _db2.query(query, { replacements: updateValues, type: QueryTypes.UPDATE });
        }

        return sp_id;
    } else {
        // Insert new record
        query = `
            INSERT INTO ru_branch_sales_people 
            (city, sp_email, sp_name, netsuite_bank_id, netsuite_product_id, sp_mobile, created_by, updated_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${IST_NOW_SQL}, ${IST_NOW_SQL})`;
        const insertValues = [
            city || null,
            email || null,
            name || null,
            netsuite_bank_id || null,
            netsuite_product_id || null,
            phone || null,
            logged_in_user_id || null,
            logged_in_user_id || null,
        ];
        const [insertResult] = await _db2.query(query, { replacements: insertValues, type: QueryTypes.INSERT });
        return insertResult;
    }
};

const getProductDropdown = async (type) => {
    let query = `
        SELECT id, product_name 
        FROM \`RULoans\`.ru_loans_products
    `;
    let products = await _db3.query(query, { type: QueryTypes.SELECT });

    return products;
};

const createRmUser = async (data) => {
    let {
        id,
        city,
        branch_name,
        sp_id,
        sp_name,
        product_id,
        code,
        pincode,
        sp_email,
        sp_mobile,
        reference_id,
        location_tag,
        is_active,
        created_by,
        is_approved
    } = data;

    let query, bindParams;

    if (!id) {
        query = `
            INSERT INTO RULoans.ru_branch_sales_people 
            (is_approved, city, branch_name, sp_id, sp_name, product_id, created_by, updated_by, code, pincode, sp_email, sp_mobile, reference_id, location_tag, is_active, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ${IST_NOW_SQL}, ${IST_NOW_SQL})
        `;
        bindParams = [
            is_approved || 0,
            city || null,
            branch_name || null,
            sp_id || null,
            sp_name || null,
            product_id,
            created_by || null,
            created_by || null,
            code || "",
            pincode || null,
            sp_email || null,
            sp_mobile || null,
            reference_id || null,
            location_tag || null,
            is_active || 1
        ];
    } else {
        query = `
            UPDATE RULoans.ru_branch_sales_people 
            SET is_approved=?, city=?, branch_name=?, sp_id=?, sp_name=?, product_id=?, updated_by=?, code=?, pincode=?, sp_email=?, sp_mobile=?, reference_id=?, location_tag=?, is_active=?, updated_at=${IST_NOW_SQL}
            WHERE id = ?
        `;
        bindParams = [
            is_approved || 0,
            city || null,
            branch_name || null,
            sp_id || null,
            sp_name || null,
            product_id,
            created_by || null,
            code || "",
            pincode || null,
            sp_email || null,
            sp_mobile || null,
            reference_id || null,
            location_tag || null,
            is_active || 1,
            id
        ];
    }

    await _db3.query(query, {
        replacements: bindParams,
        type: QueryTypes.INSERT
    });
};


const deleteRmUser = async (data) => {
    try {
        let { id } = data;

        if (!id) {
            throw new Error('ID must be provided to delete RM user.');
        }

        let query = `DELETE FROM RULoans.ru_branch_sales_people WHERE id = ?`;
        let bindParams = [id];

        let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.DELETE });

        return result;
    } catch (error) {
        console.error("Error in deleteRmUser service:", error);
        throw new Error('Failed to delete RM user');
    }
};



const getUserById = async (id) => {
    let bindParams = [id];
    let query = ' SELECT BIN_TO_UUID(u.id) as id ,u.name as userName,u.isDeleted as isDeleted,u.email as userEmail, CAST(u.phone AS CHAR) AS userPhone, r.role as role, p.name as parentName, p.email as parentEmail, c.name as creatorName, u.tokenUpdatedAt as tokenUpdatedAt, c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  where u.id = uuid_to_bin(?) ';
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return user[0];
};

const findUser = async (email) => {
    try {
        let query = ' SELECT BIN_TO_UUID(u.id) as id ,u.otpCreatedAt as otpCreatedAt,u.status as status,s.name as statusName,u.payout as payout,u.bank as bank, u.bank_file_access, u.bank_file_payout_access,u.isDeleted as isDeleted ,u.tokenUpdatedAt as tokenUpdatedAt,u.password as password,u.name as userName,u.email as userEmail,u.otp as otp,u.dummyPassword as dummyPassword,u.phone as userPhone,r.role as role, r.id as role_id, p.name as parentName, p.email as parentEmail, c.name as creatorName , c.email as creatorEmail, u.is_superadmin, u.backend_access, u.dsa_id as usersDsaId, p.role as parent_role_id, pr.role as parent_role, p.is_superadmin as parent_is_superadmin FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join roles pr on p.role = pr.id left join users c on u.createdBy = c.id  left join status s on u.status = s.id  where u.email=?';
        let bindParams = [email];
        let user = await _db7.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        // Prefer the direct users.dsa_id foreign key over the phone join below --
        // dsa_mobile_number can drift out of sync with the CRM login phone (users.phone),
        // which silently drops a user's own DSA identity (and materialized_path) from the
        // session even though users.dsa_id already points at a valid, matching DSA row.
        //
        // Exception: '9999999999' is a shared placeholder phone used by multiple CRM
        // logins (e.g. business-head accounts) that intentionally rely on the generic
        // "WebsiteCustomer Leads" DSA row's materialized_path for hierarchy visibility --
        // always resolve those via phone match, never via users.dsa_id.
        const dsaCols = 'assigning_payout_percentage, materialized_path_depth, materialized_path, dsa_id';
        let dsa = [];
        if (user[0]?.usersDsaId && user[0]?.userPhone !== '9999999999') {
            query = ` select ${dsaCols} from ru_direct_selling_agents where dsa_id=? `;
            bindParams = [user[0].usersDsaId];
            dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        }

        if (!dsa[0]) {
            query = ` select ${dsaCols} from ru_direct_selling_agents where dsa_mobile_number=? `;
            bindParams = [user[0]?.userPhone];
            dsa = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        }

        if (dsa[0]) {
            user[0]["assigning_payout_percentage"] = dsa[0]["assigning_payout_percentage"];
            user[0]["materialized_path_depth"] = dsa[0]["materialized_path_depth"];
            user[0]["materialized_path"] = dsa[0]["materialized_path"];
            user[0]["dsa_id"] = dsa[0]["dsa_id"];
        };
        delete user[0].usersDsaId;

        return user[0];
    } catch (error) {
        logger.info(error)
    }
};

const findOtherUser = async (email, user_id) => {
    try {
        let query = ' SELECT BIN_TO_UUID(u.id) as id ,u.otpCreatedAt as otpCreatedAt,u.status as status,s.name as statusName,u.payout as payout,u.bank as bank,u.isDeleted as isDeleted ,u.tokenUpdatedAt as tokenUpdatedAt,u.password as password,u.name as userName,u.email as userEmail,u.otp as otp,u.dummyPassword as dummyPassword,u.phone as userPhone,r.role as role ,p.name as parentName, p.email as parentEmail, c.name as creatorName , c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  left join status s on u.status = s.id where u.email=? and u.id <> uuid_to_bin(?) ';
        let bindParams = [email, user_id];
        let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

        // query = 'delete from payouts';
        // user = await sequelize.query(query, { type: QueryTypes.SELECT });

        return user[0];
    } catch (error) {
        console.log(error)
        logger.info(error)
    }
}

const getResetToken = async (id) => {
    let query = ' SELECT BIN_TO_UUID(user_id) as user_id ,reset_token ,created_at from reset_password_link where user_id = uuid_to_bin(?) ';
    let bindParams = [id];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return user[0];
}


const deleteResetToken = async (id) => {
    let query = ' delete from reset_password_link where user_id = uuid_to_bin(?) ';
    let bindParams = [id];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
    return true;
}

const createResetToken = async (id, token) => {
    let query = ' insert into reset_password_link (user_id,reset_token, created_at) values (uuid_to_bin(?),?,?)';
    let bindParams = [id, token, new Date()];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETEm });
    return true;
}

const findUserById = async (id) => {
    let query = ' SELECT BIN_TO_UUID(u.id) as id ,u.otpCreatedAt as otpCreatedAt,u.status as status,s.name as statusName,u.payout as payout,u.bank as bank,u.isDeleted as isDeleted ,u.tokenUpdatedAt as tokenUpdatedAt,u.password as password,u.name as userName,u.email as userEmail,u.otp as otp,u.dummyPassword as dummyPassword,u.phone as userPhone,r.role as role ,p.name as parentName, p.email as parentEmail, c.name as creatorName , c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  left join status s on u.status = s.id where  u.id = uuid_to_bin(?) ';
    let bindParams = [id];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return user[0];
}
const findRole = async (role) => {
    let query = `select bin_to_uuid(r.id) as id , r.role as role from roles r where role = ?`;
    let bindParams = [role];
    let foundRole = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return foundRole[0];

};

const getRoles = async (role) => {
    let query = `select bin_to_uuid(r.id) as id , r.role as role from roles r `;
    let bindParams = [];
    let roles = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return roles;
};

const updateUser = async (where, data) => {
    let query = `update users set email=?,phone=?,role=uuid_to_bin(?),parent=uuid_to_bin(?),updatedAt =now(),name = ? where email = ?`;
    let bindParams = [data.email, data.phone, data.role, data.parent, data.name, where.where.email];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    query = `select bin_to_uuid(u.id) as id , u.email as email,u.name as name,u.phone as phone  from users u where email = ?`;
    bindParams = [data.email];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return user[0];
};

const updateUserWithId = async (where, data) => {
    let query = `update users set email=?,phone=?,role=uuid_to_bin(?),parent=uuid_to_bin(?),updatedAt =now(),name = ? where id = uuid_to_bin(?)`;
    let bindParams = [data.email, data.phone, data.role, data.parent, data.name, where.where.id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    query = `select bin_to_uuid(u.id) as id , u.email as email,u.name as name,u.phone as phone  from users u where id = uuid_to_bin(?)`;
    bindParams = [where.where.id];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return user[0];
};

const updateSalesAdmin = async (business_head, user_email) => {
    let query = `select bin_to_uuid(id) as id from users where email = ?`
    let bindParams = [user_email];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let user_id = user[0]?.id;


    query = `update users set sales_admin = ? where email in (?)`;
    bindParams = [user_id, business_head];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    query = `update users set sales_admin = null where email not in (?) and sales_admin = ?`;
    bindParams = [business_head, user_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

const updateUserOtp = async (where, data) => {
    let query = `update users set otp=?,otpCreatedAt=?,updatedAt =now() where email = ?`;
    let bindParams = [data.otp, data.otpCreatedAt, where.where.email];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

}
const updateUserValidateOtp = async (where, data) => {
    let query = `update users set validatedAt =? where email = ?`;
    let bindParams = [data.otpValidatedAt, where.where.email];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}
const updateUserDelete = async (where, data) => {
    let query = `update users set isDeleted =? where email = ?`;
    let bindParams = [data.isDeleted, where.where.email];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    query = ` update ru_direct_selling_agents set is_blacklisted = ? where email_address = ? `;
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}
const updateUserPassword = async (where, data) => {
    let query = `update users set password =? , dummyPassword =?,tokenUpdatedAt=? where email = ?`;
    let bindParams = [data.password, data.dummyPassword, data.tokenUpdatedAt, where.where.email];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}


const findUserByUserId = async (id) => {
    let query = `
        SELECT
            BIN_TO_UUID(u.id) as user_id,
            u.password as password,
            u.email as email,
            u.phone as phone,
            u.name as userName,
            u.status as status,
            s.name as statusName,
            u.isDeleted as isDeleted,
            u.payout as payout,
            u.bank as bank,
            u.backend_access as backend_access,
            u.bank_file_access as bank_file_access,
            u.bank_file_payout_access as bank_file_payout_access,
            r.role as role,
            p.email as parentEmail,
            p.name as parentName
        FROM users u
        LEFT JOIN roles r ON u.role = r.id
        LEFT JOIN users p ON u.parent = p.id
        LEFT JOIN status s ON u.status = s.id
        WHERE u.id = uuid_to_bin(?)
    `;
    let bindParams = [id];
    let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return user[0];
}

const changePasswordByUserId = async (where, data) => {
    let query = `update users set password =? where id = uuid_to_bin(?)`;
    let bindParams = [data.password, where.where.user_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}
//updateStatus
const updateStatus = async (user_id, status_id, email) => {
    let query = `update users set status =? where id = uuid_to_bin(?)`;
    let bindParams = [status_id, user_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    if (status_id == 1) {
        query = ` update ru_direct_selling_agents set is_blacklisted = ? where email_address = ? `;
        bindParams = [false, email];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    } else {
        query = ` update ru_direct_selling_agents set is_blacklisted = ? where email_address = ? `;
        bindParams = [true, email];
        await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    }
}

const changeUserPassword = async (email, password, tokenUpdatedAt) => {
    let query = `update users set password =? , tokenUpdatedAt =? where email = ?`;
    let bindParams = [password, tokenUpdatedAt, email];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const findUserByPhoneOrEmail = async (email, phone) => {
    try {

        let query = ' SELECT u.dsa_id, BIN_TO_UUID(u.id) as id ,u.otpCreatedAt as otpCreatedAt,u.status as status,s.name as statusName,u.isDeleted as isDeleted ,u.tokenUpdatedAt as tokenUpdatedAt,u.password as password,u.name as userName,u.email as userEmail,u.otp as otp,u.dummyPassword as dummyPassword,u.phone as userPhone,r.role as role ,p.name as parentName, p.email as parentEmail, c.name as creatorName , c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  left join status s on u.status = s.id where u.email=? or u.phone=? ';
        let bindParams = [email, phone];
        let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return user[0];
    } catch (error) {
        console.log(error)
        logger.info(error)
    }
}


const findUserByPhone = async (phone) => {
    try {

        let query = ' SELECT BIN_TO_UUID(u.id) as id ,u.otpCreatedAt as otpCreatedAt,u.status as status,s.name as statusName,u.isDeleted as isDeleted ,u.tokenUpdatedAt as tokenUpdatedAt,u.password as password,u.name as userName,u.email as userEmail,u.otp as otp,u.dummyPassword as dummyPassword,u.phone as userPhone,r.role as role ,p.name as parentName, p.email as parentEmail, c.name as creatorName , c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  left join status s on u.status = s.id where  u.phone=? ';
        let bindParams = [phone];
        let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return user[0];
    } catch (error) {
        console.log(error)
        logger.info(error)
    }
}

const getParentUsersByRole = async (role) => {
    try {
        const parentRole = findParent(rolesTree, role);
        let query = ' SELECT BIN_TO_UUID(u.id) as id ,u.otpCreatedAt as otpCreatedAt,u.status as status,s.name as statusName,u.isDeleted as isDeleted ,u.tokenUpdatedAt as tokenUpdatedAt,u.password as password,u.name as userName,u.email as userEmail,u.otp as otp,u.dummyPassword as dummyPassword,u.phone as userPhone,r.role as role ,p.name as parentName, p.email as parentEmail, c.name as creatorName , c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  left join status s on u.status = s.id where r.role = ? ';
        let bindParams = [parentRole];
        let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return user;
    } catch (error) {
        console.log(error)
        logger.info(error)
    }
}
const getAllUsersWithRolesIn = async (roles) => {
    try {
        let query = ' SELECT BIN_TO_UUID(u.id) as id ,u.otpCreatedAt as otpCreatedAt,u.status as status,s.name as statusName,u.isDeleted as isDeleted ,u.tokenUpdatedAt as tokenUpdatedAt,u.password as password,u.name as userName,u.email as userEmail,u.otp as otp,u.dummyPassword as dummyPassword,u.phone as userPhone,r.role as role ,p.name as parentName, p.email as parentEmail, c.name as creatorName , c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  left join status s on u.status = s.id where r.role in (?) ';
        let bindParams = [roles];
        let user = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
        return user;
    } catch (error) {
        console.log(error)
        logger.info(error)
    }
}

const getUsersByPhones = async (phones = []) => {
    if (!Array.isArray(phones) || !phones.length) {
        return [];
    }

    const query = `
        SELECT
            u.email AS userEmail,
            u.phone AS userPhone
        FROM users u
        WHERE u.phone IN (?)
    `;

    return sequelize.query(query, {
        replacements: [phones],
        type: QueryTypes.SELECT
    });
}

const updateTokenDate = async (email, tokenUpdatedAt) => {
    let query = ' update users set tokenUpdatedAt = ? where email = ? ';
    let bindParams = [tokenUpdatedAt, email];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}
const updateUserPhone = async (email, phone) => {
    let query = ' update users set phone = ? where email = ? ';
    let bindParams = [phone, email];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const getFirstUserByRole = async (role) => {
    let query = ' SELECT BIN_TO_UUID(u.id) as id ,u.status as status,s.name as statusName,u.isDeleted as isDeleted ,u.tokenUpdatedAt as tokenUpdatedAt,u.password as password,u.name as userName,u.email as userEmail,u.otp as otp,u.dummyPassword as dummyPassword,u.phone as userPhone,r.role as role ,p.name as parentName, p.email as parentEmail, c.name as creatorName , c.email as creatorEmail  FROM users u left join roles r on u.role = r.id left join users p on u.parent = p.id left join users c on u.createdBy = c.id  left join status s on u.status = s.id where r.role = ?  ';
    let bindParams = [role];
    let users = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return users[0];
}

const updateBankStatus = async (user_id, status) => {
    let query = ' update users u set bank = ? where id = uuid_to_bin(?) ';
    let bindParams = [status, user_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}


const updatePayoutStatus = async (user_id, status) => {
    let query = ' update users u set payout = ? where id = uuid_to_bin(?) ';
    let bindParams = [status, user_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const updateBackendAccessStatus = async (user_id, status) => {
    let query = ' update users u set backend_access = ? where id = uuid_to_bin(?) ';
    let bindParams = [status, user_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const updateBankFilePayoutAccessStatus = async (user_id, status) => {
    let query = ' update users u set bank_file_payout_access = ? where id = uuid_to_bin(?) ';
    let bindParams = [status, user_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const updateBankFileAccessStatus = async (user_id, status) => {
    let query = ' update users u set bank_file_access = ? where id = uuid_to_bin(?) ';
    let bindParams = [status, user_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const updateOtherUserForSameCallerId = async (user_id, caller_id) => {
    let query = ' update  caller_ids  set has_calling_enabled =? where caller_id = ? and user_id <> ? ';
    let bindParams = [false, caller_id, user_id];
    let callerid = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const getCallerId = async (user_id) => {
    let query = ' select * from  caller_ids where user_id = ? ';
    let bindParams = [user_id];
    let callerid = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return callerid[0];
}

const getUserIdByCallerId = async (caller_id) => {
    let query = ' select ci.*,u.email,u.phone,u.name from  caller_ids  ci left join users u on ci.user_id = bin_to_uuid(u.id) where caller_id = ? and has_calling_enabled  = true ';
    let bindParams = [caller_id];
    let callerid = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return callerid[0];
}


const getAllCallerId = async (mobile, offset, limit) => {
    let query = ' select ci.*,u.email,u.phone,u.name from  caller_ids  ci left join users u on ci.user_id = bin_to_uuid(u.id)  ';
    let queryCount = ' select count(*) as totalCount from  caller_ids  ci left join users u on ci.user_id = bin_to_uuid(u.id)  ';

    let bindParams = [];
    if (mobile) {
        query += ` where u.phone  like '%${mobile}%' `
        queryCount += ` where u.phone  like '%${mobile}%' `
        bindParams.push(mobile);
    }
    query += ` limit ${offset},${limit} `;
    let callerids = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    return { caller: callerids, totalCount: totalCount[0].totalCount };
}

const updateCallerId = async (user_id, caller_id, has_calling_enabled) => {
    let query = ' update caller_ids  set caller_id = ? ,has_calling_enabled = ? where user_id = ? ';
    let bindParams = [caller_id, has_calling_enabled, user_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
}

const addCallerId = async (user_id, caller_id) => {
    let query = ' insert into caller_ids(user_id,caller_id) values(?,?) ';
    let bindParams = [user_id, caller_id];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
}

const clickToCall = async (reciever_mobile, agent_number, user_id) => {
    let data = JSON.stringify({
        "agent_number": agent_number,
        "destination_number": reciever_mobile
    });
    let api = 'https://api-smartflo.tatateleservices.com/v1/click_to_call';
    let api_type = 'post';
    let res = await makeClickToCall(data, api, api_type);
    let has_error = false;
    let error_message = '';
    if (!res.success) {
        has_error = true;
        error_message = res.message;
    }
    res = JSON.stringify(res);

    let query = ` insert into external_api_logs(user_id,api,api_type,header,payload,response,has_error,error_message) values(?,?,?,?,?,?,?,?) `;
    let bindParams = [user_id, api, api_type, '', data, res, has_error, error_message];
    await sequelize.query(query, { type: QueryTypes.INSERT, replacements: bindParams });
    return { has_error, error_message };
};

const getUserActivityLogs = async (offset, limit, id, where) => {
    let query = ` select ul.id, ul.user_id, ul.api, ul.api_type, ul.header, ul.payload, ul.response, ul.error_message, ul.has_error, ul.created_at, ul.updated_at, u.name, u.email from external_api_logs ul left join users u on bin_to_uuid(u.id) = ul.user_id  ${where} `;
    let queryCount = ` select count(*) as count from external_api_logs ul left join users u on bin_to_uuid(u.id) = ul.user_id  ${where} `;

    query += ` order by created_at desc `;
    if (limit) {
        query += ` limit ${offset},${limit} `;
    }

    let records = await sequelize.query(query, { type: QueryTypes.SELECT });
    let totalCount = await sequelize.query(queryCount, { type: QueryTypes.SELECT });
    return { records, totalCount: totalCount[0]?.count }
};

//Blacklisted Users

const checkIfBlacklistedUserExist = async (email, phone) => {
    let query = ` select * from ru_blacklisted_users where user_email = ? or user_phone = ? `;
    let bindParams = [email, phone];
    const data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data[0] || null;
};

const getAllBlacklistedUsers = async (offset, limit, where) => {
    let query = ` select bu.*, u.name as blacklisted_by from ru_blacklisted_users bu left join CRMTest.users u on bin_to_uuid(u.id) = bu.blacklisted_by ${where || ""} `;
    let queryCount = ` select count(*) as count from ru_blacklisted_users bu left join CRMTest.users u on bin_to_uuid(u.id) = bu.blacklisted_by ${where || ""} `;
    if (limit) {
        query += ` limit ${offset}, ${limit} `;
        queryCount += ` limit ${offset}, ${limit} `;
    };
    const records = await _db2.query(query, { type: QueryTypes.SELECT });
    const totalRecords = await _db2.query(queryCount, { type: QueryTypes.SELECT });
    return { records, totalRecords: totalRecords[0]?.count || 0 };
};

const insertBlacklistedUser = async (data) => {
    const { user_phone, user_email, blacklisted_by, comment } = data;
    let query = ` insert into ru_blacklisted_users (user_phone, user_email, blacklisted_by, comments, created_at, updated_at) values(?,?,?,?,?,?) `;
    let bindParams = [user_phone, user_email, blacklisted_by, comment, new Date(), new Date()];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

    query = ` insert into application_logs (application_type, application_id, field, from_value, to_value, updated_by) values (?, ?, ?, ?, ?, uuid_to_bin(?)) `;
    await sequelize.query(query, { replacements: ["backlist_user", "", 'add', user_phone, user_phone, blacklisted_by], type: QueryTypes.INSERT });
    return;
};

const deleteBlacklistedUser = async (data) => {
    const { id, blacklisted_by } = data;
    let query = ` delete from ru_blacklisted_users where id = ? `;
    let bindParams = [id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.DELETE });

    query = ` insert into application_logs (application_type, application_id, field, from_value, to_value, updated_by) values (?, ?, ?, ?, ?, uuid_to_bin(?)) `;
    await sequelize.query(query, { replacements: ["backlist_user", id, 'delete', "", "", blacklisted_by], type: QueryTypes.INSERT });
    return;
};

const bulkApproveRMUser = async (user) => {
    let query = ` update ru_branch_sales_people set is_approved = 1, updated_at = ${IST_NOW_SQL} where id in (?) `;
    let bindParams = [user]
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};

const migrateAllRms = async () => {
    let query = ` select c.fresh_lead_id, m.banker_email, m.sm_email, m.sm_mobile, m.rm_email, m.rm_mobile, c.city, c.netsuite_product_id, c.netsuite_bank_id from ru_fresh_lead_claims c left join ru_fresh_lead_claims_meta m on m.fresh_lead_id = c.fresh_lead_id `;
    const result = await _db2.query(query, { type: QueryTypes.SELECT });

    let updateIds = async (field, value, fresh_lead_id) => {
        let query2 = ` update ru_fresh_lead_claims_meta set ${field} = "${value}" where fresh_lead_id = "${fresh_lead_id}" `;
        await _db2.query(query2, { type: QueryTypes.UPDATE });
    };

    query = ` select c.fresh_lead_id, m.banker_email, m.sm_email, m.sm_mobile, m.rm_email, m.rm_mobile, c.city, c.netsuite_product_id, c.netsuite_bank_id from ru_fresh_lead_claims c left join ru_fresh_lead_claims_meta m on m.fresh_lead_id = c.fresh_lead_id `;
    await _db2.query(query, { type: QueryTypes.SELECT });

    for (let i = 0; i < result?.length; i++) {
        if (result[i]?.banker_email) {
            let id = await updateOrCreateRMUser({
                email: result[i]?.banker_email,
                phone: null,
                name: null,
                city: result[i]?.city || null,
                netsuite_bank_id: result[i]?.netsuite_bank_id || null,
                netsuite_product_id: result[i]?.netsuite_product_id || null,
                logged_in_user_id: null
            });
            updateIds("banker_id", id, result[i]?.fresh_lead_id);
        };

        if (result[i]?.sp_email || result[i]?.sp_mobile) {
            let id = await updateOrCreateRMUser({
                email: result[i]?.sp_email || null,
                phone: result[i]?.sp_mobile || null,
                name: null,
                city: result[i]?.city || null,
                netsuite_bank_id: result[i]?.netsuite_bank_id || null,
                netsuite_product_id: result[i]?.netsuite_product_id || null,
                logged_in_user_id: null
            });
            updateIds("asm_id", id, result[i]?.fresh_lead_id)
        };

        if (result[i]?.rm_email || result[i]?.rm_mobile) {
            await updateOrCreateRMUser({
                email: result[i]?.rm_email || null,
                phone: result[i]?.rm_mobile || null,
                name: null,
                city: result[i]?.city || null,
                netsuite_bank_id: result[i]?.netsuite_bank_id || null,
                netsuite_product_id: result[i]?.netsuite_product_id || null,
                logged_in_user_id: null
            })
        };
    };
};

const isCyclicHierarchyCRM = async (id) => {
    const query = `
    WITH RECURSIVE ancestor_path AS (
        SELECT 
            id,
            parent,
            HEX(id) AS path,
            FALSE AS cycle_detected
        FROM users
        WHERE id = UUID_TO_BIN(?)

        UNION ALL

        SELECT 
            u.id,
            u.parent,
            CONCAT(ap.path, ',', HEX(u.id)),
            FIND_IN_SET(HEX(u.id), ap.path) > 0
        FROM users u
        INNER JOIN ancestor_path ap ON u.id = ap.parent
        WHERE ap.cycle_detected = FALSE
    )
    SELECT path, cycle_detected FROM ancestor_path WHERE id = UUID_TO_BIN(?)`;

    const bindParams = [id, id];

    try {
        let result = await sequelize.query(query, {
            replacements: bindParams,
            type: QueryTypes.SELECT
        });

        const isCycle = result[0]?.cycle_detected;
        return isCycle ? "69" : "0";

    } catch (err) {
        console.log(err);
        // Catch MySQL recursion limit error and treat it as cycle
        if (err.message.includes("Recursive query aborted after")) {
            return "69";
        }

        // Optional: log unexpected error for debugging
        console.error("Unexpected error in isCyclicHierarchyCRM:", err);
        throw err; // or return a safe default if needed
    }
};

const updateTable = async (fields, where, table) => {
    // Extract field keys for the SET clause
    const setKeys = Object.keys(fields);
    const setClause = setKeys.map(key => `${key} = ?`).join(', ');
    
    // Extract WHERE clause keys
    const whereKeys = Object.keys(where);
    const whereClause = whereKeys.map(key => `${key} = ?`).join(' AND ');

    // Prepare query
    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;

    // Bind parameters (fields first, then where conditions)
    const bindParams = [...Object.values(fields), ...Object.values(where)];

    await sequelize.query(query, {
        replacements: bindParams,
        type: QueryTypes.UPDATE
    });

    return;
};

const reactivateUser = async (user_id) => {
    try {
        let updateQuery = `update users set tokenUpdatedAt = NOW(), updatedAt = NOW()  where id = uuid_to_bin(?) AND isDeleted = 0`;
        let bindParams = [user_id];
        await sequelize.query(updateQuery, { replacements: bindParams, type: QueryTypes.UPDATE });        
    } catch (error) {
        logger.error('Error in reactivateUser service:', error);
        throw error;
    }
};

const getTelecallerDailyCapacity = async ({ telecaller_id, allocation_date }) => {
    const cleanTelecallerId = String(telecaller_id || '').trim();
    const cleanDate = allocation_date ? String(allocation_date).slice(0, 10) : null;
    if (!cleanTelecallerId || !cleanDate) {
        return null;
    }

    let query = `
        SELECT
            id,
            telecaller_id,
            allocation_date,
            type,
            max_capacity,
            allocated_count,
            remaining_capacity,
            created_at,
            updated_at
        FROM telecaller_daily_capacity
        WHERE telecaller_id = ?
          AND allocation_date = ?
    `;
    const bindParams = [cleanTelecallerId, cleanDate];
    logger.info('getTelecallerDailyCapacity query', { query, bindParams });
    const result = await _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.SELECT,
        timeout: 15000
    });
    return result[0] || null;
};

const getTelecallerDailyCapacityHistory = async ({ telecaller_id, startDateFilter, endDateFilter, offset = 0, limit = 10 }) => {
    const cleanTelecallerId = String(telecaller_id || '').trim();
    const safeOffset = Number.isFinite(Number(offset)) ? Math.max(0, Number(offset)) : 0;
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : 10;

    // Keep query small and deterministic.
    if (!cleanTelecallerId) {
        return { records: [], totalCount: 0 };
    }

    let whereSql = ` WHERE telecaller_id = ? AND telecaller_id IS NOT NULL AND telecaller_id <> '' `;
    const selectParams = [cleanTelecallerId];
    const countParams = [cleanTelecallerId];
    if (startDateFilter && endDateFilter) {
        whereSql += ` AND allocation_date BETWEEN DATE(?) AND DATE(?) `;
        selectParams.push(startDateFilter, endDateFilter);
        countParams.push(startDateFilter, endDateFilter);
    }

    let query = `
        SELECT
            id,
            telecaller_id,
            allocation_date,
            type,
            max_capacity,
            allocated_count,
            remaining_capacity,
            created_at,
            updated_at
        FROM telecaller_daily_capacity
        ${whereSql}
        ORDER BY allocation_date DESC, created_at DESC
        LIMIT ?, ?
    `;
    let queryCount = `SELECT COUNT(*) AS totalCount FROM telecaller_daily_capacity ${whereSql}`;
    selectParams.push(safeOffset, safeLimit);
    logger.info('getTelecallerDailyCapacityHistory query', { query, queryCount, selectParams, countParams });

    const [records, totalCount] = await Promise.all([
        _db2.query(query, { replacements: selectParams, type: QueryTypes.SELECT, timeout: 15000 }),
        _db2.query(queryCount, { replacements: countParams, type: QueryTypes.SELECT, timeout: 15000 })
    ]);

    return {
        records,
        totalCount: totalCount[0]?.totalCount || 0
    };
};

const getTelecallerDailyCapacityById = async (id) => {
    const query = `
        SELECT
            id,
            telecaller_id,
            allocation_date,
            type,
            max_capacity,
            allocated_count,
            remaining_capacity,
            created_at,
            updated_at
        FROM telecaller_daily_capacity
        WHERE id = ?
    `;
    const result = await _db2.query(query, { replacements: [id], type: QueryTypes.SELECT });
    return result[0] || null;
};

const updateTelecallerDailyCapacity = async ({ id, max_capacity }) => {
    const query = `UPDATE telecaller_daily_capacity SET max_capacity = ? WHERE id = ?`;
    await _db2.query(query, { replacements: [max_capacity, id], type: QueryTypes.UPDATE });
    return getTelecallerDailyCapacityById(id);
};

module.exports = {
    signUpCEO,
    findUser,
    findRole,
    updateUser,
    addUser,
    getAllUsers,
    getRoles,
    updateUserOtp,
    updateUserValidateOtp,
    updateUserDelete,
    updateUserPassword,
    getUserById,
    getResetToken,
    deleteResetToken,
    createResetToken,
    updateStatus,
    findUserByUserId,
    changePasswordByUserId,
    changeUserPassword,
    findUserByPhoneOrEmail,
    getParentUsersByRole,
    getAllUsersWithRolesIn,
    getUsersByPhones,
    getAllRmUsers,
    createRmUser,
    deleteRmUser,
    getProductDropdown,
    updateTokenDate,
    updateUserPhone,
    getFirstUserByRole,
    updateBankStatus,
    updatePayoutStatus,
    findOtherUser,
    findUserById,
    updateUserWithId,
    updateBackendAccessStatus,
    addCallerId,
    getCallerId,
    updateCallerId,
    updateOtherUserForSameCallerId,
    clickToCall,
    findUserByPhone,
    getAllCallerId,
    getUserIdByCallerId,
    getUserActivityLogs,
    updateBankFileAccessStatus,
    updateBankFilePayoutAccessStatus,
    checkIfBlacklistedUserExist,
    getAllBlacklistedUsers,
    insertBlacklistedUser,
    deleteBlacklistedUser,
    bulkApproveRMUser,
    getRmUserByPhone,
    getRmUserByEmail,
    updateOrCreateRMUser,
    findUserCyclicDependency,
    updateSalesAdmin,
    isCyclicHierarchyCRM,
    updateTable,
    reactivateUser,
    getTelecallerDailyCapacity,
    getTelecallerDailyCapacityHistory,
    getTelecallerDailyCapacityById,
    updateTelecallerDailyCapacity,
};
