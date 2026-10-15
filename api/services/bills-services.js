const { QueryTypes } = require('sequelize');
const { _db2, _db3 } = require('../../models');
let uuid = require('node-uuid');
const { uploadToS3 } = require('../helpers/commonhelper');
const { SQL_INVOICE_EXPENSE_VENDOR_PAN, SQL_INVOICE_EXPENSE_VENDOR_NAME, SQL_INVOICE_EXPENSE_VENDOR_JOINS, SQL_INVOICE_EXPENSE_VENDOR_MOBILE, SQL_INVOICE_EXPENSE_VENDOR_EMAIL, sqlPreferredBankAccountJoinByDsaId, sqlPreferredBankAccountJoinByCompanyId } = require('../helpers/apiFieldMappings');

/** File extension for S3 key from Content-Type (Excel/PDF/images/CSV). */
function billAttachmentExtFromMime(mime) {
  const m = (mime || '').toLowerCase().trim().split(';')[0];
  switch (m) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'application/pdf':
      return 'pdf';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx';
    case 'application/vnd.ms-excel':
      return 'xls';
    case 'text/csv':
    case 'application/csv':
    case 'text/comma-separated-values':
      return 'csv';
    default:
      if (m.includes('spreadsheetml')) return 'xlsx';
      return 'bin';
  }
}

/**
 * Parse data-URL or raw base64; detect PDF/JPEG/PNG, legacy .xls (OLE), .xlsx (ZIP OOXML).
 * Raw Excel was falling through to application/octet-stream → .bin in uploadToS3.
 */
function billAttachmentSniffBase64(input) {
  if (!input || typeof input !== 'string') {
    return { contentType: 'application/octet-stream', ext: 'bin', base64: '' };
  }

  if (input.startsWith('data:')) {
    const commaIdx = input.indexOf(',');
    const semiIdx = input.indexOf(';', 5);
    const metaEnd = semiIdx > 5 ? semiIdx : (commaIdx > 5 ? commaIdx : input.length);
    const meta = input.slice(5, metaEnd);
    const payload = input.slice(commaIdx + 1).replace(/\s/g, '');
    const contentType = meta || 'application/octet-stream';
    return { contentType, ext: billAttachmentExtFromMime(contentType), base64: payload };
  }

  const trimmed = input.replace(/\s/g, '');
  const head = trimmed.slice(0, 32);

  if (head.startsWith('JVBERi0')) {
    return { contentType: 'application/pdf', ext: 'pdf', base64: trimmed };
  }
  if (head.startsWith('/9j/')) {
    return { contentType: 'image/jpeg', ext: 'jpg', base64: trimmed };
  }
  if (head.startsWith('iVBORw0KGgo')) {
    return { contentType: 'image/png', ext: 'png', base64: trimmed };
  }

  // OLE compound document (legacy .xls): magic D0 CF 11 E0 A1 B1 1A E1 → base64 prefix 0M8R4KGx
  if (head.startsWith('0M8R4KGx')) {
    return { contentType: 'application/vnd.ms-excel', ext: 'xls', base64: trimmed };
  }

  // ZIP (Office Open XML): .xlsx — PK header, local file headers contain xl/workbook
  if (head.startsWith('UEsD')) {
    try {
      const sampleLen = Math.min(trimmed.length, 32000);
      const buf = Buffer.from(trimmed.slice(0, sampleLen), 'base64');
      if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
        const sniff = buf.toString('latin1');
        if (sniff.includes('xl/') && (sniff.includes('workbook') || sniff.includes('sharedStrings'))) {
          return {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ext: 'xlsx',
            base64: trimmed
          };
        }
      }
    } catch (e) {
      /* ignore decode errors */
    }
  }

  return { contentType: 'application/octet-stream', ext: 'bin', base64: trimmed };
}

exports.checkBillForCurrentMonth = async (bill_number, created_by, dsa_id_vendor, exclude_id = null) => {
    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created_by);
    
    // Get the mapped value (dsa_id if input is UUID, or UUID if input is dsa_id)
    let mappedCreatedBy = null;
    
    if (isUuidFormat) {
        // Input is CRM UUID, find corresponding dsa_id
        const userQuery = `SELECT dsa_id FROM CRMTest.users WHERE bin_to_uuid(id) = ? LIMIT 1`;
        const userResult = await _db2.query(userQuery, { replacements: [created_by], type: QueryTypes.SELECT });
        if (userResult && userResult[0] && userResult[0].dsa_id) {
            mappedCreatedBy = userResult[0].dsa_id;
        }
    } else {
        // Input is B2B dsa_id, find corresponding UUID
        const userQuery = `SELECT bin_to_uuid(id) as crm_id FROM CRMTest.users WHERE BINARY dsa_id = BINARY ? LIMIT 1`;
        const userResult = await _db2.query(userQuery, { replacements: [created_by], type: QueryTypes.SELECT });
        if (userResult && userResult[0] && userResult[0].crm_id) {
            mappedCreatedBy = userResult[0].crm_id;
        }
    }
    
    // Check for duplicates: same bill_number + same dsa_id_vendor + (same created_by OR mapped created_by)
    // This handles the case where same user logs in via B2B (dsa_id) and CRM (UUID)
    let query = `
        SELECT 
            e.id,
            e.created_by,
            e.platform
        FROM ru_dsa_expenses e
        WHERE TRIM(e.bill_number) = TRIM(?) 
        AND e.dsa_id = ?
        AND (
            BINARY e.created_by = BINARY ?
            ${mappedCreatedBy ? 'OR BINARY e.created_by = BINARY ?' : ''}
        )
    `;
    let replacements = [bill_number, dsa_id_vendor, created_by];
    if (mappedCreatedBy) {
        replacements.push(mappedCreatedBy);
    }
    
    if (exclude_id) {
        query += ` AND e.id != ? `;
        replacements.push(exclude_id);
    }
    
    let data = await _db2.query(query, { replacements: replacements, type: QueryTypes.SELECT });

    if (data && data.length > 0) {
        return data[0];
    }

    return null;
};

/**
 * Resolve human-readable display value for audit logs.
 * For UUID created_by -> CRM user name, for non-uuid created_by -> DSA full name.
 * Falls back to the original value when no mapping is found.
 */
exports.getAuditDisplayValue = async (field, value) => {
    if (value == null || value === '') return value;

    const stringValue = String(value).trim();
    if (!stringValue) return value;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stringValue);

    try {
        // created_by can be UUID (CRM) or DSA id (B2B)
        if (field === 'created_by' && isUuid) {
            const rows = await _db2.query(
                `SELECT name FROM CRMTest.users WHERE BIN_TO_UUID(id) = ? LIMIT 1`,
                { replacements: [stringValue], type: QueryTypes.SELECT }
            );
            if (rows?.[0]?.name) return rows[0].name;
        }

        // non-uuid created_by (b2b dsa_id): try DSA full name
        if (field === 'created_by' && !isUuid) {
            const rows = await _db2.query(
                `SELECT full_name FROM ru_direct_selling_agents WHERE dsa_id = ? LIMIT 1`,
                { replacements: [stringValue], type: QueryTypes.SELECT }
            );
            if (rows?.[0]?.full_name) return rows[0].full_name;
        }
    } catch (e) {
        // Do not fail audit logging if name lookup fails.
    }

    return value;
};

/**
 * Normalize bill_number for similarity: trim and strip trailing -DD or -DD-DD (e.g. -25, -26, -25-26).
 */
const normalizeBillNumberForSimilarity = (billNumber) => {
    if (billNumber == null || typeof billNumber !== 'string') return '';
    return String(billNumber).trim().replace(/-\d{2}(-\d{2})?$/i, '');
};

/**
 * Normalize memo for similarity: trim and collapse multiple spaces to one.
 */
const normalizeMemoForSimilarity = (memo) => {
    if (memo == null || typeof memo !== 'string') return '';
    return String(memo).trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * Relaxed memo match: exact match, or one normalized memo contains the other (e.g. "rent" matches "gst rent invoice").
 */
const memoMatchRelaxed = (candNorm, rowNorm) => {
    if (candNorm === rowNorm) return true;
    if (!candNorm || !rowNorm) return false;
    return candNorm.includes(rowNorm) || rowNorm.includes(candNorm);
};

/**
 * Find existing bills with >= 90% same info (7 of 8 comparable fields match).
 * Comparable: dsa_id, created_by, bill_date (same month), city, account, total amount, memo (relaxed: exact or one contains the other), bill_number (normalized).
 * Status is NOT used for matching – it is only returned for display (so user can see Pending/Approved/Rejected).
 * @param {Object} candidate - { dsa_id_vendor, created_by, bill_date, city, account, memo, bill_number, totalAmount }
 * @param {number|null} excludeId - expense id to exclude (e.g. current bill when used from approval).
 * @returns {Promise<Array>} Similar bills with id, expense_id, bill_number, status, status_name, amount, memo, city, bill_date, created_at, dsa_name_vendor.
 */
exports.findSimilarBills = async (candidate, excludeId = null) => {
    const {
        dsa_id_vendor,
        created_by,
        bill_date,
        city,
        account,
        memo,
        bill_number,
        totalAmount
    } = candidate;

    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created_by);
    let mappedCreatedBy = null;
    if (isUuidFormat) {
        const userQuery = `SELECT dsa_id FROM CRMTest.users WHERE bin_to_uuid(id) = ? LIMIT 1`;
        const userResult = await _db2.query(userQuery, { replacements: [created_by], type: QueryTypes.SELECT });
        if (userResult && userResult[0] && userResult[0].dsa_id) {
            mappedCreatedBy = userResult[0].dsa_id;
        }
    } else {
        const userQuery = `SELECT bin_to_uuid(id) as crm_id FROM CRMTest.users WHERE BINARY dsa_id = BINARY ? LIMIT 1`;
        const userResult = await _db2.query(userQuery, { replacements: [created_by], type: QueryTypes.SELECT });
        if (userResult && userResult[0] && userResult[0].crm_id) {
            mappedCreatedBy = userResult[0].crm_id;
        }
    }

    let query = `
        SELECT
            e.id,
            e.expense_id,
            e.bill_number,
            e.status,
            e.memo,
            e.city,
            e.bill_date,
            e.created_at,
            e.account,
            e.created_by,
            e.dsa_id,
            d.full_name AS dsa_name_vendor,
            SUM(ei.amount) AS amount,
            CASE WHEN e.status = 0 THEN 'Approval Pending' WHEN e.status = 1 THEN 'Approved By BH' WHEN e.status = 2 THEN 'Approved By CEO/CFO' ELSE 'Rejected' END AS status_name
        FROM ru_dsa_expenses e
        LEFT JOIN ru_dsa_expense_items ei ON ei.expense_id = e.id
        LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = e.dsa_id
        WHERE e.dsa_id = ?
        AND (BINARY e.created_by = BINARY ? ${mappedCreatedBy ? 'OR BINARY e.created_by = BINARY ?' : ''})
    `;
    const replacements = [dsa_id_vendor, created_by];
    if (mappedCreatedBy) replacements.push(mappedCreatedBy);
    if (excludeId != null) {
        query += ` AND e.id != ?`;
        replacements.push(excludeId);
    }
    query += ` GROUP BY e.id`;

    const rows = await _db2.query(query, { replacements, type: QueryTypes.SELECT });
    if (!rows || rows.length === 0) return [];

    const candBillDate = bill_date ? new Date(bill_date) : null;
    const candMonthStr = candBillDate ? `${candBillDate.getFullYear()}-${String(candBillDate.getMonth() + 1).padStart(2, '0')}` : '';
    const candCity = (city != null && String(city).trim()) ? String(city).trim().toLowerCase() : '';
    const candAccount = (account != null && account !== '') ? String(account).trim() : '';
    const candAmount = Number(totalAmount);
    const candMemoNorm = normalizeMemoForSimilarity(memo);
    const candBillNumNorm = normalizeBillNumberForSimilarity(bill_number);

    const MIN_MATCHES = 7;
    const similar = [];

    for (const row of rows) {
        let matches = 0;
        if (row.dsa_id != null && String(row.dsa_id) === String(dsa_id_vendor)) matches++;
        if (row.created_by != null && (String(row.created_by) === String(created_by) || (mappedCreatedBy && String(row.created_by) === String(mappedCreatedBy)))) matches++;
        const rowDate = row.bill_date ? new Date(row.bill_date) : null;
        const rowMonthStr = rowDate ? `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}` : '';
        if (candMonthStr && rowMonthStr && candMonthStr === rowMonthStr) matches++;
        const rowCity = (row.city != null && String(row.city).trim()) ? String(row.city).trim().toLowerCase() : '';
        if (candCity === rowCity) matches++;
        const rowAccount = (row.account != null && row.account !== '') ? String(row.account).trim() : '';
        if (candAccount === rowAccount) matches++;
        const rowAmount = Number(row.amount);
        if (!Number.isNaN(candAmount) && !Number.isNaN(rowAmount) && candAmount === rowAmount) matches++;
        const rowMemoNorm = normalizeMemoForSimilarity(row.memo);
        if (memoMatchRelaxed(candMemoNorm, rowMemoNorm)) matches++;
        const rowBillNumNorm = normalizeBillNumberForSimilarity(row.bill_number);
        if (candBillNumNorm === rowBillNumNorm) matches++;

        if (matches >= MIN_MATCHES) {
            similar.push({
                id: row.id,
                expense_id: row.expense_id,
                bill_number: row.bill_number || '',
                status: row.status != null ? String(row.status) : '',
                status_name: row.status_name || '',
                amount: Number(row.amount) || 0,
                memo: row.memo || '',
                city: row.city || '',
                bill_date: row.bill_date != null ? (typeof row.bill_date === 'string' ? row.bill_date : new Date(row.bill_date).toISOString()) : '',
                created_at: row.created_at != null ? (typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString()) : '',
                dsa_name_vendor: row.dsa_name_vendor || ''
            });
        }
    }

    return similar;
};

exports.createBillsInternal = async (data) => {
  const { dsa_id_vendor, memo, created_by, account, expenses, line_details, bill_date, bill_number, city, platform = "crm" } = data;

  const isHttpUrl = (val) => typeof val === 'string' && /^https?:\/\//i.test(val);

  const transaction = await _db2.transaction();
  try {
    await _db2.query(
      `INSERT INTO ru_dsa_expenses (expense_id, dsa_id, memo, created_by, status, account, bill_date, bill_number, city, created_at, updated_at, category, platform)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "bills", ?)`,
      {
        replacements: [uuid(), dsa_id_vendor, memo, created_by, 0, account, bill_date, bill_number, city, new Date(), new Date(), platform],
        type: QueryTypes.INSERT,
        transaction
      }
    );

    const result = await _db2.query(`SELECT LAST_INSERT_ID() AS id`, { type: QueryTypes.SELECT, transaction });
    const insertedId = result[0]?.id;

    let itemsQuery = `INSERT INTO ru_dsa_expense_items
      (department, expense_id, expense_type, amount, tax_section_code, attachment, attachment_2, created_at, updated_at, dsa_id, class_id, ns_hierarchy_type)
      VALUES `;
    const itemsParams = [];

    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i];
      const line = line_details[i];
      let { attachment, attachment_2: attachment2Raw } = expense;

     
      if (attachment && !isHttpUrl(attachment)) {
        const { contentType, ext, base64 } = billAttachmentSniffBase64(attachment);
        console.log(contentType, ext, base64 ,"hihihihihihi")
        attachment = await uploadToS3(
          'bills_attachment',
          base64,                          // raw base64 payload only
          `bills_attachment_${uuid()}`,    // key (your utility can add ext if needed)
          contentType,
          ext
        );
      }
      console.log("attachment", attachment);

      let attachment_2 = attachment2Raw;
      if (attachment_2 && !isHttpUrl(attachment_2)) {
        const { contentType, ext, base64 } = billAttachmentSniffBase64(attachment_2);
        attachment_2 = await uploadToS3(
          'bills_attachment',
          base64,
          `bills_attachment_${uuid()}`,
          contentType,
          ext
        );
      }

      if (i > 0) itemsQuery += ', ';
      itemsQuery += `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      itemsParams.push(
        line?.department ?? null,
        insertedId,
        expense?.expense_type ?? null,
        expense?.amount ?? null,
        line?.taxSectionCode ?? null,
        attachment ?? null,   // S3 URL or original URL
        attachment_2 ?? null,
        new Date(),
        new Date(),
        line?.dsa_id,
        line?.class_id,
        line?.ns_hierarchy_type ?? null
      );
    }

    await _db2.query(itemsQuery, { replacements: itemsParams, type: QueryTypes.INSERT, transaction });
    await transaction.commit();
    return insertedId;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};


exports.updateBillsInternal = async (data) => {
  const {
    dsa_id_vendor,
    memo,
    created_by,
    expenses,
    line_details,
    expense_id,
    bill_date,
    bill_number,
    city,
    platform = "crm"
  } = data;

  const isHttpUrl = (val) => typeof val === 'string' && /^https?:\/\//i.test(val);

  const transaction = await _db2.transaction();
  try {
    // remove old lines
    await _db2.query(
      `DELETE FROM ru_dsa_expense_items WHERE expense_id = ?`,
      { replacements: [expense_id], type: QueryTypes.DELETE, transaction }
    );

    // update header
    await _db2.query(
      `UPDATE ru_dsa_expenses
       SET dsa_id = ?, memo = ?, bill_date = ?, bill_number = ?, city = ?, created_by = ?, updated_at = ?, status = 0, approved_at = NULL, platform = ?
       WHERE id = ?`,
      {
        replacements: [
          dsa_id_vendor,
          memo,
          bill_date,
          bill_number,
          city,
          created_by,
          new Date(),
          platform,
          expense_id
        ],
        type: QueryTypes.UPDATE,
        transaction
      }
    );

    // re-insert lines
    let query = `
      INSERT INTO ru_dsa_expense_items
      (department, expense_id, expense_type, amount, tax_section_code, attachment, attachment_2, created_at, updated_at, dsa_id, class_id, ns_hierarchy_type)
      VALUES `;
    const itemsParams = [];

    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i];
      const line = line_details[i];

      let { attachment, attachment_2: attachment2Raw } = expense;

      // Base64 -> S3; URLs untouched
      if (attachment && !isHttpUrl(attachment)) {
        const { contentType, ext, base64 } = billAttachmentSniffBase64(attachment);
        attachment = await uploadToS3(
          'bills_attachment',
          base64,                         // raw base64 payload only
          `bills_attachment_${uuid()}`,   // or: `bills_attachment_${uuid()}.${ext}`
          contentType,
          ext
        );
      }

      let attachment_2 = attachment2Raw;
      if (attachment_2 && !isHttpUrl(attachment_2)) {
        const { contentType, ext, base64 } = billAttachmentSniffBase64(attachment_2);
        attachment_2 = await uploadToS3(
          'bills_attachment',
          base64,
          `bills_attachment_${uuid()}`,
          contentType,
          ext
        );
      }

      if (i > 0) query += ', ';
      query += `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      itemsParams.push(
        line?.department ?? null,
        expense_id,
        expense?.expense_type ?? null,
        expense?.amount ?? null,
        line?.taxSectionCode ?? null,
        attachment ?? null,
        attachment_2 ?? null,
        new Date(),
        new Date(),
        line?.dsa_id,
        line?.class_id,
        line?.ns_hierarchy_type ?? null
      );
    }

    await _db2.query(query, {
      replacements: itemsParams,
      type: QueryTypes.INSERT,
      transaction
    });

    await transaction.commit();
    return true;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};



exports.getVendorDetailsByExpenseId = async (expenseId) => {
    let expenseQuery = ` select e.netsuite_vendor_id from ru_dsa_expenses e where e.expense_id = ? `;
    let expenseResult = await _db2.query(expenseQuery, { replacements: [expenseId], type: QueryTypes.SELECT, useMaster: true });
    let expense = expenseResult[0] || null;

    if (!expense || !expense.netsuite_vendor_id) {
        return { netsuite_vendor_id: expense ? expense.netsuite_vendor_id : null, dsa_records: [], company: null };
    }

    const netsuiteVendorId = expense.netsuite_vendor_id;

    let dsaQuery = ` select kyc.dsa_id, kyc.netsuite_vendor_id, kyc.ns_hierarchy, kyc.permanent_account_number, kyc.class_id,
        d.full_name as dsa_name, d.partner_code, d.dsa_mobile_number
        from ru_dsa_kyc_data kyc
        left join ru_direct_selling_agents d on d.dsa_id = kyc.dsa_id
        where kyc.netsuite_vendor_id = ? `;
    let dsaRecords = await _db2.query(dsaQuery, { replacements: [netsuiteVendorId], type: QueryTypes.SELECT, useMaster: true });

    if (dsaRecords && dsaRecords.length > 0) {
        return { netsuite_vendor_id: netsuiteVendorId, dsa_records: dsaRecords, company: null };
    }

    let companyQuery = ` select rc.* from ru_companies rc where rc.ns_internal_id = ? `;
    let companyResult = await _db2.query(companyQuery, { replacements: [netsuiteVendorId], type: QueryTypes.SELECT, useMaster: true });

    return { netsuite_vendor_id: netsuiteVendorId, dsa_records: [], company: companyResult[0] || null };
};

exports.mapDsaToVendorInvoices = async (expenseId, dsaId) => {
    let expenseQuery = ` select e.netsuite_vendor_id from ru_dsa_expenses e where e.expense_id = ? `;
    let expenseResult = await _db2.query(expenseQuery, { replacements: [expenseId], type: QueryTypes.SELECT, useMaster: true });
    let expense = expenseResult[0] || null;

    if (!expense || !expense.netsuite_vendor_id) {
        return { matched: false, netsuite_vendor_id: null, updated_count: 0 };
    }
    const netsuiteVendorId = expense.netsuite_vendor_id;

    // dsaId may be either an actual dsa_id or a company_id sent under the same field, so check both directly
    let kycQuery = ` select kyc.netsuite_vendor_id as kyc_vendor_id from ru_dsa_kyc_data kyc where kyc.dsa_id = ? `;
    let companyQuery = ` select rc.ns_internal_id as company_vendor_id from ru_companies rc where rc.company_id = ? `;
    let [kycResult, companyResult] = await Promise.all([
        _db2.query(kycQuery, { replacements: [dsaId], type: QueryTypes.SELECT, useMaster: true }),
        _db2.query(companyQuery, { replacements: [dsaId], type: QueryTypes.SELECT, useMaster: true })
    ]);
    const kycVendorId = kycResult[0]?.kyc_vendor_id ?? null;
    const companyVendorId = companyResult[0]?.company_vendor_id ?? null;

    const matched = kycVendorId === netsuiteVendorId || companyVendorId === netsuiteVendorId;

    if (!matched) {
        return { matched: false, netsuite_vendor_id: netsuiteVendorId, updated_count: 0 };
    }

    let updateQuery = ` update ru_dsa_expenses set dsa_id = ? where netsuite_vendor_id = ? and category = 'invoices' `;
    let [, updatedCount] = await _db2.query(updateQuery, { replacements: [dsaId, netsuiteVendorId], type: QueryTypes.UPDATE });

    return { matched: true, netsuite_vendor_id: netsuiteVendorId, updated_count: updatedCount };
};

exports.getBillForApproval = async (field, value) => {
    let query = ` select e.*, d.full_name as dsa_name_vendor, d.partner_code, kyc.permanent_account_number as dsa_vendor_pan
        from ru_dsa_expenses e
        left join ru_direct_selling_agents d on d.dsa_id = e.dsa_id
        left join ru_dsa_kyc_data kyc on kyc.dsa_id = e.dsa_id
        where e.${field} = ? `;
    const bindParams = [value];
    let result = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT, useMaster: true });
    result = result[0];

    if (result) {
        query = ` SELECT
  i.*,
  pv.alias AS expense_type_value,
  COALESCE(
    NULLIF(TRIM(d.full_name), ''),
    (
      SELECT k2.ns_hierarchy
      FROM ru_dsa_kyc_data k2
      WHERE TRIM(COALESCE(k2.class_id, '')) <> ''
        AND TRIM(COALESCE(k2.class_id, '')) = TRIM(COALESCE(i.class_id, ''))
      ORDER BY k2.dsa_id ASC
      LIMIT 1
    )
  ) AS dsa_name
FROM
  ru_dsa_expense_items i
LEFT JOIN
  CRMTest.picklist_values pv
  ON BINARY pv.value = i.expense_type
LEFT JOIN
  ru_direct_selling_agents d
  ON d.dsa_id = i.dsa_id
WHERE
  BINARY i.expense_id = BINARY CAST(? AS CHAR);
`;
        let items = await _db2.query(query, {
            replacements: [result?.id],
            type: QueryTypes.SELECT,
            useMaster: true
        });
        result["expenses"] = items;
    };

    return result || null;
};
exports.getBillId = async (expense_id) => {
    let query = ` select expense_id from ru_dsa_expenses where id = ? `;
    let data = await _db2.query(query, { replacements: [expense_id], type: QueryTypes.SELECT });
    return data[0];
};
exports.updateBillStatus = async (status, expense_id, reason, latestLog = null, logUpdatedBy = null, lastUpdatedLog = null) => {
    let reasonQuery = reason
        ? `, memo = CONCAT(IFNULL(memo, ''), IF(memo IS NOT NULL AND memo != '', '|', ''), "Rejection Reason: ${reason}")`
        : ``;
    const isCeoCfoApproved = String(status) === '2' || status === 2;
    const approvedAtSql = isCeoCfoApproved ? ', approved_at = NOW()' : '';
    let query = ` update ru_dsa_expenses set status = ?${approvedAtSql}${reasonQuery}, latest_log = ?, log_updated_by = ?, last_updated_log = ? where id = ? `;
    const bindParams = [status, latestLog, logUpdatedBy, lastUpdatedLog || new Date(), expense_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};
exports.updateExpenseAuditLog = async (expense_id, latestLog = null, logUpdatedBy = null, lastUpdatedLog = null) => {
    const query = ` update ru_dsa_expenses set latest_log = ?, log_updated_by = ?, last_updated_log = ? where id = ? `;
    const bindParams = [latestLog, logUpdatedBy, lastUpdatedLog || new Date(), expense_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};
exports.updateNSInternalId = async (ns_internal_id, expense_id) => {

    let query = ` update ru_dsa_expenses set ns_internal_id = ? where id = ? `;
    const bindParams = [ns_internal_id, expense_id];
    await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return;
};
exports.billStatus = async (expense_id) => {
    let query = ` select status from ru_dsa_expenses where id = ? `;
    let data = await _db2.query(query, { replacements: [expense_id], type: QueryTypes.SELECT });
    return data[0];
}

exports.getBillId = async (expense_id) => {
    let query = ` select expense_id from ru_dsa_expenses where id = ? `;
    let data = await _db2.query(query, { replacements: [expense_id], type: QueryTypes.SELECT });
    return data[0];
};
exports.expenseActivityLogs = async (expense_id, user_id, action, reason) => {
    const query = `
        INSERT INTO ru_expense_activity_logs 
        (expense_id, dsa_id, action, remarks, created_at) 
        VALUES (?, ?, ?, ?, ?)
    `;
    const bindParams = [expense_id, user_id, action, reason, new Date()];

    await _db2.query(query, {
        replacements: bindParams,
        type: QueryTypes.INSERT
    });

    return;
};
exports.invoiceActivityLogs = async (expense_id, user_id, action, reason) => {
    const insertQuery = `
        INSERT INTO ru_expense_activity_logs 
        (expense_id, dsa_id, action, remarks, created_at) 
        VALUES (?, ?, ?, ?, ?)
    `;
    const insertParams = [expense_id, user_id, action, reason, new Date()];

    const updateQuery = `
    UPDATE ru_dsa_expenses 
    SET status_alias = 'crm_rejected', 
        status = 'Rejected', 
        updated_at = ?
    WHERE expense_id = ?
`;
    const updateParams = [new Date(), expense_id];

    const transaction = await _db2.transaction();

    try {
        await _db2.query(insertQuery, {
            replacements: insertParams,
            type: QueryTypes.INSERT,
            transaction
        });

        await _db2.query(updateQuery, {
            replacements: updateParams,
            type: QueryTypes.UPDATE,
            transaction
        });

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }

    return;
};


exports.getDsaClassId = async (dsa_id) => {
    // Fetch vendor's basic details along with partner_code and NS hierarchy from KYC data
    let query = ` select kyc.permanent_account_number, kyc.netsuite_vendor_id, kyc.class_id, kyc.ns_hierarchy, d.dsa_mobile_number, d.partner_code from ru_direct_selling_agents d left join ru_dsa_kyc_data kyc on kyc.dsa_id = d.dsa_id where d.dsa_id = ? `;
    let bindParams = [dsa_id];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
    return data[0] || null;
};

exports.getDsaByMobileNumber = async (mobileNumber) => {
    if (!mobileNumber) return null;
    const query = `SELECT dsa_id, materialized_path FROM ru_direct_selling_agents WHERE dsa_mobile_number = ? LIMIT 1`;
    const data = await _db2.query(query, { replacements: [mobileNumber], type: QueryTypes.SELECT });
    return data[0] || null;
};

exports.updateDsaClassId = async ({ dsa_id_vendor, class_id }) => {
    let query = ` update ru_dsa_kyc_data set class_id = ? where dsa_id = ? `;
    let bindParams = [class_id, dsa_id_vendor];
    let data = await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
    return data[0] || null;
};

exports.getExpenses = async (offset, limit, where, having) => {
  const ctePrefix = `
WITH expenses_typed AS (
  SELECT
    e.*,
    CASE
      WHEN e.created_by IS NOT NULL
           AND CHAR_LENGTH(e.created_by) = 36
           AND e.created_by LIKE '________-____-____-____-____________'
      THEN uuid_to_bin(e.created_by)
      ELSE NULL
    END AS created_by_bin,
    CASE
      WHEN e.created_by IS NOT NULL
           AND NOT (CHAR_LENGTH(e.created_by) = 36
                    AND e.created_by LIKE '________-____-____-____-____________')
      THEN e.created_by
      ELSE NULL
    END AS created_by_varchar
  FROM ru_dsa_expenses e
  WHERE e.category = 'bills'
)`;

  const billSelect = ` e.*,
  COALESCE(lu.name, ldu.full_name, e.log_updated_by) AS log_updated_by,
  DATE(e.created_at) AS created_at_date, DATE(e.bill_date) AS bill_at_date,
  CASE
      WHEN e.status = '0' THEN 'Approval Pending'
      WHEN e.status = '1' THEN 'Approved By BH'
      WHEN e.status = '2' THEN 'Approved By CEO/CFO'
      ELSE 'Rejected'
  END AS status_name,
  CASE
      WHEN e.platform = 'b2b' THEN du2.full_name
      ELSE u.name
  END AS created_by_name,
  CASE
      WHEN e.platform = 'b2b' THEN du2.dsa_mobile_number
      ELSE u.phone
  END AS created_by_phone,
  d.full_name AS dsa_name, d.dsa_mobile_number, d.email_address AS dsa_email_address,
  CASE
      WHEN e.platform = 'b2b' THEN d.gstin
      ELSE du.gstin
  END AS gstin,
  kyc_exp.permanent_account_number AS dsa_pan,
  kyc_exp.class_id AS dsa_class,
  SUM(ei.amount) AS amount, SUM(ei.tax_amount) AS tax_amount, SUM(ei.base_amount) AS base_amount,
  DATE(e.approved_at) AS approved_at`;

  let query = `${ctePrefix}
SELECT ${billSelect}
FROM expenses_typed e
LEFT JOIN CRMTest.users u ON u.id = e.created_by_bin
LEFT JOIN CRMTest.users lu ON lu.id = CASE
  WHEN e.log_updated_by REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN uuid_to_bin(e.log_updated_by)
  ELSE NULL
END
LEFT JOIN ru_direct_selling_agents ldu ON ldu.dsa_id = e.log_updated_by
LEFT JOIN ru_direct_selling_agents du ON du.dsa_mobile_number = u.phone
LEFT JOIN ru_dsa_kyc_data kyc_du ON kyc_du.dsa_id = du.dsa_id
LEFT JOIN ru_direct_selling_agents du2 ON du2.dsa_id = e.created_by_varchar
LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = e.dsa_id
LEFT JOIN ru_dsa_kyc_data kyc_exp ON kyc_exp.dsa_id = e.dsa_id
LEFT JOIN ru_dsa_expense_items ei ON ei.expense_id = e.id `;

  let queryCount = `${ctePrefix}
SELECT COUNT(DISTINCT e.id) AS totalCount
FROM expenses_typed e
LEFT JOIN CRMTest.users u ON u.id = e.created_by_bin
LEFT JOIN CRMTest.users lu ON lu.id = CASE
  WHEN e.log_updated_by REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN uuid_to_bin(e.log_updated_by)
  ELSE NULL
END
LEFT JOIN ru_direct_selling_agents ldu ON ldu.dsa_id = e.log_updated_by
LEFT JOIN ru_direct_selling_agents du ON du.dsa_mobile_number = u.phone
LEFT JOIN ru_dsa_kyc_data kyc_du ON kyc_du.dsa_id = du.dsa_id
LEFT JOIN ru_direct_selling_agents du2 ON du2.dsa_id = e.created_by_varchar
LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = e.dsa_id
LEFT JOIN ru_dsa_kyc_data kyc_exp ON kyc_exp.dsa_id = e.dsa_id
LEFT JOIN ru_dsa_expense_items ei ON ei.expense_id = e.id `;

  if (where && where.trim() !== '') {
    query += ` ${where} `;
    queryCount += ` ${where} `;
  }

  query += ` GROUP BY e.id ${having || ''} `;
  query += ` ORDER BY e.created_at DESC `;
  query += limit ? ` LIMIT ${offset}, ${limit} ` : "";

  let data = await _db2.query(query, { type: QueryTypes.SELECT });
  let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });

  mapExpenseRowsApprovedAtDateOnly(data);
  return { records: data, totalRecords: totalCount[0]?.totalCount };
};

/** Strip time from CEO/CFO approval timestamps in list APIs (e.* returns full DATETIME). */
function mapExpenseRowsApprovedAtDateOnly(records) {
  if (!Array.isArray(records)) return;
  const toYmd = (v) => {
    if (v == null) return v;
    if (v instanceof Date && !isNaN(v.getTime())) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, '0');
      const d = String(v.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}[\sT]\d/.test(s)) return s.slice(0, 10);
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return v;
  };
  for (const row of records) {
    if (!row) continue;
    if (row.approved_at != null) row.approved_at = toYmd(row.approved_at);
  }
}

/** Grid date filters (approved_at, viewed_at): compare DATE only; coerce ISO to YYYY-MM-DD. */
function normalizeExpenseDateFilterValue(value) {
  if (value == null || value === '') return value;
  const toLocalYmd = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  if (value instanceof Date && !isNaN(value.getTime())) {
    return toLocalYmd(value);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) || /^\d{4}-\d{2}-\d{2}Z$/i.test(s)) {
    const t = Date.parse(s);
    if (!isNaN(t)) return toLocalYmd(new Date(t));
  }
  return value;
}

function sqlExpenseFavouriteFlag(favouriteCreatedBy, expenseIdExpr = 'CAST(e.id AS CHAR)') {
  if (!favouriteCreatedBy) {
    return '0 AS favourite';
  }
  return `EXISTS (
    SELECT 1 FROM ru_expense_favourites ef
    WHERE ef.expense_id COLLATE utf8mb4_unicode_ci = ${expenseIdExpr} COLLATE utf8mb4_unicode_ci
      AND ef.created_by COLLATE utf8mb4_unicode_ci = CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci
    LIMIT 1
  ) AS favourite`;
}

exports.getExpensesNew = async (offset, limit, where, having, whereFilterQuery, orderBy, favouriteCreatedBy = null, latestInvalidPerDsa = false) => {
  let bindParams = [];
  const logicOperator = "AND";

  // Helper function to build queries with optional collation and safe UUID handling
  const buildQueries = (useCollate = false, safeUuidJoin = false) => {
      const collateStr = useCollate ? ' COLLATE utf8mb4_unicode_ci' : '';
      const normalizeNsHierarchyClause = (input) => {
          if (!input || typeof input !== 'string') return input;
          return input
              .replace(/TRIM\(\s*(?<!\.)ns_hierarchy\s*\)/gi, 'TRIM(nh.ns_hierarchy)')
              .replace(/(?<!\.)\bns_hierarchy\s+is\s+not\s+null\b/gi, 'nh.ns_hierarchy IS NOT NULL')
              .replace(/(?<!\.)\bns_hierarchy\s+is\s+null\b/gi, 'nh.ns_hierarchy IS NULL')
              .replace(/(?<!\.)\bns_hierarchy\s+is\s+not\s+empty\b/gi, "nh.ns_hierarchy <> ''")
              .replace(/(?<!\.)\bns_hierarchy\s+is\s+empty\b/gi, "(nh.ns_hierarchy IS NULL OR TRIM(nh.ns_hierarchy) = '')")
              .replace(/(?<!\.)\bns_hierarchy\b/g, 'nh.ns_hierarchy');
      };

      const ctePrefix = latestInvalidPerDsa ? `
WITH ranked_expenses AS (
  SELECT
    e.*,
    COALESCE(NULLIF(CAST(e.expense_id AS CHAR), ''), CAST(e.id AS CHAR)) AS expense_join_key,
    ROW_NUMBER() OVER (
      PARTITION BY e.dsa_id
      ORDER BY e.created_at DESC, e.id DESC
    ) AS rn,
    CASE
      WHEN e.created_by IS NOT NULL
           AND CHAR_LENGTH(e.created_by) = 36
           AND e.created_by LIKE '________-____-____-____-____________'
      THEN uuid_to_bin(e.created_by)
      ELSE NULL
    END AS created_by_bin,
    CASE
      WHEN e.created_by IS NOT NULL
           AND NOT (CHAR_LENGTH(e.created_by) = 36
                    AND e.created_by LIKE '________-____-____-____-____________')
      THEN e.created_by
      ELSE NULL
    END AS created_by_varchar
  FROM ru_dsa_expenses e
  WHERE e.status = 'Pending Approval'
    AND (e.status_alias IS NULL OR e.status_alias = 'e_sign_created')
    AND e.category = 'invoices'
),
expenses_typed AS (
  SELECT * FROM ranked_expenses WHERE rn = 1
),
ei_agg AS (
  SELECT
    expense_id,
    COALESCE(SUM(amount), 0) AS amount,
    COALESCE(SUM(tax_amount), 0) AS tax_amount,
    COALESCE(SUM(base_amount), 0) AS base_amount
  FROM ru_dsa_expense_items
  GROUP BY expense_id
),
ns_hier AS (
  SELECT class_id, MIN(ns_hierarchy) AS ns_hierarchy
  FROM ru_dsa_kyc_data
  WHERE ns_hierarchy IS NOT NULL
    AND ns_hierarchy <> ''
  GROUP BY class_id
)` : `
WITH expenses_typed AS (
  SELECT
    e.*,
    COALESCE(NULLIF(CAST(e.expense_id AS CHAR), ''), CAST(e.id AS CHAR)) AS expense_join_key,
    CASE
      WHEN e.created_by IS NOT NULL
           AND CHAR_LENGTH(e.created_by) = 36
           AND e.created_by LIKE '________-____-____-____-____________'
      THEN uuid_to_bin(e.created_by)
      ELSE NULL
    END AS created_by_bin,
    CASE
      WHEN e.created_by IS NOT NULL
           AND NOT (CHAR_LENGTH(e.created_by) = 36
                    AND e.created_by LIKE '________-____-____-____-____________')
      THEN e.created_by
      ELSE NULL
    END AS created_by_varchar
  FROM ru_dsa_expenses e
  WHERE e.category = 'invoices'
),
ei_agg AS (
  SELECT
    expense_id,
    COALESCE(SUM(amount), 0) AS amount,
    COALESCE(SUM(tax_amount), 0) AS tax_amount,
    COALESCE(SUM(base_amount), 0) AS base_amount
  FROM ru_dsa_expense_items
  GROUP BY expense_id
),
ns_hier AS (
  SELECT class_id, MIN(ns_hierarchy) AS ns_hierarchy
  FROM ru_dsa_kyc_data
  WHERE ns_hierarchy IS NOT NULL
    AND ns_hierarchy <> ''
  GROUP BY class_id
)`;

      let billSelect = ` e.*, COALESCE(lu.name, ldu.full_name, e.log_updated_by) AS log_updated_by, DATE(e.created_at) as created_at_date, DATE(e.bill_date) as bill_at_date, case when e.status = 0 then "Approval Pending" when e.status = 1 then "Approved By BH" when e.status = 2 then "Approved By CEO/CFO" else "Rejected" end as status_name, 
      'ns-webhook' as created_by_name,
      NULL as created_by_phone, 
      ${SQL_INVOICE_EXPENSE_VENDOR_NAME} AS vendor_name,
      ${SQL_INVOICE_EXPENSE_VENDOR_NAME} AS dsa_name,
      ${SQL_INVOICE_EXPENSE_VENDOR_MOBILE} AS dsa_mobile_number, ${SQL_INVOICE_EXPENSE_VENDOR_EMAIL} AS dsa_email_address,
      CASE 
          WHEN e.platform = 'b2b' THEN d.gstin
          ELSE du.gstin
      END as gstin,
      ${SQL_INVOICE_EXPENSE_VENDOR_PAN} AS dsa_pan,
      kyc_exp.class_id AS dsa_class,
      kyc_exp.class_id AS ns_class,
      nh.ns_hierarchy AS ns_hierarchy,
      ${sqlExpenseFavouriteFlag(favouriteCreatedBy)},
      COALESCE(ei.amount, 0) AS amount,
      COALESCE(ei.tax_amount, 0) AS tax_amount,
      COALESCE(ei.base_amount, 0) AS base_amount,
      DATE(e.approved_at) AS approved_at`;

      let query = `${ctePrefix}
SELECT ${billSelect}
FROM expenses_typed e
LEFT JOIN CRMTest.users u ON u.id = e.created_by_bin
LEFT JOIN CRMTest.users lu ON lu.id = CASE
  WHEN e.log_updated_by IS NOT NULL
    AND CHAR_LENGTH(e.log_updated_by) = 36
    AND e.log_updated_by LIKE '________-____-____-____-____________'
  THEN uuid_to_bin(e.log_updated_by)
  ELSE NULL
END
LEFT JOIN ru_direct_selling_agents ldu ON ldu.dsa_id${collateStr} = e.log_updated_by${collateStr}
LEFT JOIN ru_direct_selling_agents du ON du.dsa_mobile_number${collateStr} = u.phone${collateStr}
LEFT JOIN ru_dsa_kyc_data kyc_du ON kyc_du.dsa_id${collateStr} = du.dsa_id${collateStr}
LEFT JOIN ru_direct_selling_agents du2 ON du2.dsa_id${collateStr} = e.created_by_varchar${collateStr}
LEFT JOIN ru_direct_selling_agents d ON d.dsa_id${collateStr} = e.dsa_id${collateStr}
${SQL_INVOICE_EXPENSE_VENDOR_JOINS(collateStr)}
LEFT JOIN ru_dsa_kyc_data kyc_exp ON kyc_exp.dsa_id${collateStr} = e.dsa_id${collateStr}
LEFT JOIN ei_agg ei ON ei.expense_id = e.expense_join_key
LEFT JOIN ns_hier nh ON nh.class_id = kyc_exp.class_id`;

      // Invoice optimization: keep count query lean unless filters reference joined tables.
      const joinedAliasPattern = /\b(?:u|lu|ldu|du|kyc_du|du2|d|kyc_vendor|rc|kyc_exp|ei|nh)\./i;
      const whereUsesJoinedAlias = typeof where === 'string' && joinedAliasPattern.test(where);
      const havingUsesJoinedAlias = typeof having === 'string' && joinedAliasPattern.test(having);
      const orderByUsesJoinedAlias = typeof orderBy === 'string' && joinedAliasPattern.test(orderBy);
      const needsHeavyCountQuery = Boolean(
          (whereFilterQuery && whereFilterQuery.length) ||
          (having && having.trim() !== '') ||
          whereUsesJoinedAlias ||
          havingUsesJoinedAlias ||
          orderByUsesJoinedAlias
      );
      let queryCount = needsHeavyCountQuery
          ? `${ctePrefix}
SELECT COUNT(DISTINCT e.id) as totalCount
FROM expenses_typed e
LEFT JOIN CRMTest.users u ON u.id = e.created_by_bin
LEFT JOIN CRMTest.users lu ON lu.id = CASE
  WHEN e.log_updated_by IS NOT NULL
    AND CHAR_LENGTH(e.log_updated_by) = 36
    AND e.log_updated_by LIKE '________-____-____-____-____________'
  THEN uuid_to_bin(e.log_updated_by)
  ELSE NULL
END
LEFT JOIN ru_direct_selling_agents ldu ON ldu.dsa_id${collateStr} = e.log_updated_by${collateStr}
LEFT JOIN ru_direct_selling_agents du ON du.dsa_mobile_number${collateStr} = u.phone${collateStr}
LEFT JOIN ru_dsa_kyc_data kyc_du ON kyc_du.dsa_id${collateStr} = du.dsa_id${collateStr}
LEFT JOIN ru_direct_selling_agents du2 ON du2.dsa_id${collateStr} = e.created_by_varchar${collateStr}
LEFT JOIN ru_direct_selling_agents d ON d.dsa_id${collateStr} = e.dsa_id${collateStr}
${SQL_INVOICE_EXPENSE_VENDOR_JOINS(collateStr)}
LEFT JOIN ru_dsa_kyc_data kyc_exp ON kyc_exp.dsa_id${collateStr} = e.dsa_id${collateStr}
LEFT JOIN ei_agg ei ON ei.expense_id = e.expense_join_key
LEFT JOIN ns_hier nh ON nh.class_id = kyc_exp.class_id`
          : `${ctePrefix}
SELECT COUNT(*) as totalCount
FROM expenses_typed e`;

      // Normalize where clause - remove any leading "where" or "and" keywords and rebuild properly
      let normalizedWhere = '';
      if (where && where.trim() !== '') {
          // Remove leading "where" or "and" keywords (case-insensitive)
          normalizedWhere = where.trim().replace(/^(where|and)\s+/i, '').trim();
          // Remove any remaining leading "and" keywords
          normalizedWhere = normalizedWhere.replace(/^and\s+/i, '').trim();
      }

      let hasWhereClause = false;
      if (normalizedWhere) {
          normalizedWhere = normalizeNsHierarchyClause(normalizedWhere);
          query += " WHERE " + normalizedWhere;
          queryCount += " WHERE " + normalizedWhere;
          hasWhereClause = true;
      }

      if (whereFilterQuery && whereFilterQuery.length) {
          if (!hasWhereClause) {
              query += " WHERE ";
              queryCount += " WHERE ";
              hasWhereClause = true;
          } else {
              query += " AND ";
              queryCount += " AND ";
          }

          for (let i = 0; i < whereFilterQuery.length; i++) {
              let [field, operator, value] = whereFilterQuery[i];
              if (typeof field === 'string' && field.includes('ns_hierarchy')) {
                  field = normalizeNsHierarchyClause(field);
              }
              if (field === 'SUM(ei.amount)') field = 'COALESCE(ei.amount, 0)';
              if (field === 'SUM(ei.tax_amount)') field = 'COALESCE(ei.tax_amount, 0)';
              if (field === 'SUM(ei.base_amount)') field = 'COALESCE(ei.base_amount, 0)';
              if (field === 'ns_hierarchy') field = 'nh.ns_hierarchy';

               if (field === 'created_at_date') field = "DATE_FORMAT(e.created_at, '%d-%m-%Y %h:%i %p')";
              if (field === 'bill_at_date') field = "DATE_FORMAT(e.bill_date, '%d-%m-%Y %h:%i %p')";
              if (field === 'approved_at') field = 'DATE(e.approved_at)';
              if (field === 'viewed_at') field = 'DATE(e.viewed_at)';
              if (/DATE\s*\(\s*e\.approved_at\s*\)/i.test(String(field))) {
                  value = normalizeExpenseDateFilterValue(value);
              }
              if (/DATE\s*\(\s*e\.viewed_at\s*\)/i.test(String(field))) {
                  value = normalizeExpenseDateFilterValue(value);
              }

              // ✅ Also normalize DD-MM-YYYY → YYYY-MM-DD
              if (/^(\d{2})-(\d{2})-(\d{4})$/.test(value)) {
                  const [, dd, mm, yyyy] = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
                  value = `${yyyy}-${mm}-${dd}`;
              }

              if (i > 0) {
                  query += ` ${logicOperator} `;
                  queryCount += ` ${logicOperator} `;
              }

              if (value !== null && value !== undefined && value !== '') {
                  query += `${field} ${operator} ?`;
                  queryCount += `${field} ${operator} ?`;
                  bindParams.push(value);
              } else {
                  query += `${field} ${operator}`;
                  queryCount += `${field} ${operator}`;
              }
          }

      }

      if (having && having.trim() !== '') {
          const normalizedHaving = normalizeNsHierarchyClause(having.trim().replace(/^having\s+/i, '').trim());
          if (normalizedHaving) {
              const wherePrefix = hasWhereClause ? " AND " : " WHERE ";
              query += `${wherePrefix}(${normalizedHaving})`;
              queryCount += `${wherePrefix}(${normalizedHaving})`;
              hasWhereClause = true;
          }
      }

      if (orderBy && typeof orderBy === 'string') {
          orderBy = orderBy.replace(/SUM\(ei\.amount\)/g, 'COALESCE(ei.amount, 0)')
                           .replace(/SUM\(ei\.tax_amount\)/g, 'COALESCE(ei.tax_amount, 0)')
                           .replace(/SUM\(ei\.base_amount\)/g, 'COALESCE(ei.base_amount, 0)')
                           .replace(/\bns_hierarchy\b/g, 'nh.ns_hierarchy');
      }
      query += orderBy ? ` ORDER BY ${orderBy} ` : ` ORDER BY e.created_at DESC `;
      if (limit !== undefined && offset !== undefined) {
          query += ` LIMIT ${offset}, ${limit} `;
      }

      return { query, queryCount, bindParams };
  };

  try {
      // For invoices: Use safe UUID join by default (no REGEXP) - much faster
      // created_by join is only for display, so missing matches are acceptable
      // This avoids REGEXP performance issues that cause query timeouts
      const { query, queryCount, bindParams } = buildQueries(false, true);
      const listReplacements = favouriteCreatedBy ? [favouriteCreatedBy, ...bindParams] : bindParams;
      const data = await _db2.query(query, { replacements: listReplacements, type: QueryTypes.SELECT });
      const totalCountResult = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
      mapExpenseRowsApprovedAtDateOnly(data);
      return { records: data, totalRecords: totalCountResult[0]?.totalCount };
  } catch (error) {
      // If collation error, retry with COLLATE clause
      if (error.original && (error.original.code === 'ER_CANT_AGGREGATE_2COLLATIONS' || error.original.errno === 1267)) {
          try {
              const { query, queryCount, bindParams } = buildQueries(true, true);
              const listReplacements = favouriteCreatedBy ? [favouriteCreatedBy, ...bindParams] : bindParams;
              const data = await _db2.query(query, { replacements: listReplacements, type: QueryTypes.SELECT });
              const totalCountResult = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
              mapExpenseRowsApprovedAtDateOnly(data);
              return { records: data, totalRecords: totalCountResult[0]?.totalCount };
          } catch (retryError) {
              // Re-throw if still fails
              throw retryError;
          }
      }
      // Re-throw other errors
      throw error;
  }
};

const BILLS_CTE_PREFIX = `
WITH expenses_typed AS (
  SELECT
    e.*,
    CASE
      WHEN (e.platform = 'crm' OR e.platform IS NULL)
           AND e.created_by REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN uuid_to_bin(e.created_by)
      ELSE NULL
    END AS created_by_bin,
    CASE
      WHEN e.platform = 'b2b' THEN e.created_by
      ELSE NULL
    END AS created_by_varchar,
    CAST(e.id AS CHAR) COLLATE utf8mb4_unicode_ci AS id_str,
    CAST(e.expense_id AS CHAR) COLLATE utf8mb4_unicode_ci AS expense_id_str
  FROM ru_dsa_expenses e
  WHERE e.category = 'bills'
),
expense_ids AS (
  SELECT id_str AS eid FROM expenses_typed
  UNION
  SELECT expense_id_str FROM expenses_typed
  WHERE expense_id_str IS NOT NULL AND expense_id_str <> ''
),
ei_agg AS (
  SELECT
    ei.expense_id AS expense_id,
    COALESCE(SUM(ei.amount), 0) AS amount,
    COALESCE(SUM(ei.tax_amount), 0) AS tax_amount,
    COALESCE(SUM(ei.base_amount), 0) AS base_amount,
    SUBSTRING_INDEX(
      GROUP_CONCAT(ei.expense_type ORDER BY ei.created_at DESC, ei.id DESC SEPARATOR '||'),
      '||', 1
    ) AS expense_type
  FROM ru_dsa_expense_items ei
  INNER JOIN expense_ids ids ON ids.eid = ei.expense_id
  GROUP BY ei.expense_id
)
`;

const BILLS_EI_JOINS = `
LEFT JOIN ei_agg ei_id ON ei_id.expense_id = e.id_str
LEFT JOIN ei_agg ei_uuid ON ei_uuid.expense_id = e.expense_id_str
  AND e.expense_id_str IS NOT NULL
  AND e.expense_id_str <> ''
  AND e.expense_id_str <> e.id_str`;

const BILLS_EXPENSE_TYPE_EXPR = `(CAST(COALESCE(ei_id.expense_type, ei_uuid.expense_type) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci)`;

exports.BILLS_EXPENSE_TYPE_EXPR = BILLS_EXPENSE_TYPE_EXPR;

const BILLS_FROM_JOINS = `
FROM expenses_typed e
LEFT JOIN CRMTest.users u ON u.id = e.created_by_bin
LEFT JOIN CRMTest.users lu ON lu.id = CASE
  WHEN e.log_updated_by REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN uuid_to_bin(e.log_updated_by)
  ELSE NULL
END
LEFT JOIN ru_direct_selling_agents ldu ON ldu.dsa_id = e.log_updated_by
LEFT JOIN ru_direct_selling_agents du ON du.dsa_mobile_number = u.phone
LEFT JOIN ru_dsa_kyc_data kyc_du ON kyc_du.dsa_id = du.dsa_id
LEFT JOIN ru_direct_selling_agents du2 ON du2.dsa_id = e.created_by_varchar
LEFT JOIN ru_direct_selling_agents d ON d.dsa_id = e.dsa_id
LEFT JOIN ru_dsa_kyc_data kyc_exp ON kyc_exp.dsa_id = e.dsa_id
${BILLS_EI_JOINS}
`;

exports.getBillsNew = async (offset, limit, where, having, whereFilterQuery, orderBy, cteRootPhone = null, hierarchyType = 'creator', favouriteCreatedBy = null) => {
  const logicOperator = "AND";

  const buildQueries = (activeWhereFilterQuery = whereFilterQuery) => {
    const bindParams = [];
    const billAmountExpr = `(COALESCE(ei_id.amount, 0) + COALESCE(ei_uuid.amount, 0))`;
    const billTaxExpr = `(COALESCE(ei_id.tax_amount, 0) + COALESCE(ei_uuid.tax_amount, 0))`;
    const billBaseExpr = `(COALESCE(ei_id.base_amount, 0) + COALESCE(ei_uuid.base_amount, 0))`;

    const billSelect = `
    e.*,
    COALESCE(lu.name, ldu.full_name, e.log_updated_by) AS log_updated_by,
    DATE(e.created_at)          AS created_at_date,
    DATE(e.bill_date)           AS bill_at_date,
    CASE
      WHEN e.status = '0' THEN 'Approval Pending'
      WHEN e.status = '1' THEN 'Approved By BH'
      WHEN e.status = '2' THEN 'Approved By CEO/CFO'
      ELSE 'Rejected'
    END AS status_name,
    CASE
      WHEN e.platform = 'b2b' THEN du2.full_name
      ELSE u.name
    END AS created_by_name,
    CASE
      WHEN e.platform = 'b2b' THEN du2.dsa_mobile_number
      ELSE u.phone
    END AS created_by_phone,
    d.full_name                 AS dsa_name,
    d.dsa_mobile_number         AS dsa_mobile_number,
    d.email_address             AS dsa_email_address,
    CASE
      WHEN e.platform = 'b2b' THEN d.gstin
      ELSE du.gstin
    END AS gstin,
    kyc_exp.permanent_account_number AS dsa_pan,
    kyc_exp.class_id AS dsa_class,
    COALESCE(ei_id.expense_type, ei_uuid.expense_type) AS expense_type,
    ${sqlExpenseFavouriteFlag(favouriteCreatedBy, 'e.id_str')},
    ${billAmountExpr}           AS amount,
    ${billTaxExpr}              AS tax_amount,
    ${billBaseExpr}             AS base_amount,
    DATE(e.approved_at)         AS approved_at`;

    let query = `${BILLS_CTE_PREFIX}
SELECT ${billSelect}
${BILLS_FROM_JOINS}
`;

    let queryCount = `${BILLS_CTE_PREFIX}
SELECT COUNT(DISTINCT e.id) AS totalCount
${BILLS_FROM_JOINS}
`;

    const hasWhere = where && where.trim().toLowerCase().startsWith('where');
    if (where && where.trim() !== '') {
      const whereClause = hasWhere ? where : (" WHERE " + where);
      query += " " + whereClause + " ";
      queryCount += " " + whereClause + " ";
    }

    if (activeWhereFilterQuery && activeWhereFilterQuery.length) {
      if (!hasWhere && (!where || where.trim() === '')) {
        query += " WHERE ";
        queryCount += " WHERE ";
      } else {
        query += " AND ";
        queryCount += " AND ";
      }

      for (let i = 0; i < activeWhereFilterQuery.length; i++) {
        let [field, operator, value] = activeWhereFilterQuery[i];

        if (field === 'created_at_date') field = "DATE_FORMAT(e.created_at, '%d-%m-%Y %h:%i %p')";
        if (field === 'bill_at_date')    field = "DATE_FORMAT(e.bill_date, '%d-%m-%Y %h:%i %p')";
        if (field === 'approved_at') field = 'DATE(e.approved_at)';
        if (field === 'viewed_at') field = 'DATE(e.viewed_at)';
        // Bills list uses ei_agg (ei_id / ei_uuid), not raw ei — never use MAX() in WHERE (ER_INVALID_GROUP_FUNC_USE).
        if (field === 'SUM(ei.amount)' || field === 'ei.amount') field = billAmountExpr;
        if (field === 'SUM(ei.tax_amount)' || field === 'ei.tax_amount') field = billTaxExpr;
        if (field === 'SUM(ei.base_amount)' || field === 'ei.base_amount') field = billBaseExpr;
        if (field === 'expense_type') field = BILLS_EXPENSE_TYPE_EXPR;
        if (/DATE\s*\(\s*e\.approved_at\s*\)/i.test(String(field))) {
          value = normalizeExpenseDateFilterValue(value);
        }
        if (/DATE\s*\(\s*e\.viewed_at\s*\)/i.test(String(field))) {
          value = normalizeExpenseDateFilterValue(value);
        }

        if (typeof value === 'string' && /^(\d{2})-(\d{2})-(\d{4})$/.test(value)) {
          const [, dd, mm, yyyy] = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
          value = `${yyyy}-${mm}-${dd}`;
        }

        if (i > 0) {
          query += ` ${logicOperator} `;
          queryCount += ` ${logicOperator} `;
        }

        if (value !== null && value !== undefined && value !== '') {
          query += `${field} ${operator} ?`;
          queryCount += `${field} ${operator} ?`;
          bindParams.push(value);
        } else {
          query += `${field} ${operator}`;
          queryCount += `${field} ${operator}`;
        }
      }
    }

    if (having && having.trim() !== '') {
      let havingPredicate = having.trim();
      if (havingPredicate.toLowerCase().startsWith('having')) {
        havingPredicate = havingPredicate.replace(/^\s*HAVING\s+/i, '');
      }
      havingPredicate = havingPredicate
        .replace(/SUM\(ei\.amount\)/g, billAmountExpr)
        .replace(/SUM\(ei\.tax_amount\)/g, billTaxExpr)
        .replace(/SUM\(ei\.base_amount\)/g, billBaseExpr);
      query += ` AND (${havingPredicate}) `;
      queryCount += ` AND (${havingPredicate}) `;
    }

    if (orderBy && typeof orderBy === 'string') {
      orderBy = orderBy
        .replace(/\bexpense_type\b/g, BILLS_EXPENSE_TYPE_EXPR)
        .replace(/SUM\(ei\.amount\)/g, billAmountExpr)
        .replace(/SUM\(ei\.tax_amount\)/g, billTaxExpr)
        .replace(/SUM\(ei\.base_amount\)/g, billBaseExpr);
    }

    query += orderBy ? ` ORDER BY ${orderBy} ` : ` ORDER BY e.created_at DESC `;
    if (limit !== undefined && offset !== undefined) {
      query += ` LIMIT ${offset}, ${limit} `;
    }

    return { query, queryCount, bindParams };
  };

  const stripCollateFromField = (fieldExpr) => {
    if (!fieldExpr || typeof fieldExpr !== 'string') return fieldExpr;
    
    let cleaned = fieldExpr.replace(/\s+COLLATE\s+[\w_]+/gi, '').trim();
    
    cleaned = cleaned.replace(/CAST\s*\(\s*([^()]+(?:\([^()]*\)[^()]*)*)\s+AS\s+CHAR\s+CHARACTER\s+SET\s+utf8mb4\s*\)/gi, '$1');
    
    return cleaned.trim();
  };

  const cleanWhereFilterQuery = (whereFilterQuery) => {
    if (!whereFilterQuery || !Array.isArray(whereFilterQuery)) return whereFilterQuery;
    return whereFilterQuery.map(([field, operator, value]) => {
      const cleanedField = stripCollateFromField(field);
      return [cleanedField, operator, value];
    });
  };

  try {
    const { query, queryCount, bindParams } = buildQueries();
    const listReplacements = favouriteCreatedBy ? [favouriteCreatedBy, ...bindParams] : bindParams;
    const data = await _db2.query(query, { replacements: listReplacements, type: QueryTypes.SELECT });
    const totalCountResult = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
    mapExpenseRowsApprovedAtDateOnly(data);
    return { records: data, totalRecords: totalCountResult[0]?.totalCount };
  } catch (error) {
    if (error.original && (error.original.code === 'ER_WRONG_VALUE_FOR_TYPE' || error.original.errno === 1411)) {
      try {
        const { query, queryCount, bindParams } = buildQueries();
        const listReplacements = favouriteCreatedBy ? [favouriteCreatedBy, ...bindParams] : bindParams;
        const data = await _db2.query(query, { replacements: listReplacements, type: QueryTypes.SELECT });
        const totalCountResult = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
        mapExpenseRowsApprovedAtDateOnly(data);
        return { records: data, totalRecords: totalCountResult[0]?.totalCount };
      } catch (retryError) {
        if (retryError.original && (retryError.original.code === 'ER_CANT_AGGREGATE_2COLLATIONS' || retryError.original.errno === 1267)) {
          const { query, queryCount, bindParams } = buildQueries();
          const listReplacements = favouriteCreatedBy ? [favouriteCreatedBy, ...bindParams] : bindParams;
          const data = await _db2.query(query, { replacements: listReplacements, type: QueryTypes.SELECT });
          const totalCountResult = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
          mapExpenseRowsApprovedAtDateOnly(data);
          return { records: data, totalRecords: totalCountResult[0]?.totalCount };
        }
        throw retryError;
      }
    }
    if (error.original && error.original.code === 'ER_CANT_AGGREGATE_2COLLATIONS') {
      const { query, queryCount, bindParams } = buildQueries();
      const listReplacements = favouriteCreatedBy ? [favouriteCreatedBy, ...bindParams] : bindParams;
      const data = await _db2.query(query, { replacements: listReplacements, type: QueryTypes.SELECT });
      const totalCountResult = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
      mapExpenseRowsApprovedAtDateOnly(data);
      return { records: data, totalRecords: totalCountResult[0]?.totalCount };
    }
    if (error.original && (error.original.code === 'ER_COLLATION_CHARSET_MISMATCH' || error.original.errno === 1253)) {
      const { query, queryCount, bindParams } = buildQueries(cleanWhereFilterQuery(whereFilterQuery));
      const listReplacements = favouriteCreatedBy ? [favouriteCreatedBy, ...bindParams] : bindParams;
      const data = await _db2.query(query, { replacements: listReplacements, type: QueryTypes.SELECT });
      const totalCountResult = await _db2.query(queryCount, { replacements: bindParams, type: QueryTypes.SELECT });
      mapExpenseRowsApprovedAtDateOnly(data);
      return { records: data, totalRecords: totalCountResult[0]?.totalCount };
    }
    throw error;
  }
};




exports.getExpenseItems = async (offset, limit, where) => {
    let query = ` select ei.* from ru_dsa_expense_items ei ${where} `;
    let queryCount = ` select count(ei.id) as totalCount from ru_dsa_expense_items ei ${where} `;

    query += ` order by created_at desc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";

    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });

    return { records: data, totalRecords: totalCount[0]?.totalCount };
};

exports.deleteExpense = async (expense_id) => {
    let query = ` update ru_dsa_expenses set is_deleted = 1 where id = ${expense_id} `;
    await _db2.query(query, { type: QueryTypes.UPDATE });

    query = ` update ru_dsa_expense_items set is_deleted = 1 where expense_id = ${expense_id} `;
    await _db2.query(query, { type: QueryTypes.UPDATE });
    return;
};

exports.deleteExpenseItems = async (item_id) => {
    query = ` update ru_dsa_expense_items set is_deleted = 1 where id = ${item_id} `;
    await _db2.query(query, { type: QueryTypes.UPDATE });
    return;
};

exports.getBbpsPayments = async (offset, limit, where) => {
    let query = ` select bbps.id, CONCAT_WS(' ', c.first_name, c.middle_name, c.last_name) AS customer_full_name, c.customer_mobile_number, CONCAT_WS(' ', d.first_name, d.middle_name, d.last_name) AS dsa_full_name, d.dsa_mobile_number, bbps.biller_name, bbps.biller_category, bbps.amount_paid, bbps.created_at, bbps.updated_at, bbps.txn_id, bbps.txn_url, bbps.status, bbps.biller_id, bbps.session_id, bbps.reference_id, bpd.bill_number, bpd.bill_amount, bpd.due_date from ru_bbps_payments bbps left join ru_customers c on bbps.customer_id = c.customer_id left join ru_direct_selling_agents d on bbps.dsa_id = d.dsa_id left join ru_bbps_payment_details bpd ON bbps.id = bpd.bbps_payment_id ${where} group by bbps.id,  bpd.id `;
    // let queryCount = ` select count(distinct bbps.id) as totalCount from ru_bbps_payments bbps left join ru_customers c on bbps.customer_id = c.customer_id left join ru_direct_selling_agents d on bbps.dsa_id = d.dsa_id left join ru_bbps_payment_details bpd ON bbps.id = bpd.bbps_payment_id  ${where} `; //Old Query --- 
    let queryCount = ` select count(*) as totalCount from ( select bbps.id as bbps_payment_id, bpd.id as bbps_payment_detail_id from ru_bbps_payments bbps left join ru_customers c on bbps.customer_id = c.customer_id left join ru_direct_selling_agents d on bbps.dsa_id = d.dsa_id left join ru_bbps_payment_details bpd ON bbps.id = bpd.bbps_payment_id ${where} group by bbps.id, bpd.id ) bbps_payment_rows `;

    query += ` order by bbps.created_at desc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";

    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });

    return { records: data, totalRecords: totalCount[0]?.totalCount };
};

exports.getBbpsPaymentTotal = async (where) => {
    let query = ` select sum(bbps.amount_paid) as total_amount_paid from ru_bbps_payments bbps left join ru_direct_selling_agents d on bbps.dsa_id = d.dsa_id ${where} `;
    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    return {
        id: uuid(),
        dsa_full_name: "Total",
        total_amount_paid: data[0]?.total_amount_paid || null,
        created_at: new Date()
    };
};

exports.getBbpsPaymentCategoryWise = async (offset, limit, where) => {
    query = ` select bbps.id, bbps.dsa_id, d.dsa_mobile_number, concat_ws(' ', d.first_name, d.middle_name, d.last_name) as dsa_full_name, bbps.biller_category, sum(bbps.amount_paid) as total_amount_paid, bbps.created_at, bbps.updated_at from ru_bbps_payments bbps left join ru_direct_selling_agents d on bbps.dsa_id = d.dsa_id ${where} group by bbps.dsa_id, bbps.biller_category `;
    let queryCount = ` select count(distinct bbps.dsa_id, bbps.biller_category) as totalCount 
        from ru_bbps_payments bbps 
        left join ru_direct_selling_agents d on bbps.dsa_id = d.dsa_id 
        ${where} `;

    query += ` order by bbps.created_at desc `;
    query += limit ? ` limit ${offset}, ${limit} ` : "";

    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    let totalCount = await _db2.query(queryCount, { type: QueryTypes.SELECT });

    return { records: data, totalRecords: totalCount[0]?.totalCount };
};

exports.getBbpsPaymentDateWise = async (where) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const startOfFinancialYear = new Date(today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear(), 3, 1).toISOString().split('T')[0]

    const query = `
        SELECT 
            bbps.id, 
            bbps.biller_category, 
            SUM(CASE WHEN DATE(bbps.created_at) >= DATE('${new Date().toISOString().split('T')[0]}') THEN bbps.amount_paid ELSE 0 END) AS ftd_total_amount_paid,
            SUM(CASE WHEN DATE(bbps.created_at) >= DATE('${startOfMonth}') THEN bbps.amount_paid ELSE 0 END) AS mtd_total_amount_paid,
            SUM(CASE WHEN DATE(bbps.created_at) >= DATE('${startOfFinancialYear}') THEN bbps.amount_paid ELSE 0 END) AS ytd_total_amount_paid
        FROM ru_bbps_payments bbps LEFT JOIN ru_direct_selling_agents d ON bbps.dsa_id = d.dsa_id ${where} GROUP BY bbps.biller_category `;

    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    return data;
};

exports.getDefaultDSA = async (offset, limit, where) => {
    query = ` select * from ru_settings where setting_key = 'default_dsa' `;
    let data = await _db2.query(query, { type: QueryTypes.SELECT });
    return data[0] || null;
};
exports.getConsolidatedExpenses = async (billId) => {
    const dataQuery = `
        SELECT 
            ecm.expense_claim_mapping_id AS expense_claim_mapping_id,
            ecm.expense_id AS expense_id,
            ecm.fresh_lead_id AS fresh_lead_id,
            flc.netsuite_vendor_claim_file_internal_id AS netsuite_vendor_claim_file_internal_id,
            ecm.claim_month AS actual_claim_month,
            ecm.customer_name AS customer_full_name,
            ecm.disb_date AS actual_disb_date,
            ecm.disb_amount AS actual_disb_amount,
            ecm.bank_disb_amount AS actual_bank_disb_amount,
            ecm.bank_id AS actual_bank_id,
            ecm.product AS actual_product,
            ecm.adjustment_amount AS actual_adjustment_amount,
            ecm.payout_rate AS actual_payout_rate,
            ecm.actual_paid_rate AS actual_paid_rate,
            ecm.claim_payout AS actual_claim_payout,
            ecm.confirmed_payout AS actual_confirmed_payout,
            ecm.status AS actual_status_by_script
        FROM ru_expense_claim_mappings ecm
        LEFT JOIN ru_fresh_lead_claims flc 
            ON ecm.fresh_lead_id = flc.fresh_lead_id
        WHERE ecm.expense_id = ?;
    `;

    const data = await _db2.query(
        dataQuery,
        {
            replacements: [billId],
            type: QueryTypes.SELECT
        }
    );

    return { records: data };
};


exports.getInvoiceDetails = async (invoiceId) => {
    let query = ` select * from ru_dsa_expenses where expense_id = ? `;
    let data = await _db2.query(query, { replacements: [invoiceId], type: QueryTypes.SELECT });
    return data[0];
};
exports.getInvoiceCompanyandBankDetails = async (invoiceId) => {
    // If expense has bank_account_id, use snapshot on ru_dsa_expenses; else vendor profile bank.
    const snapRows = await _db2.query(
        `SELECT expense_id, bank_account_id
         FROM ru_dsa_expenses
         WHERE expense_id = ?`,
        { replacements: [invoiceId], type: QueryTypes.SELECT }
    );
    if (!snapRows[0]) return null;

    const useExpenseBank =
        snapRows[0].bank_account_id != null && String(snapRows[0].bank_account_id).trim() !== '';

    let query = `
    SELECT
    e.expense_id AS invoice_id,
    CASE
        WHEN rc_self.company_id IS NOT NULL THEN rc_self.name
        WHEN rc.company_id IS NOT NULL THEN rc.name
        WHEN ind_d.user_type = 'company'
             AND NULLIF(TRIM(ind_d.company_name), '') IS NOT NULL
             AND owned_company.ns_internal_id IS NOT NULL
             AND owned_company.ns_internal_id = e.netsuite_vendor_id
        THEN ind_d.company_name
        ELSE ind_d.full_name
    END AS vendor_company_name,
    CASE
        WHEN rc_self.company_id IS NOT NULL THEN COALESCE(reg_self.dsa_mobile_number, ind_d.dsa_mobile_number)
        WHEN rc.company_id IS NOT NULL THEN COALESCE(reg_d.dsa_mobile_number, rc.phone)
        ELSE ind_d.dsa_mobile_number
    END AS phone_number,
    CASE
        WHEN rc_self.company_id IS NOT NULL THEN COALESCE(reg_self.email_address, ind_d.email_address)
        WHEN rc.company_id IS NOT NULL THEN reg_d.email_address
        ELSE ind_d.email_address
    END AS email,
    CASE
        WHEN rc_self.company_id IS NOT NULL THEN rc_self.pan
        WHEN kyc_vendor.dsa_id IS NOT NULL THEN kyc_vendor.permanent_account_number
        WHEN rc.company_id IS NOT NULL THEN rc.pan
        WHEN kyc_exp.dsa_id IS NOT NULL THEN kyc_exp.permanent_account_number
        ELSE NULL
    END AS pan,
    CASE
        WHEN rc_self.company_id IS NOT NULL THEN rc_self.gstin
        WHEN rc.company_id IS NOT NULL THEN rc.gstin
        ELSE ind_d.gstin
    END AS gstin,
    CASE
        WHEN (rc_self.company_id IS NOT NULL OR rc.company_id IS NOT NULL) AND ca.id IS NOT NULL THEN
            CONCAT_WS(', ', ca.address_line_1, ca.address_line_2, ca.address_line_3, ca.city, ca.state, ca.pin_code, ca.country)
        WHEN rc_self.company_id IS NOT NULL THEN
            CONCAT_WS(', ',
                NULLIF(reg_self.office_address_house_number, ''), NULLIF(reg_self.home_address_house_number, ''),
                NULLIF(reg_self.office_address_area, ''), NULLIF(reg_self.home_address_area, ''),
                COALESCE(NULLIF(reg_self.office_address_city, ''), reg_self.home_address_city),
                COALESCE(NULLIF(reg_self.office_address_state, ''), reg_self.home_address_state),
                COALESCE(NULLIF(reg_self.office_address_pincode, ''), reg_self.home_address_pincode)
            )
        WHEN rc.company_id IS NOT NULL THEN
            CONCAT_WS(', ',
                NULLIF(reg_d.office_address_house_number, ''), NULLIF(reg_d.home_address_house_number, ''),
                NULLIF(reg_d.office_address_area, ''), NULLIF(reg_d.home_address_area, ''),
                COALESCE(NULLIF(reg_d.office_address_city, ''), reg_d.home_address_city),
                COALESCE(NULLIF(reg_d.office_address_state, ''), reg_d.home_address_state),
                COALESCE(NULLIF(reg_d.office_address_pincode, ''), reg_d.home_address_pincode)
            )
        WHEN ind_addr.dsa_id IS NOT NULL THEN
            CONCAT_WS(', ', ind_addr.address_line_1, ind_addr.address_line_2, ind_addr.address_line_3,
                ind_addr.city, ind_addr.state, ind_addr.pin_code, ind_addr.country)
        ELSE
            CONCAT_WS(', ',
                NULLIF(ind_d.office_address_house_number, ''), NULLIF(ind_d.home_address_house_number, ''),
                NULLIF(ind_d.office_address_area, ''), NULLIF(ind_d.home_address_area, ''),
                COALESCE(NULLIF(ind_d.office_address_city, ''), ind_d.home_address_city),
                COALESCE(NULLIF(ind_d.office_address_state, ''), ind_d.home_address_state),
                COALESCE(NULLIF(ind_d.office_address_pincode, ''), ind_d.home_address_pincode)
            )
    END AS complete_office_address,
    ${useExpenseBank ? `
    e.bank_name AS bank_name,
    e.bank_account_number AS account_number,
    e.ifsc_code AS ifsc
    ` : `
    CASE
        WHEN rc_self.company_id IS NOT NULL OR rc.company_id IS NOT NULL THEN company_bank.bank_name
        ELSE ind_bank.bank_name
    END AS bank_name,
    CASE
        WHEN rc_self.company_id IS NOT NULL OR rc.company_id IS NOT NULL THEN company_bank.account_number
        ELSE ind_bank.account_number
    END AS account_number,
    CASE
        WHEN rc_self.company_id IS NOT NULL OR rc.company_id IS NOT NULL THEN company_bank.ifsc
        ELSE ind_bank.ifsc
    END AS ifsc
    `}
    FROM ru_dsa_expenses e
    LEFT JOIN ru_direct_selling_agents ind_d ON ind_d.dsa_id = e.dsa_id
    LEFT JOIN ru_dsa_kyc_data kyc_exp ON kyc_exp.dsa_id = e.dsa_id
    LEFT JOIN ru_dsa_kyc_data kyc_vendor
        ON kyc_vendor.netsuite_vendor_id = e.netsuite_vendor_id
        AND e.netsuite_vendor_id IS NOT NULL
        AND e.netsuite_vendor_id != ''
    LEFT JOIN (
        SELECT rdd.* FROM ru_dsa_addresses rdd
        INNER JOIN (SELECT dsa_id, MAX(created_at) AS max_created_at FROM ru_dsa_addresses GROUP BY dsa_id) latest_rdd
          ON rdd.dsa_id = latest_rdd.dsa_id AND rdd.created_at = latest_rdd.max_created_at
    ) ind_addr ON ind_addr.dsa_id = e.dsa_id
    LEFT JOIN ru_companies rc_self ON rc_self.company_id = e.dsa_id AND ind_d.dsa_id IS NULL
    LEFT JOIN ru_direct_selling_agents reg_self ON reg_self.dsa_id = rc_self.registered_by
    LEFT JOIN ru_companies rc
        ON rc.ns_internal_id = e.netsuite_vendor_id
        AND e.netsuite_vendor_id IS NOT NULL
        AND e.netsuite_vendor_id != ''
        AND kyc_vendor.dsa_id IS NULL
    LEFT JOIN ru_direct_selling_agents reg_d ON reg_d.dsa_id = rc.registered_by
    LEFT JOIN ru_companies owned_company ON owned_company.company_id = ind_d.company_id
    LEFT JOIN ru_company_addresses ca ON ca.id = (
        SELECT ca2.id FROM ru_company_addresses ca2
        WHERE ca2.company_id = COALESCE(rc_self.company_id, rc.company_id)
        ORDER BY
            CASE ca2.address_type_id
                WHEN 'company_address' THEN 1
                WHEN 'business_address' THEN 2
                WHEN 'gst_billing_address' THEN 3
                ELSE 4
            END ASC,
            ca2.created_at DESC
        LIMIT 1
    )
    ${useExpenseBank ? '' : `
    ${sqlPreferredBankAccountJoinByDsaId("ind_bank", "e.dsa_id")}
    ${sqlPreferredBankAccountJoinByCompanyId("company_bank", "COALESCE(rc_self.company_id, rc.company_id)", "(rc_self.company_id IS NOT NULL OR rc.company_id IS NOT NULL)")}
    `}
    WHERE e.expense_id = ?
    LIMIT 1;
`;
    let data = await _db2.query(query, { replacements: [invoiceId], type: QueryTypes.SELECT });
    return data[0];
};

exports.getActivityLogs = async (expenseId) => {
    const query = `SELECT 
    rle.action,
    u.name AS dsa_name,
    r.role AS role_name,
    rle.remarks,
    rle.created_at
FROM 
    RULoans.ru_expense_activity_logs AS rle
JOIN 
    CRMTest.users AS u ON rle.dsa_id = BIN_TO_UUID(u.id)
LEFT JOIN 
    CRMTest.roles AS r ON u.role = r.id
WHERE 
    rle.expense_id = ?
  AND 
    rle.action = 'REJECTED'
ORDER BY 
    rle.created_at DESC;

`;

    const data = await _db2.query(query, {
        replacements: [expenseId],
        type: QueryTypes.SELECT
    });

    return data;

};  



exports.getAnalyticsData = async (chart, dateFrom, dateTo) => {
  const WHERE = `DATE(e.created_at) BETWEEN :dateFrom AND :dateTo`;

  const bucketBy = (field = "e.created_at", granularity = "day") => {
    const g = (granularity || "day").toLowerCase();
    if (g === "day")   return `DATE_FORMAT(${field}, '%Y-%m-%d')`;
    if (g === "week")  return `DATE_FORMAT(${field}, '%x-%v')`; // ISO year-week
    if (g === "month") return `DATE_FORMAT(${field}, '%Y-%m')`;
    return field;
  };

  // ---- Amount source: SUM(items.amount) per expense ----
  const AMOUNT_JOIN = `
    LEFT JOIN (
      SELECT expense_id, COALESCE(SUM(amount), 0) AS amt
      FROM ru_dsa_expense_items
      GROUP BY expense_id
    ) ei ON ei.expense_id = e.id
  `;
  const AMOUNT_EXPR = `COALESCE(ei.amt, 0)`;

  // Status buckets
  const CASES = {
    pending: `CASE WHEN e.status_alias IS NULL THEN 1 ELSE 0 END`,
    unsigned: `CASE WHEN e.status_alias IN ('e_sign_created','e_sign_viewed') THEN 1 ELSE 0 END`,
    signed: `CASE WHEN e.status_alias = 'e_sign_completed' THEN 1 ELSE 0 END`,
    rejected: `CASE WHEN e.status_alias IN ('e_sign_declined','crm_rejected') THEN 1 ELSE 0 END`,
    pendingAmt:  (amt) => `CASE WHEN e.status_alias IS NULL THEN ${amt} ELSE 0 END`,
    unsignedAmt: (amt) => `CASE WHEN e.status_alias IN ('e_sign_created','e_sign_viewed') THEN ${amt} ELSE 0 END`,
    signedAmt:   (amt) => `CASE WHEN e.status_alias = 'e_sign_completed' THEN ${amt} ELSE 0 END`,
    rejectedAmt: (amt) => `CASE WHEN e.status_alias IN ('e_sign_declined','crm_rejected') THEN ${amt} ELSE 0 END`,
  };

  // Rejection split (only crm & ns now)
  const REJ = {
    crm:  `CASE WHEN e.status_alias = 'crm_rejected' THEN 1 ELSE 0 END`,
    ns:   `CASE WHEN e.status_alias = 'e_sign_declined' THEN 1 ELSE 0 END`,
    crmAmt:  (amt) => `CASE WHEN e.status_alias = 'crm_rejected' THEN ${amt} ELSE 0 END`,
    nsAmt:   (amt) => `CASE WHEN e.status_alias = 'e_sign_declined' THEN ${amt} ELSE 0 END`,
  };
const NORM_EMAIL = `CAST(d.email_address AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci`;

const INVALID_EMAIL_COND = `${NORM_EMAIL} IS NOT NULL 
  AND ${NORM_EMAIL} NOT REGEXP '^[^@ ]+@[^@ ]+\\\\.[^@ ]+$'`;

  switch (chart) {
    // 1) Funnel (counts only) + Bounced Email
    case "funnel": {
      const sql = `
        SELECT
          SUM(${CASES.pending})  AS pending,
          SUM(${CASES.unsigned}) AS \`unsigned_cnt\`,
          SUM(${CASES.signed})   AS signed,
          SUM(CASE WHEN e.status_alias IS NULL AND (${INVALID_EMAIL_COND}) THEN 1 ELSE 0 END) AS bounced_cnt
        FROM ru_dsa_expenses e
        LEFT JOIN ru_direct_selling_agents d ON e.dsa_id = d.dsa_id
        WHERE ${WHERE}
      `;
      const [r] = await _db2.query(sql, { replacements: { dateFrom, dateTo }, type: QueryTypes.SELECT });
      return {
        success: true,
        data: [
          { stage: "Pending",       count: Number(r?.pending || 0) },
          { stage: "Unsigned",      count: Number(r?.unsigned_cnt || 0) },
          { stage: "Signed",        count: Number(r?.signed || 0) },
          { stage: "Bounced Email", count: Number(r?.bounced_cnt || 0) },
        ],
      };
    }

    // 2) Rejection Split (crm & ns) — counts + amounts
    case "rejection_split": {
      const sql = `
        SELECT
          SUM(${REJ.crm}) AS crm_cnt,
          SUM(${REJ.ns})  AS ns_cnt,
          SUM(${REJ.crmAmt(AMOUNT_EXPR)}) AS crm_amt,
          SUM(${REJ.nsAmt(AMOUNT_EXPR)})  AS ns_amt
        FROM ru_dsa_expenses e
        ${AMOUNT_JOIN}
        WHERE ${WHERE}
      `;
      const [r] = await _db2.query(sql, { replacements: { dateFrom, dateTo }, type: QueryTypes.SELECT });
      return {
        success: true,
        data: [
          { source: "crm", count: Number(r?.crm_cnt || 0), amount: Number(r?.crm_amt || 0) },
          { source: "ns",  count: Number(r?.ns_cnt  || 0), amount: Number(r?.ns_amt  || 0) },
        ],
      };
    }

    // 3) Status Trend (counts + amounts)
    case "status_trend": {
      const bucket = bucketBy("e.created_at", "day");
      const sql = `
        SELECT
          ${bucket} AS bucket,
          SUM(${CASES.pending})  AS pending,
          SUM(${CASES.unsigned}) AS \`unsigned_cnt\`,
          SUM(${CASES.signed})   AS signed,
          SUM(${CASES.rejected}) AS rejected,
          SUM(${CASES.pendingAmt(AMOUNT_EXPR)})  AS pending_amount,
          SUM(${CASES.unsignedAmt(AMOUNT_EXPR)}) AS unsigned_amount,
          SUM(${CASES.signedAmt(AMOUNT_EXPR)})   AS signed_amount,
          SUM(${CASES.rejectedAmt(AMOUNT_EXPR)}) AS rejected_amount
        FROM ru_dsa_expenses e
        ${AMOUNT_JOIN}
        WHERE ${WHERE}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;
      const rows = await _db2.query(sql, { replacements: { dateFrom, dateTo }, type: QueryTypes.SELECT });
      return {
        success: true,
        data: rows.map(r => ({
          date: r.bucket,
          pending: Number(r.pending || 0),
          unsigned: Number(r.unsigned_cnt || 0),
          signed: Number(r.signed || 0),
          rejected: Number(r.rejected || 0),
          pending_amount: Number(r.pending_amount || 0),
          unsigned_amount: Number(r.unsigned_amount || 0),
          signed_amount: Number(r.signed_amount || 0),
          rejected_amount: Number(r.rejected_amount || 0),
        })),
      };
    }

    // 4) Top Vendors (amount via items, name via DSA)
    case "top_vendors": {
      const sql = `
        SELECT
          COALESCE(d.full_name, 'Unknown') AS vendor_name,
          COUNT(DISTINCT e.id) AS cnt,
          SUM(${AMOUNT_EXPR}) AS amt
        FROM ru_dsa_expenses e
        ${AMOUNT_JOIN}
        LEFT JOIN ru_direct_selling_agents d ON e.dsa_id = d.dsa_id
        WHERE ${WHERE}
        GROUP BY vendor_name
        ORDER BY amt DESC, cnt DESC
        LIMIT 10
      `;
      const rows = await _db2.query(sql, { replacements: { dateFrom, dateTo }, type: QueryTypes.SELECT });
      return {
        success: true,
        data: rows.map(r => ({
          vendor_name: r.vendor_name,
          count: Number(r.cnt || 0),
          amount: Number(r.amt || 0),
        })),
      };
    }

    // 5) Rejection Trend (counts only; crm & ns)
    case "rejection_trend": {
      const bucket = bucketBy("e.created_at", "day");
      const sql = `
        SELECT
          ${bucket} AS bucket,
          SUM(${REJ.crm}) AS crm,
          SUM(${REJ.ns})  AS ns
        FROM ru_dsa_expenses e
        WHERE ${WHERE}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;
      const rows = await _db2.query(sql, { replacements: { dateFrom, dateTo }, type: QueryTypes.SELECT });
      return {
        success: true,
        data: rows.map(r => ({
          date: r.bucket,
          crm: Number(r.crm || 0),
          ns: Number(r.ns || 0),
        })),
      };
    }

    // 6) Cohort Conversion (counts only)
    case "cohort_conversion": {
      const cohort = bucketBy("e.created_at", "month");
      const sql = `
        SELECT
          ${cohort} AS cohort,
          COUNT(*) AS pending_count,
          SUM(CASE WHEN e.status_alias = 'e_sign_completed' THEN 1 ELSE 0 END) AS signed_count
        FROM ru_dsa_expenses e
        WHERE ${WHERE}
        GROUP BY cohort
        ORDER BY cohort ASC
      `;
      const rows = await _db2.query(sql, { replacements: { dateFrom, dateTo }, type: QueryTypes.SELECT });
      return {
        success: true,
        data: rows.map(r => {
          const pending = Number(r.pending_count || 0);
          const signed = Number(r.signed_count || 0);
          const conversion_rate = pending ? Number(((signed / pending) * 100).toFixed(2)) : 0;
          return { cohort: r.cohort, pending_count: pending, signed_count: signed, conversion_rate };
        }),
      };
    }

    default:
      return { success: true, data: [] };
  }
};

/**
 * Intentionally no longer clears sign_id/url on resend.
 * OpenSign reuses the doc when Python passes existing sign_id in create payload.
 * Prefer clearSignFieldsAfterDecline when a declined doc must get a fresh OpenSign object.
 */
exports.resetInvoiceSignFieldsIfPresent = async (expense_ids = []) => {
    const ids = [...new Set((expense_ids || []).map((id) => String(id).trim()).filter(Boolean))];
    if (!ids.length) return [];

    const placeholders = ids.map(() => "?").join(",");
    const rows = await _db2.query(
        `SELECT expense_id
         FROM ru_dsa_expenses
         WHERE expense_id IN (${placeholders})`,
        { replacements: ids, type: QueryTypes.SELECT }
    );

    return rows.map((r) => String(r.expense_id));
};

/** Clear sign fields only after decline so the next create gets a new OpenSign document. */
exports.clearSignFieldsAfterDecline = async (expense_id) => {
    if (!expense_id) return false;
    await _db2.query(
        `UPDATE ru_dsa_expenses
         SET sign_id = NULL,
             sign_url = NULL,
             sign_cert_url = NULL,
             sign_completed_at = NULL
         WHERE expense_id = ?`,
        { replacements: [expense_id], type: QueryTypes.UPDATE }
    );
    return true;
};

exports.updateInvoiceContactDetails = async (expense_id, dsa_id, email) => {
    try {
        // Update DSA email only — do not clear expense sign_id/url (OpenSign reuse on resend).
        const query = `
            UPDATE ru_direct_selling_agents 
            SET email_address = ?, is_email_address_verified = 1, updated_at = NOW()
            WHERE dsa_id = ?
        `;
        
        await _db2.query(query, { 
            replacements: [email, dsa_id], 
            type: QueryTypes.UPDATE 
        });

        return true;
    } catch (error) {
        console.log('Error updating invoice contact details:', error);
        throw error;
    }
};

exports.markExpenseReadState = async ({ expense_id, viewed_at }) => {
    const query = `
        UPDATE ru_dsa_expenses
        SET viewed_at = ?, updated_at = NOW()
        WHERE expense_id = ?
    `;
    const result = await _db2.query(query, {
        replacements: [viewed_at, expense_id],
        type: QueryTypes.UPDATE
    });
    return result;
};

const SQL_FAV_USER_EXPENSE = `created_by COLLATE utf8mb4_unicode_ci = CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci
  AND expense_id COLLATE utf8mb4_unicode_ci = CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci`;

const SQL_FAV_USER_FAVOURITE_ID = `favourite_id = ? AND created_by COLLATE utf8mb4_unicode_ci = CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci`;

function normalizeFavouriteExpenseId(expense_id) {
  const n = typeof expense_id === 'string' ? parseInt(expense_id, 10) : Number(expense_id);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Invalid expense_id');
  }
  return { numericId: n, idStr: String(n) };
}

function normalizeLabel(label) {
  if (label == null || String(label).trim() === '') return null;
  return String(label).trim();
}

exports.addFavourite = async ({ created_by, expense_id, favourite_id, label }) => {
  const labelValue = normalizeLabel(label);

  if (favourite_id) {
    const fid = String(favourite_id).trim();
    const row = await _db2.query(
      `SELECT favourite_id FROM ru_expense_favourites WHERE ${SQL_FAV_USER_FAVOURITE_ID} LIMIT 1`,
      { replacements: [fid, created_by], type: QueryTypes.SELECT }
    );
    if (!row?.length) {
      throw new Error('Favourite not found');
    }
    await _db2.query(
      `UPDATE ru_expense_favourites SET label = ?, updated_at = NOW() WHERE ${SQL_FAV_USER_FAVOURITE_ID}`,
      { replacements: [labelValue, fid, created_by], type: QueryTypes.UPDATE }
    );
    return { favourite_id: fid };
  }

  const { numericId, idStr } = normalizeFavouriteExpenseId(expense_id);

  const rows = await _db2.query(
    `SELECT id FROM ru_dsa_expenses WHERE id = ? AND created_by = ? AND category = 'bills' LIMIT 1`,
    { replacements: [numericId, created_by], type: QueryTypes.SELECT }
  );
  if (!rows || !rows.length) {
    throw new Error('You can only favourite your own bills');
  }

  const transaction = await _db2.transaction();
  try {
    const existing = await _db2.query(
      `SELECT favourite_id FROM ru_expense_favourites WHERE ${SQL_FAV_USER_EXPENSE} LIMIT 1`,
      { replacements: [created_by, idStr], type: QueryTypes.SELECT, transaction }
    );

    let favouriteId;
    if (existing && existing[0]) {
      favouriteId = existing[0].favourite_id;
      await _db2.query(
        `UPDATE ru_expense_favourites SET label = ?, updated_at = NOW() WHERE ${SQL_FAV_USER_EXPENSE}`,
        { replacements: [labelValue, created_by, idStr], type: QueryTypes.UPDATE, transaction }
      );
    } else {
      favouriteId = uuid();
      await _db2.query(
        `INSERT INTO ru_expense_favourites (favourite_id, created_by, expense_id, label, is_reminder, reminder_day, last_reminded, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, NULL, NULL, NOW(), NOW())`,
        { replacements: [favouriteId, created_by, idStr, labelValue], type: QueryTypes.INSERT, transaction }
      );
    }

    await transaction.commit();
    return { favourite_id: favouriteId };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

exports.removeFavourite = async ({ created_by, expense_id, favourite_id }) => {
  if (favourite_id) {
    const fid = String(favourite_id).trim();
    await _db2.query(
      `DELETE FROM ru_expense_favourites WHERE ${SQL_FAV_USER_FAVOURITE_ID}`,
      { replacements: [fid, created_by], type: QueryTypes.DELETE }
    );
    return { ok: true };
  }
  const { idStr } = normalizeFavouriteExpenseId(expense_id);
  await _db2.query(
    `DELETE FROM ru_expense_favourites WHERE ${SQL_FAV_USER_EXPENSE}`,
    { replacements: [created_by, idStr], type: QueryTypes.DELETE }
  );
  return { ok: true };
};

exports.getFavourites = async ({ created_by }) => {
  const records = await _db2.query(
    `SELECT
      f.favourite_id,
      f.expense_id,
      f.label,
      f.is_reminder,
      f.reminder_day,
      e.memo,
      e.bill_number,
      e.bill_date,
      (SELECT COALESCE(SUM(ei.amount), 0) FROM ru_dsa_expense_items ei WHERE ei.expense_id = e.id) AS amount,
      e.city,
      e.status,
      d.full_name AS dsa_name,
      d.dsa_mobile_number,
      k.permanent_account_number AS pan
    FROM ru_expense_favourites f
    INNER JOIN ru_dsa_expenses e ON e.id = f.expense_id
    INNER JOIN ru_direct_selling_agents d ON d.dsa_id = e.dsa_id
    LEFT JOIN ru_dsa_kyc_data k ON k.dsa_id = e.dsa_id
    WHERE f.created_by = ?
    ORDER BY f.created_at DESC`,
    { replacements: [created_by], type: QueryTypes.SELECT }
  );

  const list = records || [];
  return { records: list, totalRecords: list.length };
};

exports.setReminder = async ({ created_by, expense_id, favourite_id, reminder_day, label }) => {
  const whereSql = favourite_id
    ? SQL_FAV_USER_FAVOURITE_ID
    : SQL_FAV_USER_EXPENSE;
  const whereRepl = favourite_id
    ? [String(favourite_id).trim(), created_by]
    : (() => {
        const { idStr } = normalizeFavouriteExpenseId(expense_id);
        return [created_by, idStr];
      })();

  const fav = await _db2.query(
    `SELECT favourite_id FROM ru_expense_favourites WHERE ${whereSql} LIMIT 1`,
    { replacements: whereRepl, type: QueryTypes.SELECT }
  );
  if (!fav || !fav.length) {
    throw new Error('Bill not in favourites');
  }

  const rd = reminder_day != null && reminder_day !== '' ? Number(reminder_day) : null;
  const labelProvided = label !== undefined;
  const labelValue = labelProvided ? normalizeLabel(label) : undefined;

  if (rd != null && rd >= 1 && rd <= 28) {
    const setLabel = labelProvided ? ', label = ?' : '';
    const reps = labelProvided ? [rd, labelValue, ...whereRepl] : [rd, ...whereRepl];
    await _db2.query(
      `UPDATE ru_expense_favourites SET is_reminder = 1, reminder_day = ?, updated_at = NOW()${setLabel}
       WHERE ${whereSql}`,
      { replacements: reps, type: QueryTypes.UPDATE }
    );
  } else {
    const setLabel = labelProvided ? ', label = ?' : '';
    const reps = labelProvided ? [labelValue, ...whereRepl] : whereRepl;
    await _db2.query(
      `UPDATE ru_expense_favourites SET is_reminder = 0, reminder_day = NULL, updated_at = NOW()${setLabel}
       WHERE ${whereSql}`,
      { replacements: reps, type: QueryTypes.UPDATE }
    );
  }
  return { ok: true };
};

// Returns matching reminders without mutating last_reminded; client must call dismissReminder to snooze.
exports.checkReminders = async ({ created_by }) => {
  const rows = await _db2.query(
    `SELECT
      f.favourite_id,
      f.expense_id,
      f.label,
      f.reminder_day,
      e.memo,
      (SELECT COALESCE(SUM(ei.amount), 0) FROM ru_dsa_expense_items ei WHERE ei.expense_id = e.id) AS amount,
      e.bill_date AS last_bill_date,
      d.full_name AS dsa_name,
      d.dsa_mobile_number
    FROM ru_expense_favourites f
    INNER JOIN ru_dsa_expenses e ON e.id = f.expense_id
    INNER JOIN ru_direct_selling_agents d ON d.dsa_id = e.dsa_id
    WHERE f.created_by = ?
      AND f.is_reminder = 1
      AND f.reminder_day BETWEEN DAYOFMONTH(CURDATE()) - 1 AND DAYOFMONTH(CURDATE()) + 2
      AND (
        f.last_reminded IS NULL
        OR DATEDIFF(NOW(), f.last_reminded) > 25
      )`,
    { replacements: [created_by], type: QueryTypes.SELECT }
  );

  return { reminders: rows || [] };
};

/**
 * Marks a favourite reminder as dismissed for the current cycle (sets last_reminded),
 * so checkReminders will not return it again until DATEDIFF > 25.
 */
exports.dismissReminder = async ({ created_by, expense_id, favourite_id }) => {
  const whereSql = favourite_id
    ? SQL_FAV_USER_FAVOURITE_ID
    : SQL_FAV_USER_EXPENSE;
  const whereRepl = favourite_id
    ? [String(favourite_id).trim(), created_by]
    : (() => {
        const { idStr } = normalizeFavouriteExpenseId(expense_id);
        return [created_by, idStr];
      })();

  const fav = await _db2.query(
    `SELECT favourite_id FROM ru_expense_favourites WHERE ${whereSql} LIMIT 1`,
    { replacements: whereRepl, type: QueryTypes.SELECT }
  );
  if (!fav || !fav.length) {
    throw new Error('Bill not in favourites');
  }

  await _db2.query(
    `UPDATE ru_expense_favourites SET last_reminded = NOW(), updated_at = NOW() WHERE ${whereSql}`,
    { replacements: whereRepl, type: QueryTypes.UPDATE }
  );
  return { ok: true };
};

