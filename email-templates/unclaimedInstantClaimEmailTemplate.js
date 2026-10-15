exports.unclaimedInstantClaimEmailTemplate = ({
    loan_reference_id,
    customer_first_name,
    customer_last_name,
    disbursement_amount,
    disbursement_date_iso,
    product_name,
    bank_name,
    city
}, partner) => {
    return (
        `
<!DOCTYPE html>
<html lang="en">
<body>

    <p>Dear ${partner.full_name || ""},</p>
    <p>An instant claim file has been received and is currently marked as <strong>unclaimed</strong>. Please review the details below:</p>

    <table border="1">
        <thead>
            <tr>
                <th>Item</th>
                <th>Details</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>DSA Name</td>
                <td>${partner.dsa_full_name || ""}</td>
            </tr>
            <tr>
                <td>Loan No.:</td>
                <td>${loan_reference_id || ""}</td>
            </tr>
            <tr>
                <td>Customer Name:</td>
                <td>${customer_first_name || ""} ${customer_last_name || ""}</td>
            </tr>
            <tr>
                <td>Disbursal Date:</td>
                <td>${disbursement_date_iso || ""}</td>
            </tr>
            <tr>
                <td>Disbursement Amount</td>
                <td>${disbursement_amount || ""}</td>
            </tr>
            <tr>
                <td>Hierarchy</td>
                <td>${partner.hierarchy_crm || ""}</td>
            </tr>
            <tr>
                <td>Bank / NBFC Name:</td>
                <td>${bank_name || ""}</td>
            </tr>
            <tr>
                <td>Product:</td>
                <td>${product_name || ""}</td>
            </tr>
            <tr>
                <td>City & State of Disbursal:</td>
                <td>${city || ""}</td>
            </tr>
        </tbody>
    </table>

    <p>Kindly take the necessary action at your earliest convenience.</p>
    <p>Regards,<br/>Operations Team</p>

</body>
</html>
`
    );
};
