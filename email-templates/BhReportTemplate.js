exports.BhReportTemplate = (onboardingData, lntData, role = "BH", date) => {

  const onboardingHtml = () => {
    let string = "";
    let previousFrequency = null;
    let frq = [];
    onboardingData.forEach((item) => {
      const frequency = item.frequency;
      
      

      // Check if frequency has changed
      if (frequency !== previousFrequency) {
        // If this is not the first iteration, add a row with an empty cell for the "Source" column
        if (previousFrequency !== null) {
          string += `<tr><td></td></tr>`;
        }

        // Open a new row for the current frequency
        string += `<tr><td>${frequency || 0}</td>`;
      }
     
      frq.push(frequency)
  

      for (const source in item) {
        if (source !== 'frequency' && item.hasOwnProperty(source)) {
          const rowData = item[source];
          
          string += `
            <tr>
              <td>${frq.includes(frequency) ?' ': frequency || 0}</td>
              <td>${source}</td>
              <td>${rowData?.total || 0}</td>
              <td>${rowData?.signUpStep1 || 0}</td>
              <td>${rowData?.signUpStep2 || 0}</td>
              <td>${rowData?.signUpStep3 || 0}</td>
              <td>${rowData?.signUpStep4 || 0}</td>
              <td>${rowData?.signUpStep5 || 0}</td>
              <td>${rowData?.signUpStep6 || 0}</td>
              <td>${((rowData?.signUpStep5/rowData?.total)*100 || 0).toFixed(2)}%</td>
            </tr>
          `;
          frq.push(frequency)
        }
      }
     
    });
  
    return string;
  };
  const lntHtml = () => {
    let string = "";
    for (i = 0; i < lntData?.length; i++) {
      string += `
  <tr>
        <td>${lntData[i]?.frequency}</td>
        <td>Login</td>
        <td>${lntData[i]["login"]?.total_in_progress}</td>
        <td>${lntData[i]["login"]?.total_rejected}</td>
        <td>${lntData[i]["login"]?.total_approved}</td>
        <td>${lntData[i]["login"]?.total_approved_amount}</td>
        <td>${lntData[i]["login"]?.total_disbursed}</td>
        <td>${lntData[i]["login"]?.total_disbursed_amount}</td>
      </tr>
      ${lntData[i]["disbursed"] ? `
      <tr>
        <td>${lntData[i]?.frequency}</td>
        <td>Disbursed</td>
        <td>${lntData[i]["disbursed"]?.total_in_progress}</td>
        <td>${lntData[i]["disbursed"]?.total_rejected}</td>
        <td>${lntData[i]["disbursed"]?.total_approved}</td>
        <td>${lntData[i]["disbursed"]?.total_approved_amount}</td>
        <td>${lntData[i]["disbursed"]?.total_disbursed}</td>
        <td>${lntData[i]["disbursed"]?.total_disbursed_amount}</td>
      </tr>` : ""}
      `
    }
    return string
  };

  return (
    `
    <html>

<head>
  <style>
    .gmail-table {
      border: solid 2px #DDEEEE;
      border-collapse: collapse;
      border-spacing: 0;
      font: normal 14px Roboto, sans-serif;
    }

    .gmail-table thead th {
      background-color: #DDEFEF;
      border: solid 1px #DDEEEE;
      color: #336B6B;
      padding: 10px;
      text-align: left;
      text-shadow: 1px 1px 1px #fff;
    }

    .gmail-table tbody td {
      border: solid 1px #DDEEEE;
      color: #333;
      padding: 10px;
      text-shadow: 1px 1px 1px #fff;
    }
  </style>
</head>

<body>
  <h2>Partner Onboarding:</h2>
  <ul>
    <li>16%(MobileNumberVerified)</li>
    <li>33%(DSA Basic Details Saved)</li>
    <li>50%(DSA Address Details Saved)</li>
    <li>66%(KYC Completed)</li>
    <li>83%(DSAJoining Agreement Signed)</li>
    <li>100%(Payout Agreement Signed)</li>
  </ul>
  <table class="gmail-table">
    <thead>
      ${role == "CEO" ? `<tr>
      <th>Date</th>
      <th>${date}</th>
    </tr>` : ""}
      <tr>
        <th>Frequency</th>
        <th>Source</th>
        <th>Total</th>
        <th>16%</th>
        <th>33%</th>
        <th>50%</th>
        <th>66%</th>
        <th>83%</th>
        <th>100%</th>
        <th>%Completion</th>
      </tr>
    </thead>
    <tbody>
     ${onboardingHtml()}
    </tbody>
  </table>
  <br>
  <body>
</html>
    `
  )
};


// exports.BhReportTemplate = (onboardingData, lntData, role = "BH", date) => {

//   const onboardingHtml = () => {
//     let string = "";
//     onboardingData.forEach((item) => {
//       const frequency = item.frequency;
  
//       for (const source in item) {
//         if (source !== 'frequency' && item.hasOwnProperty(source)) {
//           const rowData = item[source];
//           string += `
//             <tr>
//               <td>${frequency || 0}</td>
//               <td>${source}</td>
//               <td>${rowData?.total || 0}</td>
//               <td>${rowData?.signUpStep1 || 0}</td>
//               <td>${rowData?.signUpStep2 || 0}</td>
//               <td>${rowData?.signUpStep3 || 0}</td>
//               <td>${rowData?.signUpStep4 || 0}</td>
//               <td>${rowData?.signUpStep5 || 0}</td>
//               <td>${rowData?.signUpStep6 || 0}</td>
//             </tr>
//           `;
//         }
//       }
//     });
  
//     return string;
//   };
//   const lntHtml = () => {
//     let string = "";
//     for (i = 0; i < lntData?.length; i++) {
//       string += `
//   <tr>
//         <td>${lntData[i]?.frequency}</td>
//         <td>Login</td>
//         <td>${lntData[i]["login"]?.total_in_progress}</td>
//         <td>${lntData[i]["login"]?.total_rejected}</td>
//         <td>${lntData[i]["login"]?.total_approved}</td>
//         <td>${lntData[i]["login"]?.total_approved_amount}</td>
//         <td>${lntData[i]["login"]?.total_disbursed}</td>
//         <td>${lntData[i]["login"]?.total_disbursed_amount}</td>
//       </tr>
//       ${lntData[i]["disbursed"] ? `
//       <tr>
//         <td>${lntData[i]?.frequency}</td>
//         <td>Disbursed</td>
//         <td>${lntData[i]["disbursed"]?.total_in_progress}</td>
//         <td>${lntData[i]["disbursed"]?.total_rejected}</td>
//         <td>${lntData[i]["disbursed"]?.total_approved}</td>
//         <td>${lntData[i]["disbursed"]?.total_approved_amount}</td>
//         <td>${lntData[i]["disbursed"]?.total_disbursed}</td>
//         <td>${lntData[i]["disbursed"]?.total_disbursed_amount}</td>
//       </tr>` : ""}
//       `
//     }
//     return string
//   };

//   return (
//     `
//     <html>

// <head>
//   <style>
//     .gmail-table {
//       border: solid 2px #DDEEEE;
//       border-collapse: collapse;
//       border-spacing: 0;
//       font: normal 14px Roboto, sans-serif;
//     }

//     .gmail-table thead th {
//       background-color: #DDEFEF;
//       border: solid 1px #DDEEEE;
//       color: #336B6B;
//       padding: 10px;
//       text-align: left;
//       text-shadow: 1px 1px 1px #fff;
//     }

//     .gmail-table tbody td {
//       border: solid 1px #DDEEEE;
//       color: #333;
//       padding: 10px;
//       text-shadow: 1px 1px 1px #fff;
//     }
//   </style>
// </head>

// <body>
//   <h2>Partner Onboarding:</h2>
//   <ul>
//     <li>16%(MobileNumberVerified)</li>
//     <li>33%(DSA Basic Details Saved)</li>
//     <li>50%(DSA Address Details Saved)</li>
//     <li>66%(KYC Completed)</li>
//     <li>83%(DSAJoining Agreement Signed)</li>
//     <li>100%(Payout Agreement Signed)</li>
//   </ul>
//   <table class="gmail-table">
//     <thead>
//       ${role == "CEO" ? `<tr>
//       <th>Date</th>
//       <th>${date}</th>
//     </tr>` : ""}
//       <tr>
//         <th>Frequency</th>
//         <th>Source</th>
//         <th>Total</th>
//         <th>16%</th>
//         <th>33%</th>
//         <th>50%</th>
//         <th>66%</th>
//         <th>83%</th>
//         <th>100%</th>
//       </tr>
//     </thead>
//     <tbody>
//      ${onboardingHtml()}
//     </tbody>
//   </table>
//   <br>
//   <br>
//   <h2>LNT Report:</h2>
//   <table class="gmail-table">
//     <thead>
//       <tr>
//         <th>Frequency</th>
//         <th>Type</th>
//         <th>Total In Progress</th>
//         <th>Total Rejected</th>
//         <th>Total Approved</th>
//         <th>Total Approved Amount</th>
//         <th>Total Disbursed</th>
//         <th>Total Disbursed Amount</th>
//       </tr>
//     </thead>
//     <tbody>
//     ${lntHtml()}
//     </tbody>
//   </table>
//   <br>
//     ${lntData[0]["disbursed"]?.total_unique_files >= 0 ? `<p>Total unique vendors for Disbursed (${date}): ${lntData[0]["disbursed"]?.total_unique_files}.</p>` : ""}
//     ${lntData[0]["login"]?.total_unique_files >= 0 ? `<p>Total unique vendors for Logged In (${date}): ${lntData[0]["login"]?.total_unique_files}.</p>` : ""}
//   <body>
// </html>
//     `
//   )
// };