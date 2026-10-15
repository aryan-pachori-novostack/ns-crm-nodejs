'use strict';
const {sequelize} = require('../models');
const { QueryTypes } = require('sequelize');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    let data = [
      {
       id:1,
       value: 'Agreement',
       step_number:null,
       parent_id:null
      },
      {
        id:2,
        value: 'Agreement Done',
        step_number:null,
        parent_id:1
      },
      {
        id:3,
        value: 'Already a Partner',
        step_number:null,
        parent_id:null
      },
      {
        id:4,
        value: 'Buisness Started',
        step_number:null,
        parent_id:1
      },
      {
        id:5,
        value: 'File Logged In',
        step_number:null,
        parent_id:4
      },
      {
        id:6,
        value: 'Cold',
        step_number:null,
        parent_id:6
      },
      {
        id:7,
        value: 'In Process',
        step_number:null,
        parent_id:null
      },
      {
        id:8,
        value: 'Manager Approvel',
        step_number:null,
        parent_id:7
      },
      {
        id:9,
        value: 'Meeting Pending',
        step_number:null,
        parent_id:7
      },
      {
        id:10,
        value: 'Verification Pending',
        step_number:null,
        parent_id:7
      },
      {
        id:11,
        value: 'Agreement Shared',
        step_number:null,
        parent_id:7
      },
      {
        id:12,
        value: 'Will visit the Office',
        step_number:null,
        parent_id:7
      },
      {
        id:13,
        value: 'Potential',
        step_number:null,
        parent_id:7
      },
      {
        id:14,
        value: 'Not Eligible',
        step_number:null,
        parent_id:null
      },
      {
        id:15,
        value: 'Fresher',
        step_number:null,
        parent_id:14
      },
      {
        id:16,
        value: 'No Knowledge',
        step_number:null,
        parent_id:14
      },
      {
        id:17,
        value: 'Not in loan Buisness',
        step_number:null,
        parent_id:14
      },
      {
        id:18,
        value: 'Required Loan',
        step_number:null,
        parent_id:14
      },
      {
        id:19,
        value: 'Negative Verification',
        step_number:null,
        parent_id:14
      },
      {
        id:20,
        value: 'Expect High Payout',
        step_number:null,
        parent_id:14
      },
      {
        id:21,
        value: 'Charge Customer',
        step_number:null,
        parent_id:14
      },
      {
        id:22,
        value: 'Not Inteseted',
        step_number:null,
        parent_id:null
      },
      {
        id:23,
        value: 'Did Not Apply',
        step_number:null,
        parent_id:22
      },
      {
        id:24,
        value: 'Not Inteseted',
        step_number:null,
        parent_id:22
      },
      {
        id:25,
        value: 'Only Inquiry',
        step_number:null,
        parent_id:22
      },
      {
        id:26,
        value: 'Working With Competiter',
        step_number:null,
        parent_id:22
      },
      {
        id:27,
        value: 'Denied To Share Details',
        step_number:null,
        parent_id:22
      },
      {
        id:28,
        value: 'Call Disconnected',
        step_number:null,
        parent_id:22
      },
      {
        id:29,
        value: 'Drop Plan',
        step_number:null,
        parent_id:22
      },
      {
        id:30,
        value: 'Wrong Number',
        step_number:null,
        parent_id:22
      },
      {
        id:31,
        value: 'Payout or Service Issue',
        step_number:null,
        parent_id:22
      },
      {
        id:32,
        value: 'Other',
        step_number:null,
        parent_id:null
      },
      {
        id:33,
        value: 'Payout Shared',
        step_number:null,
        parent_id:33
      },
      {
        id:34,
        value: 'RNR',
        step_number:null,
        parent_id:null
      },
      {
        id:35,
        value: 'Switch Off',
        step_number:null,
        parent_id:34
      },
      {
        id:36,
        value: 'Call Back',
        step_number:null,
        parent_id:34
      },
      {
        id:37,
        value: 'Network Issue',
        step_number:null,
        parent_id:34
      },
      {
        id:38,
        value: 'Ringing',
        step_number:null,
        parent_id:34
      },
      {
        id:39,
        value: 'Not Reachable',
        step_number:null,
        parent_id:34
      },
      {
        id:40,
        value: 'Busy',
        step_number:null,
        parent_id:34
      },
      {
        id:41,
        value: 'Not Available',
        step_number:null,
        parent_id:34
      },
      {
        id:42,
        value: 'BlackListed',
        step_number:null,
        parent_id:null
      }
    ];
    for(let i=0;i<data.length;i++){
      let query = ` insert into lead_status(id,value,step_number,parent_id) values (?,?,?,?)`;
      let bindParams = [data[i].id,data[i].value,data[i].step_number,data[i].parent_id];
      await sequelize.query(query, {replacements:bindParams, type: QueryTypes.INSERT });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('lead_status', null, {});
  }
};
