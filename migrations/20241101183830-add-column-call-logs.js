'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('call_logs', 'lead_set_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'lead_set_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'process_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'process_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'mode_of_calling', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'call_start_datetime', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'call_end_datetime', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'disconnected_by', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'record_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'agent_talk_time_sec', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'call_transfer_flag', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'number_of_hold', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'dispose_time', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'customer_phone_answered', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'customer_hangup_cause', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'agent_hangup_cause', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'customer_pstn_hangup_cause', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'agent_pstn_hangup_cause', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('call_logs', 'json_response', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('call_logs', 'lead_set_id');
    await queryInterface.removeColumn('call_logs', 'lead_set_name');
    await queryInterface.removeColumn('call_logs', 'process_id');
    await queryInterface.removeColumn('call_logs', 'process_name');
    await queryInterface.removeColumn('call_logs', 'mode_of_calling');
    await queryInterface.removeColumn('call_logs', 'call_start_datetime');
    await queryInterface.removeColumn('call_logs', 'call_end_datetime');
    await queryInterface.removeColumn('call_logs', 'disconnected_by');
    await queryInterface.removeColumn('call_logs', 'record_url');
    await queryInterface.removeColumn('call_logs', 'agent_talk_time_sec');
    await queryInterface.removeColumn('call_logs', 'call_transfer_flag');
    await queryInterface.removeColumn('call_logs', 'number_of_hold');
    await queryInterface.removeColumn('call_logs', 'dispose_time');
    await queryInterface.removeColumn('call_logs', 'customer_phone_answered');
    await queryInterface.removeColumn('call_logs', 'customer_hangup_cause');
    await queryInterface.removeColumn('call_logs', 'agent_hangup_cause');
    await queryInterface.removeColumn('call_logs', 'customer_pstn_hangup_cause');
    await queryInterface.removeColumn('call_logs', 'agent_pstn_hangup_cause');
    await queryInterface.removeColumn('call_logs', 'json_response');
  },
};
