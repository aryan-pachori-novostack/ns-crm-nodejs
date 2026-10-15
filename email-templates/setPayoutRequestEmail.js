exports.SetPayoutRequestEmailTemplate = ({
    is_payout_set,
    is_direct_claim_enabled,
    is_product_payout_set,
    dsa_full_name,
    dsa_id,
    product_vendor,
    crmUrl
}, partner) => {
    // Build request messages based on what's not set
    let requestMessages = [];
    
    if (!is_payout_set) {
        requestMessages.push(`Set the payout configuration for DSA:${partner.dsa_full_name || ""}`);
    }
    
    if (!is_direct_claim_enabled) {
        requestMessages.push("Enable Direct Claim for this DSA");
    }
    else if(!is_product_payout_set) {
        const productText = product_vendor ? ` for ${product_vendor}` : "";
        requestMessages.push(`Configure product-specific payout for${productText}`);
    }
    
    const requestMessageText = requestMessages.join("<br><br>");
    
    return (
        `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payout Settings Request</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .blue-button {
            display: inline-block;
            background-color: #007bff;
            color: white !important;
            padding: 2px 12px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 8px;
        }
        .blue-button:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <h2>Payout Settings Configuration Request</h2>
    <p>Dear ${partner.full_name || "Team"},</p>
    <p>This is an automated notification from Ruconnect regarding DSA: <strong>${partner.dsa_full_name || ""} </strong>, who has applied for the Instant Payout facility.</p>
    <p>However, the DSA is currently unable to claim Instant Payout due to missing configurations in the CRM. Please take the following actions to enable it:</p>
    <h3>✅ Required Actions:</h3>
    <p>${requestMessageText}</p>
    <p>🔔 Important:The Claim button is automatically enabled once the payout is set, allowing the DSA to access the Instant Payout facility for PL and BL cases disbursed via the Ruconnect App.</p>
    <p><strong>click on the link below to access the DSA configuration:</strong></p>
    <a href="${crmUrl}/dsa/channel-partners/${dsa_id}" class="blue-button" style="color: white !important;">
        🔗 Configure Now
    </a>
    <a href="https://docs.ruloans.com/crm/features/dsa/channel-partner/instant-claim" class="blue-button" style="color: white !important;">
        📘 Step-by-Step Guide
    </a>
    <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Kindly complete the setup at the earliest to avoid delays in payout processing.
    </p>
    <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Thank you,
        Ruconnect System Notification
    </p>
</body>
</html>
`
    );
};
