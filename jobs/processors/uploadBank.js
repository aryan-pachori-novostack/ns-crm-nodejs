let path = require('path');
const config = require("../../config/config");
const { logger } = require("../../api/helpers/logger");
const { sequelize,_db2 } = require('../db');
const { QueryTypes } = require('sequelize');
let fs = require('fs');
const xlsx = require('xlsx')

module.exports = async function (job) {
  try {
    let { file } = job.data;
    console.log("I am Here **123#4")
    const buf = Buffer.from(file, 'base64')//.toString();
    //const filename = await fs.writeFileSync('uploadPayout.xlsx', decodedBase64String);
    const sheet = await xlsx.read(buf, { type: 'buffer' })
    await xlsx.writeFile(sheet, "uploadBank.xlsx");
    const fileData = xlsx.readFile('uploadBank.xlsx');
    let sheetNames = fileData.SheetNames;
    console.log("I am Here **123#4 1")
    const json = xlsx.utils.sheet_to_json(fileData.Sheets[sheetNames[0]]);
    console.log("I am Here **123#4 2")
    for(let j=0;j<json.length;j=j+200){
      let query;
      let bindParams = [];
      for (let i = j; i < j+200 && i<json.length; i++) {
        try {
          let id = json[i]['id']?parseInt(json[i]['id']):null;
          console.log("I am Here **123#4 3",json.length,i)
          if(i%200==0) {
            query = ` insert into bank_details ( id, bank_nbfc_name, product, market_and_sub_type, state, city, company, login_code, location, sales_manager, sales_manager_mobile, sales_manager_email, sales_manager_code, assistant_sales_manager, assistant_sales_manager_mobile, assistant_sales_manager_email, regional_sales_manager, regional_sales_manager_mobile, regional_sales_manager_email, zonal_sales_manager, zonal_sales_manager_mobile, zonal_sales_manager_email, national_sales_manager, national_sales_manager_mobile, national_sales_manager_email, login_process, company_category_list, product_and_policy, branch_address, remark, updatedAt, createdAt ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
          }
          else{
            query+= ` , (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `
          }
          bindParams = bindParams.concat([id,json[i].bank_nbfc_name || "", json[i].product || "", json[i].market_and_sub_type || "", json[i].state || "", json[i].city || "", json[i].company || "", json[i].login_code || "", json[i].location || "", json[i].sales_manager || "", json[i].sales_manager_mobile || "", json[i].sales_manager_email || "", json[i].sales_manager_code || "", json[i].assistant_sales_manager || "", json[i].assistant_sales_manager_mobile || "", json[i].assistant_sales_manager_email || "", json[i].regional_sales_manager || "", json[i].regional_sales_manager_mobile || "", json[i].regional_sales_manager_email || "", json[i].zonal_sales_manager || "", json[i].zonal_sales_manager_mobile || "", json[i].zonal_sales_manager_email || "", json[i].national_sales_manager || "", json[i].national_sales_manager_mobile || "", json[i].national_sales_manager_email || "", json[i].login_process || "", json[i].company_category_list || "", json[i].product_and_policy || "", json[i].branch_address || "", json[i].remark || "",new Date(), new Date()]);
          // if (id) {
          //   let query = ` select * from bank_details where id = ? `;
          //   let bindParams = [id];
          //   let bank = await sequelize.query(query, { replacements: bindParams, type: QueryTypes.SELECT });
          //   bank = bank[0];
          //   if (bank) {
          //     query = `  update bank_details set bank_nbfc_name  = ?,product = ?,market_and_sub_type = ?,state = ?,city = ?,company = ?,login_code = ?,location = ?,sales_manager = ?,sales_manager_mobile = ?,sales_manager_email = ?,sales_manager_code = ?,assistant_sales_manager = ?,assistant_sales_manager_mobile = ?,assistant_sales_manager_email = ?,regional_sales_manager = ?,regional_sales_manager_mobile = ?,regional_sales_manager_email = ?,zonal_sales_manager = ?,zonal_sales_manager_mobile = ?,zonal_sales_manager_email = ?,national_sales_manager = ?,national_sales_manager_mobile = ?,national_sales_manager_email = ?,login_process = ?,company_category_list = ?,product_and_policy = ?,branch_address = ?,remark = ?,updatedAt = ?  where id = ? `;
          //     bindParams = [json[i].bank_nbfc_name || "", json[i].product || "", json[i].market_and_sub_type || "", json[i].state, json[i].city || "", json[i].company || "", json[i].login_code || "", json[i].location || "", json[i].sales_manager || "", json[i].sales_manager_mobile || "", json[i].sales_manager_email || "", json[i].sales_manager_code || "", json[i].assistant_sales_manager || "", json[i].assistant_sales_manager_mobile || "", json[i].assistant_sales_manager_email || "", json[i].regional_sales_manager || "", json[i].regional_sales_manager_mobile || "", json[i].regional_sales_manager_email || "", json[i].zonal_sales_manager || "", json[i].zonal_sales_manager_mobile || "", json[i].zonal_sales_manager_email || "", json[i].national_sales_manager || "", json[i].national_sales_manager_mobile || "", json[i].national_sales_manager_email || "", json[i].login_process || "", json[i].company_category_list || "", json[i].product_and_policy || "", json[i].branch_address || "", json[i].remark || "", new Date(), id];
          //     await sequelize.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
          //   } else {
          //     query = `  insert into bank_details ( bank_nbfc_name,product,market_and_sub_type,state,city,company,login_code,location,sales_manager,sales_manager_mobile,sales_manager_email,sales_manager_code,assistant_sales_manager,assistant_sales_manager_mobile,assistant_sales_manager_email,regional_sales_manager,regional_sales_manager_mobile,regional_sales_manager_email,zonal_sales_manager,zonal_sales_manager_mobile,zonal_sales_manager_email,national_sales_manager,national_sales_manager_mobile,national_sales_manager_email,login_process,company_category_list,product_and_policy,branch_address,remark ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
          //     bindParams = [json[i].bank_nbfc_name || "", json[i].product || "", json[i].market_and_sub_type || "", json[i].state, json[i].city || "", json[i].company || "", json[i].login_code || "", json[i].location || "", json[i].sales_manager || "", json[i].sales_manager_mobile || "", json[i].sales_manager_email || "", json[i].sales_manager_code || "", json[i].assistant_sales_manager || "", json[i].assistant_sales_manager_mobile || "", json[i].assistant_sales_manager_email || "", json[i].regional_sales_manager || "", json[i].regional_sales_manager_mobile || "", json[i].regional_sales_manager_email || "", json[i].zonal_sales_manager || "", json[i].zonal_sales_manager_mobile || "", json[i].zonal_sales_manager_email || "", json[i].national_sales_manager || "", json[i].national_sales_manager_mobile || "", json[i].national_sales_manager_email || "", json[i].login_process || "", json[i].company_category_list || "", json[i].product_and_policy || "", json[i].branch_address || "", json[i].remark || ""];
          //     await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
          //   }
          // } else {
          //   query = `  insert into bank_details ( bank_nbfc_name,product,market_and_sub_type,state,city,company,login_code,location,sales_manager,sales_manager_mobile,sales_manager_email,sales_manager_code,assistant_sales_manager,assistant_sales_manager_mobile,assistant_sales_manager_email,regional_sales_manager,regional_sales_manager_mobile,regional_sales_manager_email,zonal_sales_manager,zonal_sales_manager_mobile,zonal_sales_manager_email,national_sales_manager,national_sales_manager_mobile,national_sales_manager_email,login_process,company_category_list,product_and_policy,branch_address,remark ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) `;
          //   bindParams = [json[i].bank_nbfc_name || "", json[i].product || "", json[i].market_and_sub_type || "", json[i].state, json[i].city || "", json[i].company || "", json[i].login_code || "", json[i].location || "", json[i].sales_manager || "", json[i].sales_manager_mobile || "", json[i].sales_manager_email || "", json[i].sales_manager_code || "", json[i].assistant_sales_manager || "", json[i].assistant_sales_manager_mobile || "", json[i].assistant_sales_manager_email || "", json[i].regional_sales_manager || "", json[i].regional_sales_manager_mobile || "", json[i].regional_sales_manager_email || "", json[i].zonal_sales_manager || "", json[i].zonal_sales_manager_mobile || "", json[i].zonal_sales_manager_email || "", json[i].national_sales_manager || "", json[i].national_sales_manager_mobile || "", json[i].national_sales_manager_email || "", json[i].login_process || "", json[i].company_category_list || "", json[i].product_and_policy || "", json[i].branch_address || "", json[i].remark || ""];
          //   await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
          // }
  
        } catch (err) {
          console.log(err)
          logger.error(err)
        }
      }
      query += ` on DUPLICATE KEY UPDATE id = values(id),bank_nbfc_name= values(bank_nbfc_name),product= values(product),market_and_sub_type= values(market_and_sub_type),state= values(state),city= values(city),company= values(company),login_code= values(login_code),location= values(location),sales_manager= values(sales_manager),sales_manager_mobile= values(sales_manager_mobile),sales_manager_email= values(sales_manager_email),sales_manager_code= values(sales_manager_code),assistant_sales_manager= values(assistant_sales_manager),assistant_sales_manager_mobile= values(assistant_sales_manager_mobile),assistant_sales_manager_email= values(assistant_sales_manager_email),regional_sales_manager= values(regional_sales_manager),regional_sales_manager_mobile= values(regional_sales_manager_mobile),regional_sales_manager_email= values(regional_sales_manager_email),zonal_sales_manager= values(zonal_sales_manager),zonal_sales_manager_mobile= values(zonal_sales_manager_mobile),zonal_sales_manager_email= values(zonal_sales_manager_email),national_sales_manager= values(national_sales_manager),national_sales_manager_mobile= values(national_sales_manager_mobile),national_sales_manager_email= values(national_sales_manager_email),login_process= values(login_process),company_category_list= values(company_category_list),product_and_policy= values(product_and_policy),branch_address= values(branch_address),remark= values(remark),updatedAt  = values(updatedAt), createdAt  = values(createdAt) `;
      console.log("I am Here **123#4 5")
      await sequelize.query(query, { replacements: bindParams, type: QueryTypes.INSERT });
    }
   
  } catch (e) {
    console.log(e)
    logger(e)
  }
};

