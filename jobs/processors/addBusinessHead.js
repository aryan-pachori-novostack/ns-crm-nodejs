const { QueryTypes } = require("sequelize");

let DSAService = require(_pathconst.ServicesPath.DSAService);

module.exports = async function (job) {
    try {
        let query = ` select dsa_mobile_number, partner_code from ru_direct_selling_agents where business_head_code is null and partner_code is not null `;
        let result = await _db2.query(query, { type: QueryTypes.SELECT });
        for (i = 0; i < result?.length; i++) {
            if (result[i]?.partner_code) {
                let business_head = await DSAService.getBusinessHeadRecursively(result[i]?.partner_code);
                query = ` update ru_direct_selling_agents set business_head_code = ? where dsa_mobile_number = ? `
                let bindParams = [business_head?.dsa_mobile_number || null, result[i]?.dsa_mobile_number];
                await _db2.query(query, { replacements: bindParams, type: QueryTypes.UPDATE });
            };
        };
    } catch (e) {
        console.log(e)
    };
};