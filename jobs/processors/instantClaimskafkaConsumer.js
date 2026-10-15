const axios = require("axios");
let KafkaServices = require(_pathconst.ServicesPath.KafkaServices);
let DSAService = require(_pathconst.ServicesPath.DSAService);
let LeadService = require(_pathconst.ServicesPath.LeadService);


module.exports = async () => {
  await KafkaServices.connectKafkaConsumer();
  const topic = process.env.KAFKA_TOPIC_INSTANT_CLAIM
  await global._consumer.subscribe({ topic: topic, fromBeginning: false });

  await global._consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const value = message.value.toString();
        const messageData = JSON.parse(value);
        const { loan_type, application_id, dsa_id, dsa_mobile_number, netsuite_vendor_id, platform } = messageData;

        if (!loan_type || !application_id || !dsa_id || !dsa_mobile_number || !netsuite_vendor_id || !platform) {
          throw new Error(`Invalid message values: loan_type=${loan_type}, application_id=${application_id}, dsa_id=${dsa_id} , dsa_mobile_number=${dsa_mobile_number} , netsuite_vendor_id=${netsuite_vendor_id} , platform=${platform}`);
        }

        const lead_data = await DSAService.validateAndInsertLeadForInstantClaim(application_id, dsa_id, netsuite_vendor_id, loan_type, dsa_mobile_number, platform)

        if (!lead_data.isValid) {
          DSAService.sendInstantClaimErrorEmail(dsa_id, application_id, lead_data.errorMsg)
          return
        }

        const { new_lead: lead } = lead_data
        const { fresh_lead_id: id } = lead

        let finalObj = [{ id, source: 8 }]
        let isClaimed = true


        let options = {
          method: "POST",
          //direct billing true for direct claim
          data: { freshLeadIdArray: finalObj, isGetError: 1, directBilling: true },
          url: `${process.env.MS_URL}/api/fresh-lead/erp-submit`,
          headers: {
            // 'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI1IiwianRpIjoiM2E2MjUzOTE1NjRlYmFlYWJmM2I0NTkxYWZmMzNmY2JiMTBkNmQxMGI3Nzg5N2JkMzhlMmI5ZjU3YWQ2MTExYzAxYjQ2Y2M5NzY4NTdhNmYiLCJpYXQiOjE2OTc3MzQ0NjEuMzY2ODYsIm5iZiI6MTY5NzczNDQ2MS4zNjY4NjMsImV4cCI6MTcyOTM1Njg2MS4zNTQ3NzQsInN1YiI6IjE4NjgiLCJzY29wZXMiOltdfQ.nsyG2ezKvom4Bis50y8gECaskDn1IGEsEPArA4TWC6VFl_TBJz9FGCcfyiBL_Pyk1906ehIXSB_WjOOAtQpQMaLEbSd3Vr4CAQe6oOCq_thS0D_vtRRadOok13Xp9dg1wdL32MXCjsQgfT74CvZKjSQLsWPCIRylD_042rUUXYC2XEhXAPAMR681dGy3xXZv5lKeVUgGZRGseCKFtfGa3dCei_qM5kuXpWv1baqbyFmvIIQDGbnknE-3K3KpXGUx_ujdxeS_Lo0UX2Ot9R8jk7NdBUNDF5ISFV7QNibzl4b0vYjwhqVqXmnCgu98s-o8tMVW1gDy8VYVMSFo0MMAf2tdEM7kYUbzJbbfMgBCARsmspcp8YMEkCs8bcvcVTrC7O-rcVJC4ViFVi_aCbbvXEK8jk70zgaXWJkncI6QiVw33h8hAyQ23Zou0EmZYVT2au0C2ZMRhXUYg1VYo2yUHBxE1k5oDcH7cCTG2G4zywr6s3LJzwO7OWry2W1Mk_cUCdZlBJHqWj-8AFqG6wmzovLTjGiR0MLqQW1jrQZIVuyoHgE0H5rB2W4k3HNe3BEb7_G5yf1V9h-IKYMBpsJNvpmr8R6bhy_ilN_XzfhGXi6Cb_Y6iisawesW8gtDkijro8J9tRfOsKYq-fN48Z7pjl9sepVict6L5fgkXZ9pvSc',
            'api-key': process.env.AUTH_KEY_RULOANS_BANK_CLAIM,
            // 'app-version-code': '25',
            'device-type': '1',
            'Content-Type': 'application/json'
          },
          validateStatus: () => true,
        };

        const response = await axios(options);

        let { status, message: resMessage, data } = response?.data || {};
        resMessage = resMessage?.length ? resMessage : "Try again later."

        //if (!Boolean(status)) { 
        //  return message
        //}

        if (!data?.sentToErpArray.length) {
          // let errorMsg = response?.body || "Failed to Claim Application"
          //DSAService.sendInstantClaimErrorEmail(dsa_id, application_id, errorMsg)
          //await DSAService.deleteLeadFormData([id], dsa_id, 1)
          await DSAService.updateClaimPendingStatus([id], 0, null)
          isClaimed = false
        }
        DSAService.sendInstantClaimNotificationAndEmail(dsa_id, lead, isClaimed)
        await DSAService.updateApplicationClaimStatus(application_id, loan_type, 1)
      } catch (err) {
        console.error(`Error processing message:`, err);
      }
    }
  });

  console.log('Kafka Instant Claim consumer running...');

};
