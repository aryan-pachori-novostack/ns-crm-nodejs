const { sequelize} = require('../../models');
const { QueryTypes } = require('sequelize');

const get = async (where) => {
    let bindParams= [];
    let and = false;
    let query = ' SELECT * FROM  lead_status ls';   
    if(where && where.length!=0){
        for(let i=0;i<where.length;i++){
            if(and == false){
                query +=' where ';
                and = true;
            }else{
                query +=' and ';
                and = true;
            }
            if(where[i][2]){
                query+=where[i][0] + where[i][1] +' ? ';
                bindParams.push(where[i][2]);
            }else{
                query+=where[i][0] + where[i][1] + ' ';
            }
        }
    } 
    const results = await sequelize.query(query, {  replacements:bindParams,type: QueryTypes.SELECT });
    return results;
    // We didn't need to destructure the result here - the results were returned directly
}


module.exports = {
    get
}