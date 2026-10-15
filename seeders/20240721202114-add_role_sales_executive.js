'use strict';
const uuid = require('uuid');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up() {
    const data = [
      {
        id: uuid.v4(),
        role: 'SALES_EXECUTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const item of data) {
      const query = `INSERT INTO roles (id, role, createdAt, updatedAt) VALUES (UUID_TO_BIN(?), ?, ?, ?)`;
      const bindParams = [item.id, item.role, item.createdAt, item.updatedAt];
      await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
  },

  async down() {
    const query = `DELETE FROM roles WHERE role = ?`;
    const bindParams = ['SALES_EXECUTIVE'];
    await sequelize.query(query, { replacements: bindParams, type: QueryTypes.DELETE });
  }
};
