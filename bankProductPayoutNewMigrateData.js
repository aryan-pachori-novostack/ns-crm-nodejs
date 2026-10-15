const fs = require('fs');
const path = require('path');
const {sequelize} = require('./models');

const { QueryTypes } = require('sequelize');

const filePath = 'bankProductPayoutNew.csv';

const processData = async () => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const rows = data.split('\n').slice(1); // Skip header row

    for (const row of rows) {
      let [internalId, bankInstitution, productItem,productParentItem,productGroup,invoiceRemark,averageAchievement, ] = row.split(',');

      averageAchievement = parseFloat(averageAchievement.replace('%', ''));
      const insertQuery = `
        INSERT INTO bank_product_payout_new (internalId, bankInstitution, productParentItem,productGroup,invoiceRemark,averageAchievement, productItem, createdAt, updatedAt)
        VALUES (${internalId}, '${bankInstitution}', '${productParentItem}','${productGroup}','${invoiceRemark}','${averageAchievement}', '${productItem}', NOW(), NOW());
        `;
        sequelize.query(insertQuery,{type:QueryTypes.INSERT});
    }

    console.log('Data imported successfully.');
  } catch (error) {
    console.error('Error importing data:', error);
  }
};

processData();
