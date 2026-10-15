'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS api_approvals (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        action_key        VARCHAR(100)  NOT NULL COMMENT 'Identifier for which action this approval is for, e.g. reassignPartner',
        action_label      VARCHAR(255)  DEFAULT NULL COMMENT 'Human-readable label',
        method            VARCHAR(10)   NOT NULL DEFAULT 'POST',
        endpoint          VARCHAR(500)  NOT NULL COMMENT 'Original API endpoint',
        payload           LONGTEXT      DEFAULT NULL COMMENT 'JSON stringified request body',
        requested_by      CHAR(36)      NOT NULL COMMENT 'UUID of the user who triggered the request',
        approver_id       CHAR(36)      DEFAULT NULL COMMENT 'UUID of the assigned approver',
        status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        remarks           TEXT          DEFAULT NULL COMMENT 'Approver remarks on approve/reject',
        status_updated_at DATETIME      DEFAULT NULL,
        created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_requested_by (requested_by),
        INDEX idx_approver_id (approver_id),
        INDEX idx_status (status),
        INDEX idx_action_key (action_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS api_approvals;`);
  }
};
