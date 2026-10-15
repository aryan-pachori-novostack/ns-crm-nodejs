'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Check if the legacy migration already occurred (if entity_type_id exists)
      const [columns] = await queryInterface.sequelize.query("SHOW COLUMNS FROM ru_leads_logs");
      const existingColumns = columns.map(c => c.Field);

      if (existingColumns.includes('entity_type_id')) {
        // Table already migrated
        await transaction.commit();
        return;
      }

      // Drop new target table if it got orphaned on a previously failed run
      const [tables] = await queryInterface.sequelize.query("SHOW TABLES LIKE 'ru_leads_logs_new'");
      if (tables.length > 0) {
        await queryInterface.sequelize.query("DROP TABLE ru_leads_logs_new", { transaction });
      }

      // 2. Create the clean new vertical table structure
      const createTableQuery = `
        CREATE TABLE ru_leads_logs_new (
          id INT AUTO_INCREMENT PRIMARY KEY,
          entity VARCHAR(255) NOT NULL,
          entity_type VARCHAR(255) NULL,
          entity_id VARCHAR(255) NULL,
          entity_type_id VARCHAR(255) NULL,
          event_type VARCHAR(255) NULL,
          changed_from TEXT NULL,
          changed_to TEXT NULL,
          created_by VARCHAR(255) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_leads_logs_composite (entity, entity_type, entity_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await queryInterface.sequelize.query(createTableQuery, { transaction });

      // 3. Extract and physically split legacy STATUS changes into strict vertical rows
      const insertStatusQuery = `
        INSERT INTO ru_leads_logs_new (entity, entity_type, entity_type_id, event_type, changed_from, changed_to, created_by, created_at, updated_at)
        SELECT 'dsa', 'leads', lead_id, 'status', status_from, status_to, created_by, created_at, CURRENT_TIMESTAMP
        FROM ru_leads_logs
        WHERE (status_from IS NOT NULL AND status_from != '') OR (status_to IS NOT NULL AND status_to != '')
        OR (event_type = 'status');
      `;
      await queryInterface.sequelize.query(insertStatusQuery, { transaction });

      // 4. Extract and physically split legacy REMARK changes
      const insertRemarkQuery = `
        INSERT INTO ru_leads_logs_new (entity, entity_type, entity_type_id, event_type, changed_from, changed_to, created_by, created_at, updated_at)
        SELECT 'dsa', 'leads', lead_id, 'remark', remark_from, remark_to, created_by, created_at, CURRENT_TIMESTAMP
        FROM ru_leads_logs
        WHERE (remark_from IS NOT NULL AND remark_from != '') OR (remark_to IS NOT NULL AND remark_to != '')
        OR (event_type = 'remark');
      `;
      await queryInterface.sequelize.query(insertRemarkQuery, { transaction });

      // 5. Extract and physically split legacy BUCKET changes
      const insertBucketQuery = `
        INSERT INTO ru_leads_logs_new (entity, entity_type, entity_type_id, event_type, changed_from, changed_to, created_by, created_at, updated_at)
        SELECT 'dsa', 'leads', lead_id, 'bucket', bucket_from, bucket_to, created_by, created_at, CURRENT_TIMESTAMP
        FROM ru_leads_logs
        WHERE (bucket_from IS NOT NULL AND bucket_from != '') OR (bucket_to IS NOT NULL AND bucket_to != '')
        OR (event_type = 'bucket');
      `;
      await queryInterface.sequelize.query(insertBucketQuery, { transaction });

      // 6. Carry over any generic external manually tracked events existing (optional edge case safety)
      const insertOtherEventsQuery = `
        INSERT INTO ru_leads_logs_new (entity, entity_type, entity_type_id, event_type, changed_from, changed_to, created_by, created_at, updated_at)
        SELECT 'dsa', 'leads', lead_id, event_type, NULL, NULL, created_by, created_at, CURRENT_TIMESTAMP
        FROM ru_leads_logs
        WHERE event_type NOT IN ('status', 'remark', 'bucket') AND event_type IS NOT NULL AND event_type != '';
      `;
      await queryInterface.sequelize.query(insertOtherEventsQuery, { transaction });

      // 7. Swap the tables seamlessly
      await queryInterface.sequelize.query("RENAME TABLE ru_leads_logs TO ru_leads_logs_legacy, ru_leads_logs_new TO ru_leads_logs", { transaction });

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Allows reverting simply by swapping back names if legacy exists
    const [tables] = await queryInterface.sequelize.query("SHOW TABLES LIKE 'ru_leads_logs_legacy'");
    if (tables.length > 0) {
      await queryInterface.sequelize.query("RENAME TABLE ru_leads_logs TO ru_leads_logs_new, ru_leads_logs_legacy TO ru_leads_logs");
      await queryInterface.sequelize.query("DROP TABLE ru_leads_logs_new");
    }
  }
};
