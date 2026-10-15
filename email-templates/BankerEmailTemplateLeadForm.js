exports.BankerEmailTemplateLeadForm = ({
    apac_ref_los_number,
    loan_number,
    company_name,
    first_name,
    last_name,
    disbursement_amount,
    disbursement_date_iso,
    product_name,
    bank_name,
    city,
    banker_email,
    banker_mobile,
    asm_email,
    asm_mobile,
    crm_user_email,
    crm_user_mobile,
    crm_user_name,

}) => {
    return (
        `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Disbursal Confirmation</title>
</head>
<body>
    <p>Subject: Require Disbursal Confirmation with PDD status of – (${loan_number ? loan_number + " &" : ""} ${first_name} ${last_name})</p>
    
    <p>Dear Sir / Madam</p>
    
    <p>Please share below pending details of the mentioned customer.</p>
    
    <table border="1">
        <thead>
            <tr>
                <th>Item</th>
                <th>Details</th>
                <th>Remark</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>DSA Name</td>
                <td>RULOANS Distribution Services Pvt. Ltd.</td>
                <td>Yes / No</td>
            </tr>
            <tr>
                <td>Application No.:</td>
                <td>${apac_ref_los_number ? apac_ref_los_number : "App No. Required"}</td>
                <td></td>
            </tr>
            <tr>
                <td>Loan No.:</td>
                <td>${loan_number ? loan_number : "Loan No. Required"}</td>
                <td></td>
            </tr>
            <tr>
                <td>Customer Name:</td>
                <td>${first_name} ${last_name}</td>
                <td></td>
            </tr>
            <tr>
                <td>Customer Company Name:</td>
                <td>${company_name || ""}</td>
                <td></td>
            </tr>
            <tr>
                <td>Disbursal Date:</td>
                <td>${disbursement_date_iso || ""}</td>
                <td></td>
            </tr>
            <tr>
                <td>Loan Amount: (Against which RULOANS will get the final Invoice)</td>
                <td>${disbursement_amount}</td>
                <td></td>
            </tr>
            <tr>
                <td>Bank / NBFC Name:</td>
                <td>${bank_name}</td>
                <td></td>
            </tr>
            <tr>
                <td>Product:</td>
                <td>${product_name}</td>
                <td></td>
            </tr>
            <tr>
                <td>City & State of Disbursal:</td>
                <td>${city}</td>
                <td></td>
            </tr>
            <tr>
                <td>Loan Type:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>Insurance Amount:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>Total Loan Amount:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>PF Collected:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>Subvention (If Any):</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>OTC / PDD Status:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>OTC / PDD Clearing Date:</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>Cheque / DD Encashed:</td>
                <td>Yes / No</td>
                <td></td>
            </tr>
            <tr>
                <td>SM Email ID & Contact no.:</td>
                <td>${banker_email || ""} & ${banker_mobile || ""} </td>
                <td></td>
            </tr>
            <tr>
                <td>ASM Email ID & Contact no.:</td>
                <td>${asm_email || ""} & ${asm_mobile || ""} </td>
                <td></td>
            </tr>
        </tbody>
    </table>
    
    <p>Regards,</p>
    
    <p>(Email: ${crm_user_email || "-"} & Contact No: ${crm_user_mobile || "-"} & Name: ${crm_user_name || "-"})</p>
</body>
</html>
`
    );
};

