const { sequelize} = require('../../models');
const { QueryTypes } = require('sequelize');

const get = async () => {

    let query = ' SELECT distinct * FROM  lead_professions';    
    const results = await sequelize.query(query, {  type: QueryTypes.SELECT });
    return results;
    // We didn't need to destructure the result here - the results were returned directly
}


module.exports = {
    get
}