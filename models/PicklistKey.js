'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PicklistKey extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PicklistKey.belongsTo(models.Module, {
        foreignKey: 'module_id',
        onDelete: 'CASCADE'
      });

      PicklistKey.hasMany(models.PicklistValue, {
        foreignKey: 'key_id',
        onDelete: 'CASCADE'
      });

      PicklistKey.belongsTo(models.PicklistKey, {
        foreignKey: 'id',
        onDelete: 'CASCADE',
        as: 'parent'
      }),

      PicklistKey.hasMany(models.PicklistKey, {
        as: "children",
        foreignKey: 'parent_id',
        onDelete: 'CASCADE'
      })
    }
  }
  PicklistKey.init({
    value: DataTypes.STRING,
    module_id: DataTypes.INTEGER,
    parent_id: DataTypes.INTEGER,
  }, {
    sequelize,
    tableName:'picklist_keys',
    modelName: 'PicklistKey',
  });
  return PicklistKey;
};