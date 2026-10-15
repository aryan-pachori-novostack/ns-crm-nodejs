exports.CibilReportTemplate = (data) => {
    return (
        `<html>
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
      <table class="gmail-table">
        <thead>
          <tr>
            <th>Serial No</th>
            <th>Frequency</th>
            <th>Total Pending</th>
            <th>Total Success</th>
            <th>Total Failed</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${data[0]?.serial_no}</td>
            <td>${data[0]?.frequency}</td>
            <td>${data[0]?.total_pending}</td>
            <td>${data[0]?.total_success}</td>
            <td>${data[0]?.total_failed}</td>
          </tr>
          <tr>
            <td>${data[1]?.serial_no}</td>
            <td>${data[1]?.frequency}</td>
            <td>${data[1]?.total_pending}</td>
            <td>${data[1]?.total_success}</td>
            <td>${data[1]?.total_failed}</td>
          </tr>
          <tr>
            <td>${data[2]?.serial_no}</td>
            <td>${data[2]?.frequency}</td>
            <td>${data[2]?.total_pending}</td>
            <td>${data[2]?.total_success}</td>
            <td>${data[2]?.total_failed}</td>
          </tr>
        </tbody>
      </table>
      <body>
      </html>
      `
    )
};


