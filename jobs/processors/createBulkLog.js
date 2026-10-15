const { jsonDifference } = require("../../api/helpers/commonhelper");
let ApplicationLogServices = require(_pathconst.ServicesPath.ApplicationLogServices);

module.exports = async function (job) {
    try {
        const { prevData, newData, log_type, created_by, log_id_key } = job?.data;
        console.log(prevData, newData);
        for (let i = 0; i < newData?.length; i++) {
            let difference = jsonDifference(prevData[i], newData[i]);
            if (difference?.length) {
                await ApplicationLogServices.bulkCreate(difference, newData[i]["pin_code"], log_type, created_by);
            }
        };
    } catch (e) {
        console.log(e);
    }
};