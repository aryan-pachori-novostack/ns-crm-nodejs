'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Module extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Module.hasMany(models.PicklistKey, {
        foreignKey: 'module_id',
        onDelete: 'CASCADE'
      })
    }
  }
  Module.init({
    value: DataTypes.STRING
  }, {
    sequelize,
    tableName:"modules",
    modelName: 'Module',
  });
  return Module;
};