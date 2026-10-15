'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.js')[env];
const db = {};

let sequelize;
let showLogs = process.env.SHOW_SEQUELIZE_LOGS == "true" ? true : false;

let db2;
let db3;
let db5;
//creating global connection for second database (RULOANS DATABASE) [Neeraj Singh]
if (!process.env.DATABASE_HOST_READ) {
  db2 = new Sequelize(process.env.DATABASE2_NAME, process.env.DATABASE_USER_NAME, process.env.DATABASE_PASSWORD, {
    host: process.env.DATABASE_HOST,
    dialect: process.env.DATABASE_DIALECT,
    logging: showLogs
  });
  db3 = new Sequelize(process.env.DATABASE3_NAME, process.env.DATABASE_USER_NAME, process.env.DATABASE_PASSWORD, {
    host: process.env.DATABASE_HOST,
    dialect: process.env.DATABASE_DIALECT,
    logging: showLogs
  })
} else {
  db2 = new Sequelize(process.env.DATABASE2_NAME, null, null, {
    dialect: process.env.DATABASE_DIALECT,
    port: 3306,
    logging: showLogs,
    replication: {
      read: [
        { host: process.env.DATABASE_HOST_READ, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_1, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_2, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ }
      ],
      write: { host: process.env.DATABASE_HOST, username: process.env.DATABASE_USER_NAME, password: process.env.DATABASE_PASSWORD }
    },
    pool: { // If you want to override the options used for the read/write pool you can do so here
      max: 50,
      idle: 30000
    }
  })
  db3 = new Sequelize(process.env.DATABASE3_NAME, null, null, {
    dialect: process.env.DATABASE_DIALECT,
    port: 3306,
    logging: showLogs,
    replication: {
      read: [
        { host: process.env.DATABASE_HOST_READ, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_1, username: process.env.DATABASE_USER_NAME, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_2, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ }
      ],
      write: { host: process.env.DATABASE_HOST, username: process.env.DATABASE_USER_NAME, password: process.env.DATABASE_PASSWORD }
    },
    pool: { // If you want to override the options used for the read/write pool you can do so here
      max: 50,
      idle: 30000
    },
  })
}

if (!process.env.DATABASE_HOST_READ) {
  if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config, {
      logging: showLogs
    });
  } else {
    sequelize = new Sequelize(config.database, config.username, config.password, {
      dialect: process.env.DATABASE_DIALECT,
      logging: showLogs,
      host: process.env.DATABASE_HOST,
      port: 3306
    });
  }
}
else {
  sequelize = new Sequelize(process.env.DATABASE_NAME, null, null, {
    dialect: process.env.DATABASE_DIALECT,
    logging: showLogs,
    port: 3306,
    replication: {
      read: [
        { host: process.env.DATABASE_HOST_READ, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_1, username: process.env.DATABASE_USER_NAME, password: process.env.DATABASE_PASSWORD_READ },
        { host: process.env.DATABASE_HOST_READ_2, username: process.env.DATABASE_USER_NAME_READ, password: process.env.DATABASE_PASSWORD_READ }
      ],
      write: { host: process.env.DATABASE_HOST, username: process.env.DATABASE_USER_NAME, password: process.env.DATABASE_PASSWORD }
    },
    pool: { // If you want to override the options used for the read/write pool you can do so here
      max: 100,
      idle: 30000
    },
  })
}


db5 = new Sequelize(process.env.DATABASE_NAME, process.env.DATABASE_USER_NAME, process.env.DATABASE_PASSWORD, {
  host: process.env.DATABASE_HOST,
  dialect: process.env.DATABASE_DIALECT,
  logging: showLogs,
  port: 3306,
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db._db2 = db2;
db._db3 = db3;
db._db5 = db5;
global._db2 = db2;
global._db3 = db3;
global._db5 = db5;

module.exports = db;
