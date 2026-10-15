const { logger } = require('./api/helpers/logger');
const bcrypt = require("bcrypt");
const {sequelize, User} = require('./models');
let UserService = require("./api/services/user-services.js");
const genrateNumber  = () =>{
   let randomNumber = parseInt(Math.random() * 10000000000).toString();
   return randomNumber;
}
let data =[];
const createBulkUsers =  ()=>{
    let name ;
    let email;
    let role;
    let parent;
    let phone;
    let password= "Hello@123";
    const csv = require('csv-parser')
    const fs = require('fs')
    const datas = [];
    
    fs.createReadStream('AddRoles.csv')
      .pipe(csv())
      .on('data', async (results) => {
       data.push(results)
    })
      .on('end', async () => {
        for(let i=0;i<data.length;i++){
           
            name = data[i]['Name & Email id']
            role= data[i]['Role']
            //console.log(i,"b")
            email = data[i]['User Name'];
            phone = data[i]['Mobile No'];
            let user = await UserService.findUser(email);
            if(user) {
                if(phone){
                    await UserService.updateUserPhone(email,phone);
                }
                continue;
            }
           // let user = true;
            // while(user){
            //     phone = genrateNumber();
            //     user = await UserService.findUserByPhoneOrEmail(email,phone);
            // }
            let parentUsers = await UserService.getParentUsersByRole(role);
            let index= genrateNumber()%parentUsers.length;
            parent= parentUsers[index].id;
            password = await bcrypt.hash("Hello@123", 10);
            role = await UserService.findRole(role);
            role = role.id;
            let verifyOtp = Math.floor(1000 + Math.random() * 900000);
            try{
            await UserService.addUser({ email, phone, role, name, password, parent, createdBy: '0ac442e1-69ec-4507-b0a9-2c449bda461c', otp: verifyOtp, otpCreatedAt: new Date() });  
            }catch(err){
                console.log(err)
            }
        }
       
      })
}

const addUser = async (data) => {
    try {
        let { email, phone, role, name, password, parent } = data;
       
            password = await bcrypt.hash(password, 10);
           
            console.log(password)
              
    }
    catch (e) {
        logger.error(e)
    }
}

createBulkUsers();
        