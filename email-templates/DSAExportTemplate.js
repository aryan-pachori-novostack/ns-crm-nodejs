exports.DSAExportTemplate = (urls) => {
    const text = () => {
        let string = "";
        for (i = 0; i < urls?.length; i++) {
            string += `<li class="li"> <a href="${urls[i]}" download="Channel-Partner${i}">Download Report ${i + 1}</a> </li>`
        }
        return string;
    };

    return (
        `<html>
         <head>
            <style>
              .li {
               margin-bottom: 14px;
               font: normal 14px Roboto, sans-serif;
              }
            </style>
           </head>
           <body>
             <ul>
               ${text()}
             </ul>
           <body>
         </html>`
    )
};