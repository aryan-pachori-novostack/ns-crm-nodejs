'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class RbacRule extends Model {
        static associate(models) {
            // Define association with Role
            RbacRule.belongsTo(models.Role, {
                foreignKey: 'role_id',
                targetKey: 'id',
                as: 'role'
            });
        }
    }

    RbacRule.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        role_id: {
            type: DataTypes.BLOB, // To store BINARY(16) UUIDs correctly
            allowNull: false
        },
        resource_type: {
            type: DataTypes.ENUM('api', 'column', 'button', 'page'),
            allowNull: false
        },
        resource_key: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Module or screen alias (e.g., leads, payroll)'
        },
        resource_list: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'Specific element name(s) (e.g., salary_amount, approve_btn)'
        },
        visible: {
            type: DataTypes.TINYINT(1),
            defaultValue: 1,
            allowNull: false
        }
    }, {
        sequelize,
        tableName: 'rbac_rules',
        modelName: 'RbacRule',
        timestamps: true,
        underscored: true
    });

    return RbacRule;
};
