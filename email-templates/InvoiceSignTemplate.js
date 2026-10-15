exports.InvoiceSignTemplate = (url,signer_name) => {
    const text = () => {
        return `
         <p>Dear Sir/Madam,</p>

        <p>Please click on the below link and follow the below steps to sign the same:</p>
        <ol>
            <li style="margin-bottom: 8px;">It will open in the web-browser of your PC or mobile.</li>
            <li style="margin-bottom: 8px;">It will ask to generate OTP.</li>
            <li style="margin-bottom: 8px;">Same will be sent to the same Mail ID again.</li>
            <li style="margin-bottom: 8px;">
                Once the OTP is submitted, the browser will display a copy of the invoice generated with case-wise working if any.
            </li>
            <li style="margin-bottom: 8px;">
                Please check the same:
                <ul style="padding-left: 20px; margin-top: 8px;">
                   <li style="margin-bottom: 5px;">If you find the calculation correct, then sign the same digitally.</li>
                    <li>If there is any issue, Decline and coordinate with your BH for the concern related to same.</li>
                </ul>
            </li>
            <li style="margin-bottom: 8px;">
             If you are GST registered vendor, then you still need to sign this without GST invoice, to understand your acceptance on before GST amount calculated by us is correct or not. You also have to submit your GST/IGST invoice as per earlier process to gstsupport@ruloans.com to get paid for balance GST amount, as per the timeline we have set.</li>
        </ol>

        <p>
            <a href="${url}" download="${url}">
                Please click on this link to review and sign the invoice at your earliest convenience.
            </a>
        </p>
        `;
    };

    return `
        <html>
            <head></head>
            <body>
                ${text()}
            </body>
        </html>
    `;
};
