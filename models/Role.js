'use strict';
let uuid = require('node-uuid');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Role.init({
    id: {
      type: DataTypes.UUID,
      autoIncrement: true,
      defaultValue:DataTypes.UUIDV4,
      primaryKey: true,
      get: function() {
        if (this.getDataValue('id')) {
          return uuid.unparse(this.getDataValue('id'));
        }
      },
      set: function() {
        if (this.getDataValue('id')) {
          return uuid.parse(this.getDataValue('id'), new Buffer(16))
        }
      }
    },
    bufferId: {
      type: DataTypes.VIRTUAL,
      get: function() {
        if (this.getDataValue('id')) {
          return this.getDataValue('id')
        }
      }
    },
    role: {
        type:DataTypes.STRING,
        unique: true
    }
  }, {
    sequelize,
    tableName:'roles',
    modelName: 'Role',
  });
  return Role;
};