exports.InstantClaimErrorEmailTemplate = ({
    application_id,
    error_message
}, partner) => {
    return (
        `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instant Claim Error Notification</title>
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
        .error-container {
            background-color: #fff;
            border: 1px solid #dc3545;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .error-header {
            color: #dc3545;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .info-box {
            background-color: #e9ecef;
            border-radius: 5px;
            padding: 15px;
            margin: 15px 0;
        }
        .blue-button {
            display: inline-block;
            background-color: #007bff;
            color: white !important;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 20px;
        }
        .blue-button:hover {
            background-color: #0056b3;
        }
        .warning-text {
            color: #856404;
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 10px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <h2>Instant Claim Processing Error</h2>
    <p>Hi ${partner.full_name || "Team"},</p>
    <p>We encountered an error while processing an instant claim request. Please review the details below and take appropriate action.</p>
    
    <div class="error-container">
        <div class="error-header">⚠️ Error Details</div>
        <div class="info-box">
            <p><strong>Application ID:</strong> ${application_id || "N/A"}</p>
            <p><strong>Error Message:</strong> ${error_message || "Unknown error occurred"}</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        </div>
    </div>

    <div class="warning-text">
        <strong>Important:</strong> This error may impact the application processing workflow. Please investigate and resolve the issue promptly.
    </div>

    <h3>Recommended Actions:</h3>
    <ul>
        <li>Review the application details in the CRM system</li>
        <li>Check if all required documents are properly uploaded</li>
        <li>Verify the application status and eligibility criteria</li>
        <li>Contact the technical team if the error persists</li>
    </ul>

    <p style="margin-top: 20px; font-size: 14px; color: #666;">
        If you have any questions or need assistance, please don't hesitate to contact our support team.
    </p>
    
    <p style="margin-top: 10px; font-size: 12px; color: #666;">
        This is an automated notification. Please do not reply to this email.
    </p>
</body>
</html>
`
    );
};
