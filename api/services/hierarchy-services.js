const { _db2, sequelize } = require("../../models");
const { QueryTypes } = require('sequelize');

let updateQuery = `WITH RECURSIVE dsa_hierarchy (dsa, ancestor, full_name, materialized_path, materialized_path_name) AS (
                    -- Anchor member (start with self in the path)
                    SELECT
                        c.dsa_mobile_number,
                        c.partner_code,
                        c.full_name,
                        concat('/', c.dsa_id, '/', p.dsa_id),
                        concat('/', CONCAT(c.first_name, ' ', c.last_name), '/', CONCAT(p.first_name, ' ', p.last_name))
                    FROM ru_direct_selling_agents c inner join ru_direct_selling_agents p on c.partner_code = p.dsa_mobile_number
                    WHERE c.partner_code IS NOT NULL
                
                    UNION ALL
                
                    -- Recursive member
                    SELECT
                        h.dsa,
                        r.partner_code,
                        p.full_name,
                        CONCAT(h.materialized_path, '/', p.dsa_id),
                        concat(h.materialized_path_name, '/', CONCAT(p.first_name, ' ', p.last_name))
                    FROM dsa_hierarchy h
                    JOIN ru_direct_selling_agents r ON r.dsa_mobile_number = h.ancestor
                    inner join ru_direct_selling_agents p on r.partner_code = p.dsa_mobile_number
                    WHERE r.partner_code IS NOT NULL
                ),
                ranked_hierarchy AS (
                    SELECT
                        dsa,
                        ancestor AS descendent,
                        full_name,
                        materialized_path,
                        materialized_path_name,
                        -- Depth = number of non-empty parts in path - 1
                        LENGTH(materialized_path) - LENGTH(REPLACE(materialized_path, '/', '')) AS depth,
                        ROW_NUMBER() OVER (PARTITION BY dsa ORDER BY LENGTH(materialized_path) - LENGTH(REPLACE(materialized_path, '/', '')) DESC) AS rn
                    FROM dsa_hierarchy
                )
                UPDATE ru_direct_selling_agents dsa
                JOIN (
                    SELECT dsa, descendent, materialized_path, depth, materialized_path_name
                    FROM ranked_hierarchy
                    WHERE rn = 1
                ) AS derived
                ON dsa.dsa_mobile_number = derived.dsa
                SET
                    dsa.materialized_path = derived.materialized_path,
                    dsa.materialized_path_depth = derived.depth,
                    dsa.hierarchy_crm = derived.materialized_path_name`;

//execute only once highly destructive;
exports.executeRawQuery = async () => {
    await _db2.query("use RULoans", { raw: true });
    let dsa = await _db2.query(updateQuery, { raw: true });
    console.log("Done hierarchy sync!");
};

//show me your power;
exports.joinSample = async () => {
    let query = `SELECT * FROM RULoans.ru_direct_selling_agents c left join RULoans.ru_hierarchy_mapping m on c.dsa_mobile_number = binary m.dsa where materialized_path like "%9819447343%" and depth > 2 limit 10`;
    let dsa = await _db2.query(query, { type: QueryTypes.SELECT });
    console.log(dsa);
};

exports.updatePartnerAndHierarchy = async (dsa_id, partner_code) => {
    let query = `use RULoans;`;
    await _db2.query(query, { raw: true });

    //get old path to update with new_path
    query = `select *, CONCAT(first_name, ' ', last_name) as full_name from RULoans.ru_direct_selling_agents c where c.dsa_id = "${dsa_id}"`;
    let dsa_child = await _db2.query(query, { type: QueryTypes.SELECT });
    dsa_child = dsa_child ? dsa_child[0] : null;
    let old_path = dsa_child?.materialized_path || null;
    let old_path_name = dsa_child?.hierarchy_crm || null;

     query = `update ru_direct_selling_agents set 
              previous_partner_code = ${dsa_child?.partner_code || null}, 
              partner_assigned_date = ?,
              initial_partner_code = CASE WHEN partner_code IS NULL OR partner_code = '' THEN "${partner_code}" ELSE initial_partner_code END,
              salesperson_id = null,
              salesperson_assigned_date = null,
              partner_code = "${partner_code}" 
              where dsa_id = "${dsa_id}"`;
    await _db2.query(query, { replacements: [new Date()], type: QueryTypes.UPDATE });

    //get new path//
    query = ` WITH RECURSIVE dsa_hierarchy (
                  dsa, ancestor, full_name, materialized_path_phone, materialized_path, materialized_path_name, depth
              ) AS (
                  SELECT 
                      dsa_mobile_number, 
                      partner_code, 
                      CONCAT(first_name, ' ', last_name) AS full_name,
                      CONCAT('/', dsa_mobile_number),
                      CONCAT('/', dsa_id),
                      CONCAT('/', CONCAT(first_name, ' ', last_name)),
                      1
                  FROM ru_direct_selling_agents
                  WHERE dsa_mobile_number = ${partner_code}  -- Start from the specific DSA
              
                  UNION ALL
              
                  SELECT 
                      r.dsa_mobile_number,
                      r.partner_code,
                      CONCAT(r.first_name, ' ', r.last_name),
                      CONCAT(h.materialized_path_phone, '/', r.dsa_mobile_number),
                      CONCAT(h.materialized_path, '/', r.dsa_id),
                      CONCAT(h.materialized_path_name, '/', CONCAT(r.first_name, ' ', r.last_name)),
                      h.depth + 1
                  FROM dsa_hierarchy h
                  JOIN ru_direct_selling_agents r ON r.dsa_mobile_number = h.ancestor
              )
              SELECT depth, materialized_path, materialized_path_phone, materialized_path_name
              FROM dsa_hierarchy
              ORDER BY depth DESC
              LIMIT 1 `;

    let dsa_parent = await _db2.query(query, { type: QueryTypes.SELECT });
    dsa_parent = dsa_parent ? dsa_parent[0] : null;
    let new_path = dsa_parent ? dsa_parent?.materialized_path : null;
    let new_path_phone = dsa_parent ? dsa_parent?.materialized_path_phone : null;
    let new_path_name = dsa_parent ? dsa_parent?.materialized_path_name : null;

    let newDepth = dsa_parent?.depth - dsa_child?.materialized_path_depth || 0;
    newDepth = newDepth + 1;

    const depthChange = newDepth >= 0 ? `+${newDepth}` : `${newDepth}`;

    let updatedPath = `/${dsa_child?.dsa_id}${new_path || ""}`;
    let updatedPathPhone = `/${dsa_child?.dsa_mobile_number}${new_path_phone || ""}`;
    let updatedPathName = `/${dsa_child?.full_name || dsa_child?.dsa_mobile_number}${new_path_name || ""}`;

    let updatedPathArr = updatedPathPhone?.split("/");
    let business_head = updatedPathArr[updatedPathArr?.length - 2] || null;

    if (dsa_child?.partner_code && dsa_child?.partner_code?.length) {
        query = ` update ru_direct_selling_agents set 
        materialized_path = REPLACE(materialized_path, '${old_path}', '${updatedPath}'), 
        materialized_path_depth = materialized_path_depth ${depthChange}, 
        ${old_path_name ? `hierarchy_crm = REPLACE(hierarchy_crm, '${old_path_name}', '${updatedPathName}')` : `hierarchy_crm = '${updatedPathName}'`}, 
        salesperson_id = case when business_head_code != "${business_head}" then null when business_head_code is null then null else salesperson_id end,
        business_head_code = "${business_head}"
        WHERE materialized_path LIKE "%${old_path}%" `;

    } else {
        query = ` update ru_direct_selling_agents set 
        materialized_path = '${updatedPath}', 
        materialized_path_depth =  ${dsa_parent?.depth + 1}, 
        hierarchy_crm = '${updatedPathName}', 
        salesperson_id = case when business_head_code != "${business_head}" then null when business_head_code is null then null else salesperson_id end,
        business_head_code = "${business_head}"
        WHERE dsa_id = "${dsa_id}" `;
    };

    await _db2.query(query, { type: QueryTypes.UPDATE });

    return { business_head };
};


const updateUsers = async (dsa_id, partner_code) => {
    let query = `use RULoans;`;
    await _db2.query(query, { raw: true });

    //get old path to update with new_path
    query = `select bin_to_uuid(u.id) as user, r.role, u.phone from users u left join roles r on r.id = u.role where r.role = "TELE_CALLER"`;
    let users = await sequelize.query(query, { type: QueryTypes.SELECT });

    console.log(users)

    for (let i = 0; i < users?.length; i++) {
        query = `update ru_direct_selling_agents set salesperson_id = "${users[i]?.user}" where partner_code = "${users[i]?.phone}"`;
        await _db2.query(query, { type: QueryTypes.UPDATE });
    };


    console.log("<======Update Completed======>");
};

// updateUsers();
