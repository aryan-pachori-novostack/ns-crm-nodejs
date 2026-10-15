const fs = require('fs');
const { sequelize } = require('./models');
const { QueryTypes } = require('sequelize');

const filePath = 'productsNew.csv';

const processData = async () => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const rows = data.split('\n').slice(1); // Skip header row

    for (const row of rows) {
      let [internalId, name, displayName, subType, mainProduct, description, basePrice, className, productCategory, shortProductNameAsPerVendor, correlatedItem] = row.split(',');

      basePrice = basePrice?parseFloat(basePrice):0;

      const insertQuery = `
        INSERT INTO products_new (internalId, name, displayName, subType, mainProduct, description, basePrice, class, productCategory, shortProductNameAsPerVendor, correlatedItem, createdAt, updatedAt)
        VALUES (${parseInt(internalId)}, '${name}', '${displayName}', '${subType}', '${mainProduct}', '${description}', ${parseFloat(basePrice)}, '${className}', '${productCategory}', '${shortProductNameAsPerVendor}', '${correlatedItem}', NOW(), NOW());
      `;

      await sequelize.query(insertQuery, { type: QueryTypes.INSERT });
    }

    console.log('Data imported successfully.');
  } catch (error) {
    console.error('Error importing data:', error);
  }
};

processData();
