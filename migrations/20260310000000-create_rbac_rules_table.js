'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('rbac_rules', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            role_id: {
                type: 'VARBINARY(16)', // Binary UUID
                allowNull: false
            },
            resource_type: {
                type: Sequelize.STRING(50), // column, button, api, page
                allowNull: false
            },
            resource_key: {
                type: Sequelize.STRING(100), // module alias (e.g. leads)
                allowNull: false
            },
            resource_list: {
                type: Sequelize.TEXT, // identifier (e.g. mobile_column)
                allowNull: false
            },
            visible: {
                type: Sequelize.TINYINT(1),
                defaultValue: 1
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Add index for faster lookups
        await queryInterface.addIndex('rbac_rules', ['role_id', 'resource_type', 'resource_key']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('rbac_rules');
    }
};
