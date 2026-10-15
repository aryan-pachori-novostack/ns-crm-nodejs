'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   await queryInterface.addColumn(
    'users', // table name
    'otp', // new field name
    {
      type: Sequelize.INTEGER,
      allowNull:true
    },
  );
  await queryInterface.addColumn(
    'users', // table name
    'otpCreatedAt', // new field name
    {
      type: Sequelize.DATE,
      allowNull:true
    },
  );
  await queryInterface.addColumn(
    'users', // table name
    'validatedAt', // new field name
    {
      type: Sequelize.DATE,
      allowNull:true
    },
  );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'otp');
    await queryInterface.removeColumn('users', 'otpCreatedAt');
    await queryInterface.removeColumn('users', 'validateAt');
  }
};
