'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PicklistValue extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PicklistValue.belongsTo(models.PicklistKey, {
        foreignKey: 'key_id',
        onDelete: 'CASCADE'
      }),

      PicklistValue.hasMany(models.PicklistValue, {
        as: "children",
        foreignKey: 'parent_id',
        onDelete: 'CASCADE'
      })
    }
  }
  PicklistValue.init({
    value: DataTypes.STRING,
    key_id: DataTypes.INTEGER,
    parent_id: DataTypes.INTEGER,
    alias: DataTypes.STRING,
  }, {
    sequelize,
    tableName:"picklist_values",
    modelName: 'PicklistValue',
  });
  return PicklistValue;
};