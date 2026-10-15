
const { logger } = require("../../api/helpers/logger");
const { _db2,sequelize } = require('../db');
const { QueryTypes } = require('sequelize');
const { sendSMSNew } = require("../../api/helpers/commonhelper");
let DSAService = require(_pathconst.ServicesPath.DSAService);


module.exports = async function (job) {
    try {

        if ( process.env.ENVIRONMENT != 'test') {
            let comm = await DSAService.getTimeBasedCommunication();
            
            for(let i=0;i<comm.length;i++){
                console.log("comm",comm.length)
                let frequency = comm[i].frequency;
                let from_value = comm[i].from_value;
                console.log("comm",frequency,from_value)
                let status = ` select * from picklist_values where value = ?  and key_id = 19 `;
                status = await sequelize.query(status,{replacements:[from_value],type:QueryTypes.SELECT});
                
                status = status[0].id;
                console.log("status",status)
                let query = ` SELECT dsa_id,partner_code,dsa_mobile_number
                FROM ru_direct_selling_agents
                WHERE ( last_communication_at IS NULL OR last_communication_at < NOW() - INTERVAL ? DAY ) and dsa_status = ? 
                `
                let bindParams = [frequency,status];
                let dsa = await _db2.query(query,{replacements:bindParams,type:QueryTypes.SELECT});
                console.log(dsa.length,"dsaLength")
                for(let j=0;j<dsa.length;j++){
                    try{
                       // console.log(dsa[j].dsa_mobile_number)
                    await sendSMSNew(comm[i].template_id,comm[i].template,dsa[j].dsa_mobile_number)
                   await DSAService.addCommunicationApplicationLog(dsa[j].dsa_id,comm[i].template,comm[i].template_id,dsa[j].partner_code)
                    let query = ` update ru_direct_selling_agents set last_communication_at = ? where dsa_id = ? `;
                    await _db2.query(query,{replacements:[new Date(),dsa[j].dsa_id],type:QueryTypes.UPDATE})
                    }catch(err){
                        logger.error(err.message)
                    }
                }
            }
        } 
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

