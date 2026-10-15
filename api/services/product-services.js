const { QueryTypes } = require('sequelize');
const { uploadToS3 } = require('../helpers/commonhelper');
let uuid = require('node-uuid');
const { _db3 } = require('../../models');
const ApplicationLogServices = require('./application-log-services');


const getAllProduct = async (offset, limit, where) => {
  let query = ` select rlp.b2b_web_journey_url, rlp.b2c_web_journey_url, rlp.sort_order, rlp.journey_type, rlp.utm_journey_url, rlp.communication_type, rlp.id, rlp.product_id, rlp.product_description, rlp.promo_code, rlp.joining_fee, case when rlp.status = 1 then 'Active' when rlp.status = 2 then 'UAT Active' else "Inactive" end as status_name, rlp.status, rlp.product_vendor, rlp.product_name, rlp.annual_fee, rlp.created_at, rlp.updated_at, rlp.loan_type_id, rlp.product_image, rlt.name as loan_type_name,rlp.gro_name,rlp.gro_email,rlp.desc as gro_description_html,rlp.gro_mobile, rlp.b2b_enabled, rlp.b2c_enabled, rlp.pincode_product_alias , rlp.is_claim_enabled , rlp.ns_bank_product_id, rlp.product_vendor_alias, rlp.partner_link, rlp.privacy_policy_link, rlp.website_link, rlp.need_reference_details, rlp.is_recommended, rlp.deeplink_generation from ru_loans_products rlp left join ru_loans_types rlt on rlp.loan_type_id = rlt.id ${where || ""} `;
  let queryCount = ` select count(*) as count from ru_loans_products rlp left join ru_loans_types rlt on rlp.loan_type_id = rlt.id ${where || ""} `;

  query += ` group by rlp.id `;
  query += limit ? ` order by rlp.id desc limit ${offset}, ${limit} ` : "";

  let data = await _db3.query(query, { type: QueryTypes.SELECT });
  let totalCount = await _db3.query(queryCount, { type: QueryTypes.SELECT });

  return { records: data, totalRecords: totalCount[0]?.count };
};

function convertToAbbreviation(product_vendor, loan_type_name) {
  return ` ${product_vendor?.toLowerCase()?.replaceAll(" ", "_")}_${loan_type_name.split(' ').map(word => word.charAt(0).toLowerCase()).join('')}`;
};

const createProduct = async (data, updatedBy = null) => {
  console.log(data);
  let {
    id, sort_order, journey_type, utm_journey_url, communication_type, product_id, promo_code,
    joining_fee, annual_fee, product_vendor, product_name, loan_type_id, product_description,
    product_image, status, b2c_enabled, b2b_enabled, pincode_product_alias, b2b_web_journey_url,
    b2c_web_journey_url, ns_bank_product_id, is_claim_enabled, product_vendor_alias, partner_link,
    privacy_policy_link, website_link, gro_description_html, gro_email, gro_mobile, gro_name,
    enable_reference_details, is_recommended, deeplink_generation
  } = data;

  let query;
  let bindParams;
  let imageId = uuid();
  const normalizedReferenceDetails = (enable_reference_details === 1 || enable_reference_details === "1" || enable_reference_details === true) ? 1 : 0;
  const normalizedRecommended = (is_recommended === 1 || is_recommended === "1" || is_recommended === true || is_recommended === "true") ? 1 : 0;

  // Upload image if not a URL
  if (!product_image?.includes("https://") && product_image) {
    product_image = await uploadToS3(
      'crm_components_meta',
      product_image,
      `component_crm_meta_${imageId}`,
      'image/jpeg',
      "jpg"
    );
  }

  if (id) {
    const existingProductResult = await _db3.query(
      `SELECT * FROM ru_loans_products WHERE id = ? LIMIT 1`,
      { replacements: [id], type: QueryTypes.SELECT }
    );
    const oldProduct = existingProductResult?.[0];

    // UPDATE
    query = `UPDATE ru_loans_products SET 
      sort_order=?, journey_type=?, utm_journey_url=?, communication_type=?, product_id=?, promo_code=?, 
      joining_fee=?, annual_fee=?, product_vendor=?, product_name=?, loan_type_id=?, product_description=?, 
      product_image=?, status=?, b2c_enabled=?, b2b_enabled=?, pincode_product_alias=?, 
      b2b_web_journey_url=?, b2c_web_journey_url=?, product_vendor_alias=?, partner_link=?, 
      privacy_policy_link=?, website_link=?, ns_bank_product_id=?, is_claim_enabled=?,
      gro_name=?, gro_email=?, gro_mobile=?, \`desc\`=?, need_reference_details=?, is_recommended=?,
      deeplink_generation=?
      WHERE id=?`;

    bindParams = [
      sort_order, journey_type, utm_journey_url, communication_type, product_id, promo_code,
      joining_fee, annual_fee, product_vendor, product_name, loan_type_id, product_description,
      product_image, status, b2c_enabled, b2b_enabled, pincode_product_alias,
      b2b_web_journey_url || null, b2c_web_journey_url || null, product_vendor_alias || null,
      partner_link || null, privacy_policy_link || null, website_link || null,
      ns_bank_product_id || null, is_claim_enabled ? 1 : 0,
      gro_name || null, gro_email || null, gro_mobile || null, gro_description_html || null,
      normalizedReferenceDetails,
      normalizedRecommended,
      deeplink_generation || null,
      id
    ];

    let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

    if (oldProduct && updatedBy) {
      // 1. Status Change
      if (Number(oldProduct.status) !== Number(status)) {
        const getStatusName = (st) => {
          if (Number(st) === 1) return 'Active';
          if (Number(st) === 2) return 'UAT Active';
          return 'Inactive';
        };
        await ApplicationLogServices.bulkCreate(
          [['status', getStatusName(oldProduct.status), getStatusName(status)]],
          String(id),
          'product_status_change',
          updatedBy
        );
      }

      // 2. GRO Changes
      const groFields = [
        { key: 'gro_name', label: 'GRO Name' },
        { key: 'gro_email', label: 'GRO Email' },
        { key: 'gro_mobile', label: 'GRO Mobile' },
        { key: 'desc', label: 'GRO Description', incomingKey: 'gro_description_html' }
      ];
      for (const fieldInfo of groFields) {
        const dbKey = fieldInfo.key;
        const incomingKey = fieldInfo.incomingKey || dbKey;
        const oldValue = oldProduct[dbKey] || '';
        const newValue = data[incomingKey] || '';
        if (String(oldValue).trim() !== String(newValue).trim()) {
          await ApplicationLogServices.bulkCreate(
            [[fieldInfo.label, oldValue || 'None', newValue || 'None']],
            String(id),
            'product_gro_change',
            updatedBy
          );
        }
      }

      // 3. General Product Changes
      const generalFields = [
        { key: 'product_name', label: 'Product Name' },
        { key: 'product_description', label: 'Product Description' },
        { key: 'promo_code', label: 'Promo Code' },
        { key: 'joining_fee', label: 'Joining Fee' },
        { key: 'annual_fee', label: 'Annual Fee' },
        { key: 'product_vendor', label: 'Product Vendor' },
        { key: 'product_vendor_alias', label: 'Product Vendor Alias' },
        { key: 'b2c_enabled', label: 'B2C Enabled' },
        { key: 'b2b_enabled', label: 'B2B Enabled' },
        { key: 'uat_status', label: 'UAT Status' },
        { key: 'uat_b2c_enabled', label: 'UAT B2C Enabled' },
        { key: 'uat_b2b_enabled', label: 'UAT B2B Enabled' },
        { key: 'rack_rate', label: 'Rack Rate' },
        { key: 'processing_fee', label: 'Processing Fee' },
        { key: 'foreclosure_charge', label: 'Foreclosure Charge' },
        { key: 'penal_charge', label: 'Penal Charge' },
        { key: 'product_image', label: 'Product Image' },
        { key: 'need_reference_details', label: 'Need Reference Details', incomingKey: 'enable_reference_details', isBool: true },
        { key: 'is_recommended', label: 'Is Recommended', isBool: true },
        { key: 'deeplink_generation', label: 'Deeplink Generation' }
      ];

      for (const fieldInfo of generalFields) {
        const dbKey = fieldInfo.key;
        let oldValue = oldProduct[dbKey];
        let newValue = fieldInfo.incomingKey ? data[fieldInfo.incomingKey] : data[dbKey];
        
        if (fieldInfo.isBool) {
          oldValue = Number(oldValue || 0) === 1 ? 'Yes' : 'No';
          newValue = (newValue === 1 || newValue === "1" || newValue === true) ? 'Yes' : 'No';
        } else {
          oldValue = oldValue !== null && oldValue !== undefined ? String(oldValue).trim() : '';
          newValue = newValue !== null && newValue !== undefined ? String(newValue).trim() : '';
        }

        if (oldValue !== newValue) {
          await ApplicationLogServices.bulkCreate(
            [[fieldInfo.label, oldValue || 'None', newValue || 'None']],
            String(id),
            'product_update',
            updatedBy
          );
        }
      }

      // Legacy need_reference_details logging
      const oldRef = Number(oldProduct.need_reference_details || 0);
      const newRef = (enable_reference_details === 1 || enable_reference_details === "1" || enable_reference_details === true) ? 1 : 0;
      if (oldRef !== newRef) {
        const productVendorForLog = product_vendor || oldProduct.product_vendor || "product_reference_details";
        await ApplicationLogServices.bulkCreate(
          [['need_reference_details', String(oldRef), String(newRef)]],
          String(id),
          productVendorForLog,
          updatedBy
        );
      }
    }

    return result;
  } else {
    // INSERT
    query = `INSERT INTO ru_loans_products (
      sort_order, journey_type, utm_journey_url, communication_type, product_id, promo_code, 
      joining_fee, annual_fee, product_vendor, product_name, loan_type_id, product_description, 
      product_image, status, b2c_enabled, b2b_enabled, pincode_product_alias, b2b_web_journey_url, 
      b2c_web_journey_url, product_vendor_alias, partner_link, privacy_policy_link, website_link, 
      ns_bank_product_id, is_claim_enabled, gro_name, gro_email, gro_mobile, \`desc\`, need_reference_details, is_recommended,
      deeplink_generation
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

    bindParams = [
      sort_order, journey_type, utm_journey_url, communication_type, product_id, promo_code,
      joining_fee, annual_fee, product_vendor, product_name, loan_type_id, product_description,
      product_image || null, status, b2c_enabled || 0, b2b_enabled || 0, pincode_product_alias || null,
      b2b_web_journey_url || null, b2c_web_journey_url || null, product_vendor_alias || null,
      partner_link || null, privacy_policy_link || null, website_link || null, ns_bank_product_id || null,
      is_claim_enabled ? 1 : 0,
      gro_name || null, gro_email || null, gro_mobile || null, gro_description_html || null,
      normalizedReferenceDetails,
      normalizedRecommended,
      deeplink_generation || null
    ];
    let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    const newProductId = result[0];
    if (newProductId && updatedBy) {
      await ApplicationLogServices.bulkCreate(
        [['product_name', '-', product_name]],
        String(newProductId),
        'product_creation',
        updatedBy
      );
    }
    return result;
  }
};

const getAllLoanTypes = async (loan_type_id) => {
  let status = process.env.ENVIRONMENT == "prod" ? ` status in ("1", "4", "0") ` : ` (status is not null or status = "") `;
  let query = ` select * from ru_loans_types where ${status} `;
  if (loan_type_id) {
    query = ` SELECT p.*,
            CASE 
                WHEN p.status = "0" THEN CONCAT(p.product_description, ' (Inactive)')
                WHEN p.status = "4" THEN CONCAT(p.product_description, ' (Limited Access)')
                WHEN p.status = "2" THEN CONCAT(p.product_description, ' (UAT Active)')
                ELSE p.product_description 
            END AS product_description,
            CASE 
                WHEN p.status = "0" THEN CONCAT(p.product_name, ' (Inactive)')
                WHEN p.status = "4" THEN CONCAT(p.product_name, ' (Limited Access)')
                WHEN p.status = "2" THEN CONCAT(p.product_name, ' (UAT Active)')
                ELSE p.product_name 
            END AS product_name
        FROM ru_loans_products p where p.loan_type_id = '${loan_type_id}' and ${status} `;
  };
  query += ` order by created_at desc`;
  let data = await _db3.query(query, { type: QueryTypes.SELECT });
  return { records: data };
};

const getCriteria = async (offset, limit, product_id) => {
  let query = ` select * from ru_loans_product_criteria where product_id=(?) `;
  query += ` order by created_at desc ${limit ? ` limit ${offset}, ${limit}` : ""} `;
  let bindParams = [product_id];
  let data = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

  query = `select count(*) as count from ru_loans_product_criteria where product_id = (?)`;
  bindParams = [product_id];
  let totalCount = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
  return { records: data, totalCount: totalCount[0]?.count };
}

const createCriteria = async (data, updatedBy = null) => {
  let { product_id, criteria } = data;
  let query = ""
  let bindParams = [];

  for (i = 0; i < criteria?.length; i++) {
    const { criteria_name, criteria_value, criteria_min_value, criteria_max_value, is_visible } = criteria[i];
    if (i == 0) {
      query = `insert into ru_loans_product_criteria(product_id, criteria_name, criteria_value, criteria_min_value, criteria_max_value, is_visible) values(?,?,?,?,?,?)`;
    } else {
      query += `, (?,?,?,?,?,?)`;
    }
    bindParams = bindParams.concat([product_id, criteria_name, criteria_value, criteria_value || criteria_min_value, criteria_max_value, is_visible]);
  }

  let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.INSERT });

  if (updatedBy && criteria?.length) {
    for (const c of criteria) {
      const displayVal = c.criteria_value || `${c.criteria_min_value || 0} - ${c.criteria_max_value || 0}`;
      await ApplicationLogServices.bulkCreate(
        [[c.criteria_name, 'None', displayVal]],
        String(product_id),
        'product_eligibility_change',
        updatedBy
      );
    }
  }

  return result;
};

const editCriteria = async (data, updatedBy = null) => {
  let { id, criteria_name, criteria_value, criteria_min_value, criteria_max_value, is_visible } = data;

  const existingCriteria = await _db3.query(
    `SELECT * FROM ru_loans_product_criteria WHERE id = ? LIMIT 1`,
    { replacements: [id], type: QueryTypes.SELECT }
  );

  let query = `update ru_loans_product_criteria set criteria_name=?, criteria_value=?, criteria_min_value=?, criteria_max_value=?, is_visible=?  where id =? `;
  let bindParams = [criteria_name, criteria_value, criteria_value || criteria_min_value, criteria_max_value, is_visible, id];
  let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });

  if (existingCriteria?.length && updatedBy) {
    const old = existingCriteria[0];
    const oldDisplay = old.criteria_value || `${old.criteria_min_value || 0} - ${old.criteria_max_value || 0}`;
    const newDisplay = criteria_value || `${criteria_min_value || 0} - ${criteria_max_value || 0}`;
    
    if (old.criteria_name !== criteria_name || oldDisplay !== newDisplay || old.is_visible !== is_visible) {
      await ApplicationLogServices.bulkCreate(
        [[criteria_name || old.criteria_name, oldDisplay, newDisplay]],
        String(old.product_id),
        'product_eligibility_change',
        updatedBy
      );
    }
  }

  return result;
};

const deleteCriteria = async (data, updatedBy = null) => {
  let { id } = data;

  const existingCriteria = await _db3.query(
    `SELECT * FROM ru_loans_product_criteria WHERE id = ? LIMIT 1`,
    { replacements: [id], type: QueryTypes.SELECT }
  );

  let query = `delete from ru_loans_product_criteria where id = (?)`;
  let bindParams = [id]
  let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.DELETE });

  if (existingCriteria?.length && updatedBy) {
    const old = existingCriteria[0];
    const oldDisplay = old.criteria_value || `${old.criteria_min_value || 0} - ${old.criteria_max_value || 0}`;
    await ApplicationLogServices.bulkCreate(
      [[old.criteria_name, oldDisplay, 'Deleted']],
      String(old.product_id),
      'product_eligibility_change',
      updatedBy
    );
  }

  return result;
};

const getContent = async (offset, limit, product_id) => {
  let query = `select * from ru_loans_product_content where product_id = (?)`;
  query += ` order by created_at desc limit ${offset}, ${limit} `;
  let bindParams = [product_id]
  let data = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

  query = `select count(*) as count from ru_loans_product_content where product_id = (?)`;
  bindParams = [product_id]
  let totalCount = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
  return { records: data, totalCount: totalCount[0]?.count };
}

const createContent = async (data) => {
  const { id, product_id, content } = data;
  let query;
  let bindParams = [];
  if (id) {
    const { type, description } = content[0];
    query = `update ru_loans_product_content set product_id =?, type =?, description =? where id = (?)`;
    bindParams = [product_id, type, description, id]
  } else {
    for (i = 0; i < content?.length; i++) {
      if (i == 0) {
        query = ` insert into ru_loans_product_content(description, type, product_id) values(?,?,?) `;
      } else {
        query += `, (?,?,?) `
      }
      bindParams = bindParams.concat([content[i]?.description, content[i]?.type, product_id]);
    }
  };
  let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
  return result;
};

const deleteContent = async (data) => {
  let { id } = data;
  let query = `delete from ru_loans_product_content where id = (?)`;
  let bindParams = [id];
  let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
  return result;
}

const getServiceablePincodes = async (offset, limit, where) => {
  let query = `select * from ru_loans_serviceable_pincode ${where} `;
  query += ` order by created_at desc limit ${offset}, ${limit} `;
  let data = await _db3.query(query, { type: QueryTypes.SELECT });

  query = `select count(*) as count from ru_loans_serviceable_pincode ${where} `;
  let totalCount = await _db3.query(query, { type: QueryTypes.SELECT });
  return { records: data, totalCount: totalCount[0]?.count };
}

const editServiceablePincodes = async (data) => {
  const { id, value, type } = data;
  query = `update ru_loans_serviceable_pincode set ${type}=?, updated_at = (?) where id = (?)`;
  bindParams = [value, new Date(), id]
  let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
  return result;
}

const addServiceablePincodes = async (data) => {
  const { pin_code, axis, indusind } = data;
  let query;
  let bindParams;

  query = `select * from ru_loans_serviceable_pincode where pin_code = (?)`;
  bindParams = [pin_code]
  let isExist = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });

  if (isExist[0]) {
    return false;
  } else {
    query = `insert into ru_loans_serviceable_pincode(pin_code, axis, indusind) values(?,?,?)`;
    bindParams = [pin_code, axis || 0, indusind || 0]
    let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    return result;
  }
}

const addNewLender = async (lender_name) => {
  let query, bindParams
  query = `select count(*) AS column_count from information_schema.columns where table_name = 'ru_loans_serviceable_pincode' 
  and column_name = (?)`
  bindParams = [lender_name]
  let count = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
  if (count[0].column_count !== 0) {
    return false;
  };
  
  query = `alter table ru_loans_serviceable_pincode add column ${lender_name} int default null`
  const result = await _db3.query(query, { type: QueryTypes.INSERT });
  return result;
}

const deleteServiceablePincode = async (data) => {
  const { id } = data;
  let query = `delete from ru_loans_serviceable_pincode where id = (?)`;
  let bindParams = [id]
  let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
  return result;
}

const getDocuments = async () => {
  let query = `select * from ru_loans_products`;
  query += ` order by created_at desc`;
  let data = await _db3.query(query, { type: QueryTypes.SELECT });
  return data;
};

const getDocumentsForProduct = async (offset, limit, product_id) => {
  let query = ` select rpd.id, rpd.document_alias as name, rpd.createdAt, rpd.updatedAt from ru_product_documents rpd where rpd.product_id = (?) `;
  query += ` order by rpd.createdAt desc limit ${offset}, ${limit} `;
  let bindParams = [product_id];
  let data = await _db3.query(query, {
    replacements: bindParams,
    type: QueryTypes.SELECT,
  });
  query = `select count(*) as count from ru_product_documents where product_id = (?)`;
  bindParams = [product_id]
  let totalCount = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
  return { records: data, totalCount: totalCount[0]?.count };
};

const getDocumentsMetaforProduct = async () => {
  let query = `select * from ru_product_documents_meta`;
  query += ` order by createdAt desc`;
  let data = await _db3.query(query, { type: QueryTypes.SELECT });
  return data;
};

const getProductRequirement = async (offset, limit, product_id) => {
  // const { product_id } = data;
  let query = `select rpr.id, rpr.product_id, rpr.requirement_id, rpr.requirement_alias as name, rpr.createdAt, rpr.updatedAt from ru_product_requirements rpr where rpr.product_id = (?)`;
  query += ` order by rpr.createdAt desc limit ${offset}, ${limit} `;
  let bindParams = [product_id];
  let data = await _db3.query(query, {
    replacements: bindParams,
    type: QueryTypes.SELECT,
  });
  query = `select count(*) as count from ru_product_requirements where product_id = (?)`;
  bindParams = [product_id]
  let totalCount = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
  return { records: data, totalCount: totalCount[0]?.count };
};

const getProductMetaForRequirement = async () => {
  let query = `select * from ru_product_requirements_meta`;
  query += ` order by createdAt desc`;
  let data = await _db3.query(query, { type: QueryTypes.SELECT });
  return data;
};

const createDocumentsForProduct = async (data) => {
  const { document_ids, product_id } = data;
  let query = "";
  let bindParams = [];
  try {
    for (let i = 0; i < document_ids.length; i++) {
      if (i == 0) {
        query +=
          "INSERT INTO ru_product_documents(product_id, document_alias) VALUES(?, ?)";
      } else {
        query += " , (?, ?)";
      }
      bindParams = bindParams.concat([product_id, document_ids[i]]);
    }
    console.log(query, bindParams);
    await _db3.query(query, {
      replacements: bindParams,
      type: QueryTypes.INSERT,
    });

    return { success: true, message: "Documents inserted successfully" };
  } catch (error) {
    console.error("Error inserting documents:", error);
    throw error; // Rethrow the error to handle it at the caller level if needed
  }
};

const createProductForRequirement = async (data) => {
  const { requirement_ids, product_id } = data;
  let query = "";
  let bindParams = [];
  try {
    for (let i = 0; i < requirement_ids.length; i++) {
      if (i == 0) {
        query +=
          "INSERT INTO ru_product_requirements(product_id, requirement_alias) VALUES(?, ?)";
      } else {
        query += " , (?, ?)";
      }
      bindParams = bindParams.concat([product_id, requirement_ids[i]]);
    }
    console.log(query, bindParams);
    await _db3.query(query, {
      replacements: bindParams,
      type: QueryTypes.INSERT,
    });

    return { success: true, message: "Documents inserted successfully" };
  } catch (error) {
    console.error("Error inserting documents:", error);
    throw error;
  }
};

const createDocumentsMetaforProduct = async (data) => {
  const { name, alias } = data;
  const query = `INSERT INTO ru_product_documents_meta(name, alias) VALUES(?, ?)`;
  const bindParams = [name, alias];

  let result = await _db3.query(query, {
    replacements: bindParams,
    type: QueryTypes.INSERT,
  });

  return result;
};

const createProductMetaForRequirement = async (data) => {
  const { name, alias } = data;
  const query = `INSERT INTO ru_product_requirements_meta(name, alias) VALUES(?, ?)`;
  const bindParams = [name, alias];

  let result = await _db3.query(query, {
    replacements: bindParams,
    type: QueryTypes.INSERT,
  });

  return result;
};

const deleteDocumentsForProduct = async (data) => {
  const { id } = data;
  let query = `delete from ru_product_documents where id = (?)`;
  let bindParams = [id];
  let result = await _db3.query(query, {
    replacements: bindParams,
    type: QueryTypes.DELETE,
  });
  return result;
};

const deleteRequirementsForProduct = async (data) => {
  const { id } = data;
  let query = `delete from ru_product_requirements where id = (?)`;
  let bindParams = [id];
  let result = await _db3.query(query, {
    replacements: bindParams,
    type: QueryTypes.DELETE,
  });
  return result;
};

const deleteDocumentsMetaForProduct = async (data) => {
  const { id } = data;
  let query = `delete from ru_product_documents_meta where id = (?)`;
  let bindParams = [id];
  let result = await _db3.query(query, {
    replacements: bindParams,
    type: QueryTypes.DELETE,
  });
  return result;
};

const deleteProductMetaForRequirement = async (data) => {
  const { id } = data;
  let query = `delete from ru_product_requirements_meta where id = (?)`;
  let bindParams = [id];
  let result = await _db3.query(query, {
    replacements: bindParams,
    type: QueryTypes.DELETE,
  });
  return result;
};

const getProductByLoanTypeId = async ({ loan_type_id, platform }) => {
  let enabledQuery = ` and ${platform == "b2c" ? ` p.b2c_enabled = 1 ` : ` p.b2b_enabled = 1 `} `;

  let query = ` select p.id, p.product_id, p.sort_order, p.product_description, p.promo_code, joining_fee, p.product_vendor, p.product_name, p.annual_fee, p.created_at, p.updated_at, p.loan_type_id, p.product_image, lt.value as loan_type_name,

    CASE WHEN COUNT(pc.id) > 0  THEN
  JSON_ARRAYAGG(JSON_OBJECT('product_id', pc.product_id, 'type', pc.type, 'description', pc.description))
  ELSE NULL END as content,

    CASE WHEN COUNT(pcr.id) > 0  THEN
  JSON_ARRAYAGG(JSON_OBJECT('product_id', pcr.product_id, 'criteria_name', pcr.criteria_name, 'criteria_value', pcr.criteria_value, 'criteria_max_value', pcr.criteria_max_value, 'criteria_min_value', pcr.criteria_min_value))
  ELSE NULL END as criteria,

    CASE WHEN COUNT(pd.id) > 0  THEN
  JSON_ARRAYAGG(JSON_OBJECT('name', pdm.name, 'alias', pdm.alias, 'product_id', pd.product_id, 'count', pd.count)) 
  ELSE NULL END as document,

    CASE WHEN COUNT(pr.id) > 0  THEN
  JSON_ARRAYAGG(JSON_OBJECT('name', prm.name, 'alias', prm.alias, 'product_id', pr.product_id, 'value', pr.value)) 
  ELSE NULL END as requirement

  from ru_loans_products p left join ru_loans_product_content pc on p.id = pc.product_id left join ru_loans_product_criteria pcr on p.id = pcr.product_id left join CRMTest.picklist_values lt on p.loan_type_id = lt.id left join ru_product_documents pd on pd.product_id = p.id left join ru_product_documents_meta pdm on pd.document_id = pdm.id left join ru_product_requirements pr on pr.product_id = p.id left join ru_product_requirements_meta prm on pr.requirement_id = prm.id where loan_type_id = ? ${enabledQuery} group by p.id `;

  let bindParams = [loan_type_id]
  let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
  if (result?.length) {
    result.sort((a, b) => a.sort_order - b.sort_order)
  };
  return result;
};

const csvToServicablePincode = async (data) => {
  for (i = 0; i < data?.length; i++) {
    let query = ` select * from ru_loans_serviceable_pincode where pin_code = (?)`;
    let bindParams = [data[i]['CONTACT_RESI_PIN_CODE__C']];
    exist = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    if (exist[0]) {
      query = ` update ru_loans_serviceable_pincode set bajaj =? where pin_code = (?)`;
      bindParams = [1, data[i]['CONTACT_RESI_PIN_CODE__C']];
      await _db3.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    } else {
      query = ` insert into ru_loans_serviceable_pincode(pin_code, indusind, axis, credit_vidya, bajaj) values(?,?,?,?,?)`;
      bindParams = [data[i]['CONTACT_RESI_PIN_CODE__C'], 0, 0, 0, 1];
      await _db3.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
  }
  return
};

const getLoanTypesPaginated = async (offset, limit, where) => {
  let query = ` select *, 
  case when status = 1 then 'Active' when status = 2 then 'UAT Active' else "Inactive" end as status_name, 
  case when b2b_enabled = 1 then 'Active' when b2b_enabled = 2 then 'Web Inactive' when b2b_enabled = 3 then 'App Inactive' else "Inactive" end as b2b_enabled_name, 
  case when b2c_enabled = 1 then 'Active' when b2c_enabled = 2 then 'Web Inactive' when b2c_enabled = 3 then 'App Inactive' else "Inactive" end as b2c_enabled_name
  from ru_loans_types ${where} `;
  let queryCount = ` select count(*) as totalCount from ru_loans_types ${where} `;

  query += ` order by created_at desc `;
  query += limit ? ` limit ${offset}, ${limit} ` : "";

  let data = await _db3.query(query, { type: QueryTypes.SELECT });
  let totalCount = await _db3.query(queryCount, { type: QueryTypes.SELECT });

  return { records: data, totalRecords: totalCount[0]?.totalCount };
};

const deleteLoanTypeById = async (id) => {
  let query = ` delete from ru_loans_types where id = ${id} `;
  await _db3.query(query, { type: QueryTypes.DELETE });
  return;
};

const createLoanType = async (data) => {
  let { id, name, icon, status, b2c_enabled, b2b_enabled, alias, sort_order, category, b2b_web_journey_url, b2c_web_journey_url } = data;
  let query;
  let bindParams;
  let imageId = uuid();
  if (!icon?.includes("https://") && icon) {
    icon = await uploadToS3('crm_loan_type', icon, `crm_loan_type_${imageId}`, 'image/jpeg', "jpg");
  };
  if (id) {
    query = `update ru_loans_types set b2b_web_journey_url=?, b2c_web_journey_url=?, category=?, name=?, icon=?, status=?, b2c_enabled=?, b2b_enabled=?, alias=?, sort_order=? where id = (?) `;
    bindParams = [b2b_web_journey_url || null, b2c_web_journey_url || null, category || null, name, icon, status, b2c_enabled, b2b_enabled, alias, sort_order, id]
  } else {
    query = `insert into ru_loans_types (b2b_web_journey_url, b2c_web_journey_url, category, name, icon, status, b2c_enabled, b2b_enabled, alias, sort_order) values (?,?,?,?,?,?,?,?,?,?)  `;
    bindParams = [b2b_web_journey_url || null, b2c_web_journey_url || null, category || null, name, icon, status, b2c_enabled, b2b_enabled, alias, sort_order]
  }
  let result = await _db3.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
  return result;
};

const updatePincodeCsv = async (pincode, status, type) => {
  let query;
  let bindParams = [];

  if (status == 2) {
    let query = `INSERT INTO ru_loans_serviceable_pincode (pin_code, ${type}) VALUES `;
    let bindParams = [];
    for (let i = 0; i < pincode?.length; i++) {
      query += `(?, 1)${i < pincode.length - 1 ? ',' : ''}`;
      bindParams = bindParams.concat([pincode[i]]);
    }
    query += ` ON DUPLICATE KEY UPDATE ${type} = 1`;
    await _db3.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
  }

  else {
    query = ` update ru_loans_serviceable_pincode set ${type} = ? where pin_code in (?) `;
    bindParams = [status, pincode];
    await _db3.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
  };

  return;
};

const getPincodeHistory = async (pincode) => {
  query = ` select * from ru_loans_serviceable_pincode where pin_code in (?) `;
  bindParams = [pincode];
  let data = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT })
  return data;
};
const getProductForRm = async (pageNumber, pageSize, where) => {
  let query = `
    SELECT 
      rlp.id, 
      rlp.product_name,
      rlt.name AS loan_type_name
    FROM ru_loans_products rlp 
    LEFT JOIN ru_loans_types rlt ON rlp.loan_type_id = rlt.id
    ${where} 
    LIMIT ${pageNumber}, ${pageSize}
  `;

  const data = await _db3.query(query, { type: QueryTypes.SELECT });
  return data;
};

const getProductAuditLogs = async (offset, limit, filters) => {
  let { product_id_filter, user_name_filter, event_type_filter, startDate, endDate } = filters;
  
  let where = " WHERE (al.application_type IN ('product_creation', 'product_status_change', 'product_eligibility_change', 'product_gro_change', 'product_update') OR al.field = 'need_reference_details') ";
  let bindParams = [];
  
  if (product_id_filter) {
    if (/^\d+$/.test(product_id_filter)) {
      where += " AND al.application_id = ? ";
      bindParams.push(String(product_id_filter));
    } else {
      where += " AND p.product_name LIKE ? ";
      bindParams.push(`%${product_id_filter}%`);
    }
  }
  if (user_name_filter) {
    where += " AND u.name LIKE ? ";
    bindParams.push(`%${user_name_filter}%`);
  }
  if (event_type_filter) {
    if (event_type_filter === 'need_reference_details') {
      // These logs are stored with a generic application_type but field = 'need_reference_details'
      where += " AND al.field = 'need_reference_details' ";
    } else {
      where += " AND al.application_type = ? ";
      bindParams.push(event_type_filter);
    }
  }
  if (startDate && endDate) {
    where += " AND DATE(al.createdAt) BETWEEN DATE(?) AND DATE(?) ";
    bindParams.push(startDate, endDate);
  }
  
  let query = `
    SELECT 
      al.id,
      al.application_type,
      al.application_id,
      al.field,
      al.from_value,
      al.to_value,
      al.createdAt,
      u.name AS user_name,
      p.product_name AS product_name
    FROM CRMTest.application_logs al
    LEFT JOIN CRMTest.users u ON al.updated_by = u.id
    LEFT JOIN ru_loans_products p ON al.application_id = p.id
    ${where}
    ORDER BY al.createdAt DESC
    LIMIT ${offset}, ${limit}
  `;
  
  let countQuery = `
    SELECT COUNT(*) AS count
    FROM CRMTest.application_logs al
    LEFT JOIN CRMTest.users u ON al.updated_by = u.id
    LEFT JOIN ru_loans_products p ON al.application_id = p.id
    ${where}
  `;
  
  let records = await _db3.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
  let countResult = await _db3.query(countQuery, { replacements: bindParams, type: QueryTypes.SELECT });
  
  return { records, totalRecords: countResult[0]?.count || 0 };
};

const countRecommendedProducts = async (excludeProductId = null, loan_type_id = null) => {
  let query = `select count(*) as count from ru_loans_products where is_recommended = 1`;
  let replacements = [];
  if (loan_type_id) {
    query += ` and loan_type_id = ?`;
    replacements.push(loan_type_id);
  }
  if (excludeProductId) {
    query += ` and id != ?`;
    replacements.push(excludeProductId);
  }
  let result = await _db3.query(query, { replacements, type: QueryTypes.SELECT });
  return result[0]?.count || 0;
};

const updateRecommendedStatus = async (id, is_recommended, updatedBy = null) => {
  const existingProductResult = await _db3.query(
    `SELECT is_recommended, product_name FROM ru_loans_products WHERE id = ? LIMIT 1`,
    { replacements: [id], type: QueryTypes.SELECT }
  );
  if (!existingProductResult || existingProductResult.length === 0) {
    throw new Error("Product not found");
  }
  const oldVal = existingProductResult[0].is_recommended ? 1 : 0;
  const newVal = is_recommended ? 1 : 0;

  let query = `UPDATE ru_loans_products SET is_recommended = ? WHERE id = ?`;
  let result = await _db3.query(query, { replacements: [newVal, id], type: QueryTypes.UPDATE });

  if (oldVal !== newVal && updatedBy) {
    await ApplicationLogServices.bulkCreate(
      [['Is Recommended', oldVal === 1 ? 'Yes' : 'No', newVal === 1 ? 'Yes' : 'No']],
      String(id),
      'product_update',
      updatedBy
    );
  }
  return result;
};

module.exports = {
  getProductForRm,
  getAllProduct,
  createProduct,
  getAllLoanTypes,
  getCriteria,
  createCriteria,
  deleteCriteria,
  getContent,
  createContent,
  getServiceablePincodes,
  editServiceablePincodes,
  addServiceablePincodes,
  deleteServiceablePincode,
  deleteContent,
  editCriteria,
  getDocuments,
  getDocumentsForProduct,
  getDocumentsMetaforProduct,
  getProductRequirement,
  getProductMetaForRequirement,
  createDocumentsForProduct,
  createProductForRequirement,
  createDocumentsMetaforProduct,
  createProductMetaForRequirement,
  deleteDocumentsForProduct,
  deleteDocumentsMetaForProduct,
  deleteProductMetaForRequirement,
  deleteRequirementsForProduct,
  getProductByLoanTypeId,
  csvToServicablePincode,
  getLoanTypesPaginated,
  deleteLoanTypeById,
  createLoanType,
  addNewLender,
  updatePincodeCsv,
  getPincodeHistory,
  getProductAuditLogs,
  countRecommendedProducts,
  updateRecommendedStatus
};
