'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('call_logs', 'call_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await queryInterface.addColumn('call_logs', 'disposition', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('call_logs', 'caller_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('call_logs', 'call_id');
    await queryInterface.removeColumn('call_logs', 'disposition');
    await queryInterface.removeColumn('call_logs', 'caller_id');
  }
};
