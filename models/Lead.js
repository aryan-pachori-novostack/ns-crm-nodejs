'use strict';
let uuid = require('node-uuid');
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Lead extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Lead.init({
    id: {
      type: DataTypes.UUID,
      autoIncrement: true,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      get: function () {
        if (this.getDataValue('id')) {
          return uuid.unparse(this.getDataValue('id'));
        }
      },
      set: function () {
        if (this.getDataValue('id')) {
          return uuid.parse(this.getDataValue('id'), new Buffer(16))
        }
      }
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    mobile: {
      type: DataTypes.STRING,
      allowNull: false
    },
    prefix: {
      type: DataTypes.STRING,
    },
    user_fname: {
      type: DataTypes.STRING,
    },
    user_mname: {
      type: DataTypes.STRING
    },
    user_lname: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
    },
    source: {
      type: DataTypes.STRING
    },
    lead_source: {
      type: DataTypes.INTEGER
    },
    status: {
      type: DataTypes.INTEGER
    },
    assigned_to: {
      type: DataTypes.UUID,
      set: function () {
        if (this.getDataValue('assigned_to')) {
          return uuassigned_to.parse(this.getDataValue('assigned_to'), new Buffer(16))
        }
      }
    },
    pan: {
      type: DataTypes.STRING,
      allowNull: false
    },
    is_fresh_lead: {
      type: DataTypes.BOOLEAN
    },
    profession: {
      type: DataTypes.INTEGER
    },
    category: {
      type: DataTypes.INTEGER
    },
    alt_mobile: {
      type: DataTypes.STRING
    },
    channel_manager: {
      type: DataTypes.UUID,
      set: function () {
        if (this.getDataValue('channel_manager')) {
          return uuid.parse(this.getDataValue('channel_manager'), new Buffer(16))
        }
      }
    },
    potential: {
      type: DataTypes.INTEGER
    },
    dob: {
      type: DataTypes.DATE
    },
    lead_type: {
      type: DataTypes.INTEGER
    },
    step: {
      type: DataTypes.INTEGER
    },
    payout_percentage: {
      type: DataTypes.FLOAT,
    },
    createdAt: {
      type: DataTypes.DATE
    },
    updatedAt: {
      type: DataTypes.DATE
    }
  }, {
    sequelize,
    tableName: 'leads',
    modelName: 'Lead',
  });
  return Lead;
};