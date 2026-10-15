'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE role = 'CEO' OR role = 'CRM_ADMIN' LIMIT 1;"
    );

    if (!roles || !roles.length) {
      console.warn('[Seeder] Could not find CEO or CRM_ADMIN role in roles table.');
      return;
    }

    await queryInterface.sequelize.query(`
      INSERT INTO users (
        id, name, email, phone, password, role, status, isDeleted, backend_access, is_superadmin, createdAt, updatedAt
      ) VALUES (
        uuid_to_bin('489e2c22-329e-450e-a1e6-d06346caf5a4'),
        'System Bot',
        'system-bot@ruloans.com',
        '0000000001',
        '$2b$10$dummyhashedpasswordbot',
        ?,
        1,
        0,
        1,
        1,
        NOW(),
        NOW()
      )
      ON DUPLICATE KEY UPDATE 
        name = 'System Bot', 
        email = 'system-bot@ruloans.com', 
        status = 1, 
        isDeleted = 0, 
        backend_access = 1, 
        is_superadmin = 1;
    `, { replacements: [roles[0].id] });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "DELETE FROM users WHERE id = uuid_to_bin('489e2c22-329e-450e-a1e6-d06346caf5a4');"
    );
  }
};
