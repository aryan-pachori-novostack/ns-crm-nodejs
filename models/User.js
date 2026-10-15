'use strict';
let uuid = require('node-uuid');
const {
  Model,
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      User.belongsTo(models.Role,{ 
        foreignKey: 'role', 
        as: 'userRole' 
      });
      User.hasOne(models.User,{
        as: 'userParent',
        foreignKey: 'parent',
      });
      User.hasOne(models.User,{
        as: 'userCreatedBy',
        foreignKey: 'createdBy',
      });
    }
  }
  User.init({
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
      type: DataTypes.UUID,
      allowNull:false,
      get: function() {
        if (this.getDataValue('role')) {
          return uuid.unparse(this.getDataValue('role'));
        }
      },
    },
    createdBy: {
      type: DataTypes.UUID,
      get: function() {
        if (this.getDataValue('createdBy')) {
          return uuid.unparse(this.getDataValue('createdBy'));
        }
      },
    },
    parent: {
      type: DataTypes.UUID,
      get: function() {
        if (this.getDataValue('parent')) {
          return uuid.unparse(this.getDataValue('parent'));
        }
      },
    },
    email: {
        type:DataTypes.STRING,
        unique: true,
        allowNull:false
    }, 
    password: {
      type:DataTypes.STRING,
      unique: true,
      allowNull:false
    },
    phone: {
      type:DataTypes.STRING,
    },
    name: {
      type:DataTypes.STRING,
    },
    dummyPassword: {
      type:DataTypes.BOOLEAN,
      defaultValue:true
    },
    isDeleted: {
      type:DataTypes.BOOLEAN,
      defaultValue:false
    },
    otp: {
      type:DataTypes.INTEGER
    },
    otpCreatedAt: {
      type:DataTypes.DATE,
      defaultValue:null
    },
    validatedAt: {
      type:DataTypes.DATE
    },
  }, {
    sequelize,
    tableName:'users',
    modelName: 'User',
  });
  return User;
};