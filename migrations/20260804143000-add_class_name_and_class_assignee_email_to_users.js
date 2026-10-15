'use strict';
const xlsx = require('xlsx');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Describe ru_direct_selling_agents table in RULoans database (_db2)
    const [tableCols] = await queryInterface.sequelize.query('DESCRIBE ru_direct_selling_agents');
    const existingCols = tableCols.map(c => c.Field);

    if (!existingCols.includes('class_assignee_name')) {
      await queryInterface.sequelize.query(
        'ALTER TABLE ru_direct_selling_agents ADD COLUMN class_assignee_name VARCHAR(255) NULL DEFAULT NULL'
      );
    }

    if (!existingCols.includes('class_assignee_email')) {
      await queryInterface.sequelize.query(
        'ALTER TABLE ru_direct_selling_agents ADD COLUMN class_assignee_email VARCHAR(255) NULL DEFAULT NULL'
      );
    }

    // 2. Populate data from Excel file using bulk PAN lookup on ru_dsa_kyc_data (with fallback to Email on ru_direct_selling_agents)
    const excelPath = '/Users/NS-MAC-034/Downloads/Classes713_Master.xlsx';
    try {
      const workbook = xlsx.readFile(excelPath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);

      console.log(`Processing ${rows.length} rows for ru_direct_selling_agents using PAN lookup on ru_dsa_kyc_data...`);

      // Pre-fetch PAN -> dsa_id mapping
      const uniquePans = [...new Set(rows.map(r => r.PAN ? String(r.PAN).trim().toLowerCase() : '').filter(Boolean))];
      const panToDsaMap = new Map();
      const chunkSize = 200;
      for (let i = 0; i < uniquePans.length; i += chunkSize) {
        const chunk = uniquePans.slice(i, i + chunkSize);
        const kycRecords = await queryInterface.sequelize.query(
          `SELECT dsa_id, LOWER(permanent_account_number) as pan FROM ru_dsa_kyc_data WHERE LOWER(permanent_account_number) IN (?) AND dsa_id IS NOT NULL AND dsa_id != ''`,
          { replacements: [chunk], type: Sequelize.QueryTypes.SELECT }
        );
        for (const k of kycRecords) {
          if (k.pan) panToDsaMap.set(k.pan.trim(), k.dsa_id);
        }
      }

      // Pre-fetch Email -> dsa_id mapping
      const uniqueEmails = [...new Set(rows.map(r => r.Email ? String(r.Email).trim().toLowerCase() : '').filter(Boolean))];
      const emailToDsaMap = new Map();
      for (let i = 0; i < uniqueEmails.length; i += chunkSize) {
        const chunk = uniqueEmails.slice(i, i + chunkSize);
        const dsaRecords = await queryInterface.sequelize.query(
          `SELECT dsa_id, LOWER(email_address) as email FROM ru_direct_selling_agents WHERE LOWER(email_address) IN (?) AND dsa_id IS NOT NULL AND dsa_id != ''`,
          { replacements: [chunk], type: Sequelize.QueryTypes.SELECT }
        );
        for (const d of dsaRecords) {
          if (d.email) emailToDsaMap.set(d.email.trim(), d.dsa_id);
        }
      }

      let panUpdatedCount = 0;
      let emailUpdatedCount = 0;

      for (const r of rows) {
        const assigneeName = r['Assignee'] ? String(r['Assignee']).trim() : null;
        const assigneeEmail = r['Assignee Email ID'] ? String(r['Assignee Email ID']).trim() : null;
        if (!assigneeName && !assigneeEmail) continue;

        let dsaId = null;
        const pan = r.PAN ? String(r.PAN).trim().toLowerCase() : '';
        const email = r.Email ? String(r.Email).trim().toLowerCase() : '';

        // A. Match by PAN in ru_dsa_kyc_data
        if (pan && panToDsaMap.has(pan)) {
          dsaId = panToDsaMap.get(pan);
          panUpdatedCount++;
        }
        // B. Fallback to Email in ru_direct_selling_agents
        else if (email && emailToDsaMap.has(email)) {
          dsaId = emailToDsaMap.get(email);
          emailUpdatedCount++;
        }

        if (dsaId) {
          await queryInterface.sequelize.query(
            `UPDATE ru_direct_selling_agents SET class_assignee_name = ?, class_assignee_email = ? WHERE dsa_id = ?`,
            {
              replacements: [assigneeName, assigneeEmail, dsaId],
              type: Sequelize.QueryTypes.UPDATE,
            }
          );
        }
      }

      console.log(`ru_direct_selling_agents update completed! PAN Matches: ${panUpdatedCount}, Email Matches: ${emailUpdatedCount}`);
    } catch (err) {
      console.error('Error populating class assignee data from Excel:', err.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const [tableCols] = await queryInterface.sequelize.query('DESCRIBE ru_direct_selling_agents');
    const existingCols = tableCols.map(c => c.Field);

    if (existingCols.includes('class_assignee_name')) {
      await queryInterface.sequelize.query('ALTER TABLE ru_direct_selling_agents DROP COLUMN class_assignee_name');
    }

    if (existingCols.includes('class_assignee_email')) {
      await queryInterface.sequelize.query('ALTER TABLE ru_direct_selling_agents DROP COLUMN class_assignee_email');
    }
  },
};
