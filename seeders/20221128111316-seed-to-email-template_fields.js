'use strict';
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { types } = require('joi');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    let data = [
      {
        id: 1,
        value: 'Organizations',
        type: 'module',
        parent_id: null
      },
      {
        id: 2,
        value: 'Organizations:Organizations Name',
        type: 'module',
        parent_id: 1
      },
      {
        id: 3,
        value: 'Organizations:Organizations Number',
        type: 'module',
        parent_id: 1
      },
      {
        id: 4,
        value: 'Organizations:Primary phone',
        type: 'module',
        parent_id: 1
      },
      {
        id: 5,
        value: 'Organizations:Website',
        type: 'module',
        parent_id: 1
      },
      {
        id: 6,
        value: 'Organizations:Fax',
        type: 'module',
        parent_id: 1
      },
      {
        id: 7,
        value: 'Organizations:Ticker Symbol',
        type: 'module',
        parent_id: 1
      },
      {
        id: 8,
        value: 'Organizations:Secondary Phone',
        type: 'module',
        parent_id: 1
      },
      {
        id: 9,
        value: 'Organizations:Member Of',
        type: 'module',
        parent_id: 1
      },
      {
        id: 10,
        value: 'Organizations:Primary Email',
        type: 'module',
        parent_id: 1
      },
      {
        id: 11,
        value: 'Organizations:Employees',
        type: 'module',
        parent_id: 1
      },
      {
        id: 12,
        value: 'Organizations:Secondary Email',
        type: 'module',
        parent_id: 1
      },
      {
        id: 13,
        value: 'Organizations:Ownership',
        type: 'module',
        parent_id: 1
      },
      {
        id: 14,
        value: 'Organizations:Rating',
        type: 'module',
        parent_id: 1
      },
      {
        id: 15,
        value: 'Organizations:Industry',
        type: 'module',
        parent_id: 1
      },
      {
        id: 16,
        value: 'Organizations:SIC Code',
        type: 'module',
        parent_id: 1
      },
      {
        id: 17,
        value: 'Organizations:Type',
        type: 'module',
        parent_id: 1
      },
      {
        id: 18,
        value: 'Organizations:Annual Revenue',
        type: 'module',
        parent_id: 1
      },
      {
        id: 19,
        value: 'Organizations:Email Opt Out',
        type: 'module',
        parent_id: 1
      },
      {
        id: 20,
        value: 'Organizations:Notify Owner',
        type: 'module',
        parent_id: 1
      },
      {
        id: 21,
        value: 'Organizations:Assigned To',
        type: 'module',
        parent_id: 1
      },
      {
        id: 22,
        value: 'Organizations:Created Time',
        type: 'module',
        parent_id: 1
      },
      {
        id: 23,
        value: 'Organizations:Modified Time',
        type: 'module',
        parent_id: 1
      },
      {
        id: 24,
        value: 'Organizations:Last Modified By',
        type: 'module',
        parent_id: 1
      },
      {
        id: 25,
        value: 'Organizations:Billing Address',
        type: 'module',
        parent_id: 1
      },
      {
        id: 26,
        value: 'Organizations:Shipping Address',
        type: 'module',
        parent_id: 1
      },
      {
        id: 27,
        value: 'Organizations:Biling City',
        type: 'module',
        parent_id: 1
      },
      {
        id: 28,
        value: 'Organizations:Shipping City',
        type: 'module',
        parent_id: 1
      },
      {
        id: 29,
        value: 'Organizations:Biling State',
        type: 'module',
        parent_id: 1
      },
      {
        id: 30,
        value: 'Organizations:Shipping State',
        type: 'module',
        parent_id: 1
      },
      {
        id: 31,
        value: 'Organizations:Billing Postal Code',
        type: 'module',
        parent_id: 1
      },
      {
        id: 32,
        value: 'Organizations:Shipping Postal Code',
        type: 'module',
        parent_id: 1
      },
      {
        id: 33,
        value: 'Organizations:Billing Country',
        type: 'module',
        parent_id: 1
      },
      {
        id: 34,
        value: 'Organizations:Shipping Country',
        type: 'module',
        parent_id: 1
      },
      {
        id: 35,
        value: 'Organizations:Billing Po Box',
        type: 'module',
        parent_id: 1
      },
      {
        id: 36,
        value: 'Organizations:Shipping Po Box',
        type: 'module',
        parent_id: 1
      },
      {
        id: 37,
        value: 'Organizations:Description',
        type: 'module',
        parent_id: 1
      },
      {
        id: 38,
        value: 'Organizations:Ls Converted From Lead',
        type: 'module',
        parent_id: 1
      },
      {
        id: 39,
        value: 'Organizations:Source',
        type: 'module',
        parent_id: 1
      },
      {
        id: 40,
        value: 'Organizations:Starred',
        type: 'module',
        parent_id: 1
      },
      {
        id: 41,
        value: 'Organizations:Tags',
        type: 'module',
        parent_id: 1
      },
      {
        id: 42,
        value: 'Organizations:Record Id',
        type: 'module',
        parent_id: 1
      },
      {
        id: 43,
        value: 'Assigned To:(Users)User Name',
        type: 'module',
        parent_id: 1
      },
      {
        id: 44,
        value: 'Assigned To:(Users)First Name',
        type: 'module',
        parent_id: 1
      },
      {
        id: 45,
        value: 'Assigned To:(Users)Last Name',
        type: 'module',
        parent_id: 1
      },
      {
        id: 46,
        value: 'Assigned To:(Users)Primary Name',
        type: 'module',
        parent_id: 1
      },
      {
        id: 47,
        value: 'Assigned To:(Users)Account Owner',
        type: 'module',
        parent_id: 1
      },
      {
        id: 48,
        value: 'Assigned To:(Users)Title',
        type: 'module',
        parent_id: 1
      },
      {
        id: 49,
        value: 'Assigned To:(Users)Office Phone',
        type: 'module',
        parent_id: 1
      },
      {
        id: 50,
        value: 'Assigned To:(Users)Department',
        type: 'module',
        parent_id: 1
      },
      {
        id: 51,
        value: 'Assigned To:(Users)Mobile Phone',
        type: 'module',
        parent_id: 1
      },
      {
        id: 52,
        value: 'Assigned To:(Users)Secondary Email',
        type: 'module',
        parent_id: 1
      },
      {
        id: 53,
        value: 'Assigned To:(Users)Home Phone',
        type: 'module',
        parent_id: 1
      },
      {
        id: 54,
        value: 'Assigned To:(Users)City',
        type: 'module',
        parent_id: 1
      },
      {
        id: 55,
        value: 'Assigned To:(Users)State',
        type: 'module',
        parent_id: 1
      },
      {
        id: 56,
        value: 'Assigned To:(Users)Postal Code',
        type: 'module',
        parent_id: 1
      },
      {
        id: 57,
        value: 'Assigned To:(Users)Country',
        type: 'module',
        parent_id: 1
      },
      {
        id: 58,
        value: 'Assigned To:(Users)CRM Phone Extension',
        type: 'module',
        parent_id: 1
      },
      {
        id: 59,
        value: 'Last Modified By:(Users)User Name',
        type: 'module',
        parent_id: 1
      },
      {
        id: 60,
        value: 'Last Modified By:(Users)First Name',
        type: 'module',
        parent_id: 1
      },
      {
        id: 61,
        value: 'Last Modified By:(Users)Last Name',
        type: 'module',
        parent_id: 1
      },
      {
        id: 62,
        value: 'Last Modified By:(Users)Primary Email',
        type: 'module',
        parent_id: 1
      },
      {
        id: 63,
        value: 'Last Modified By:(Users)Account Owner',
        type: 'module',
        parent_id: 1
      },
      {
        id: 64,
        value: 'Last Modified By:(Users)Title',
        type: 'module',
        parent_id: 1
      },
      {
        id: 65,
        value: 'Last Modified By:(Users)Office Phone',
        type: 'module',
        parent_id: 1
      },
      {
        id: 66,
        value: 'Last Modified By:(Users)Department',
        type: 'module',
        parent_id: 1
      },
      {
        id: 67,
        value: 'Last Modified By:(Users)Mobile Phone',
        type: 'module',
        parent_id: 1
      },
      {
        id: 68,
        value: 'Last Modified By:(Users)Secondary Phone',
        type: 'module',
        parent_id: 1
      },
      {
        id: 69,
        value: 'Last Modified By:(Users)Other Email',
        type: 'module',
        parent_id: 1
      },
      {
        id: 70,
        value: 'Assigned To:(Users)Fax',
        type: 'module',
        parent_id: 1
      },
      {
        id: 71,
        value: 'Last Modified By:(Users)Secondary Email',
        type: 'module',
        parent_id: 1
      },
      {
        id: 72,
        value: 'Last Modified By:(Users)Home Phone',
        type: 'module',
        parent_id: 1
      },
      {
        id: 73,
        value: 'Last Modified By:(Users)City',
        type: 'module',
        parent_id: 1
      },
      {
        id: 74,
        value: 'Last Modified By:(Users)State',
        type: 'module',
        parent_id: 1
      },
      {
        id: 75,
        value: 'Last Modified By:(Users)Postal Code',
        type: 'module',
        parent_id: 1
      },
      {
        id: 76,
        value: 'Last Modified By:(Users)Country',
        type: 'module',
        parent_id: 1
      },
      {
        id: 77,
        value: 'Last Modified By:(Users)CRM Phone Extension',
        type: 'module',
        parent_id: 1
      },
      {
        id: 78,
        value: 'Leads',
        type: 'module',
        parent_id: null
      },
      {
        id: 79,
        value: 'Salutation',
        type: 'module',
        parent_id: 68
      },
      {
        id: 80,
        value: 'First Name',
        type: 'module',
        parent_id: 68
      },
      {
        id: 81,
        value: 'Last Name',
        type: 'module',
        parent_id: 68
      },
      {
        id: 82,
        value: 'Primary Email',
        type: 'module',
        parent_id: 68
      },
      {
        id: 83,
        value: 'Lead Source',
        type: 'module',
        parent_id: 68
      },
      {
        id: 84,
        value: 'Lead Status',
        type: 'module',
        parent_id: 68
      },
      {
        id: 85,
        value: 'Assigned To',
        type: 'module',
        parent_id: 68
      },
      {
        id: 86,
        value: 'Secoundary Email',
        type: 'module',
        parent_id: 68
      },
      {
        id: 87,
        value: 'Created Time',
        type: 'module',
        parent_id: 68
      },
      {
        id: 88,
        value: 'Modified Time',
        type: 'module',
        parent_id: 68
      },
      {
        id: 89,
        value: 'Last Modified By',
        type: 'module',
        parent_id: 68
      },
      {
        id: 90,
        value: 'Postal Code',
        type: 'module',
        parent_id: 68
      },
      {
        id: 91,
        value: 'Town',
        type: 'module',
        parent_id: 68
      },
      {
        id: 92,
        value: 'Description',
        type: 'module',
        parent_id: 68
      },
      {
        id: 93,
        value: 'Email Opt Out',
        type: 'module',
        parent_id: 68
      },
      {
        id: 94,
        value: 'Source',
        type: 'module',
        parent_id: 68
      },
      {
        id: 95,
        value: 'Starred',
        type: 'module',
        parent_id: 68
      },
      {
        id: 96,
        value: 'Tags',
        type: 'module',
        parent_id: 68
      },
      {
        id: 97,
        value: 'Middle Name',
        type: 'module',
        parent_id: 68
      },
      {
        id: 98,
        value: 'Address 1',
        type: 'module',
        parent_id: 68
      },
      {
        id: 99,
        value: 'Address 2',
        type: 'module',
        parent_id: 68
      },
      {
        id: 100,
        value: 'Address 3',
        type: 'module',
        parent_id: 68
      },
      {
        id: 101,
        value: 'Profession',
        type: 'module',
        parent_id: 68
      },
      {
        id: 102,
        value: 'Have You Heard Of Ruloans Before?',
        type: 'module',
        parent_id: 68
      },
      {
        id: 103,
        value: 'Where Or How',
        type: 'module',
        parent_id: 68
      },
      {
        id: 104,
        value: 'Capture The Name And Location',
        type: 'module',
        parent_id: 68
      },
      {
        id: 105,
        value: 'Have You Ever Done Loan Business?',
        type: 'module',
        parent_id: 68
      },
      {
        id: 106,
        value: 'Do You Refer Files To',
        type: 'module',
        parent_id: 68
      },
      {
        id: 107,
        value: 'DO You Do End-To-End Files?',
        type: 'module',
        parent_id: 68
      },
      {
        id: 108,
        value: 'How Many Years Of Experience In Loan Business ?',
        type: 'module',
        parent_id: 68
      },
      {
        id: 109,
        value: 'Do You Have Office ?',
        type: 'module',
        parent_id: 68
      },
      {
        id: 110,
        value: 'Is It Rented Or Owned ?',
        type: 'module',
        parent_id: 68
      },
      {

        id: 111,
        value: 'Number Of Staff',
        type: 'module',
        parent_id: 68
      },
      {
        id: 112,
        value: 'Car Loan Sub Product',
        type: 'module',
        parent_id: 68
      },
      {
        id: 113,
        value: 'Company Details:Company Name',
        type: 'general',
        parent_id: null
      },
      {
        id: 114,
        value: 'Company Details:Company Logo',
        type: 'general',
        parent_id: null
      },
      {
        id: 115,
        value: 'Company Details:Logo',
        type: 'general',
        parent_id: null
      },
      {
        id: 116,
        value: 'Company Details:Address',
        type: 'general',
        parent_id: null
      },
      {
        id: 117,
        value: 'Company Details:City',
        type: 'general',
        parent_id: null
      },
      {
        id: 118,
        value: 'Company Details:State',
        type: 'general',
        parent_id: null
      },
      {
        id: 119,
        value: 'Portal Url',
        type: 'general',
        parent_id: null
      },
      {
        id: 120,
        value: 'Site Url',
        type: 'general',
        parent_id: null
      },
      {
        id: 121,
        value: 'Portal Detail View Url',
        type: 'general',
        parent_id: null
      },
    ]
    for (let i = 0; i < data.length; i++) {
      let query = ` insert into email_template_fields(id,name,type,parent_id) values (?,?,?,?)`;
      let bindParams = [data[i].id, data[i].value, data[i].type, data[i].parent_id];
      await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.bulkDelete('email_template_fields', null, {});

  }
};
