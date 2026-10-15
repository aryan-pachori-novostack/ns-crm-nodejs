let ejs = require("ejs");
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const { exec } = require('child_process');
const path = require('path');
const os = require('os');

exports.generatePDF = async (templateString, data, password = null) => {
    const pdfTemplate = await fs.readFile(_pathconst.FilesPath[templateString], 'utf-8');
    const compiledTemplate = ejs.compile(pdfTemplate);
    const template = compiledTemplate(data);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(template);

    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
    });
    await browser.close();


    if (password) {
        return await encryptPdfWithPassword(pdfBuffer, password);
    } 

    return pdfBuffer;
}


async function encryptPdfWithPassword(pdfBuffer, password) {
    return new Promise(async (resolve, reject) => {
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const inputPdfPath = path.join(tempDir, `temp_input_${timestamp}_${randomSuffix}.pdf`);
        const outputPdfPath = path.join(tempDir, `temp_output_${timestamp}_${randomSuffix}.pdf`);

        try {
            await fs.writeFile(inputPdfPath, pdfBuffer);
            const cmd = `qpdf --encrypt "${password}" "${password}" 256 -- "${inputPdfPath}" "${outputPdfPath}"`;
            exec(cmd, async (err, stdout, stderr) => {
                try {
                    if (err) {
                        console.error("Error encrypting PDF with qpdf:", err);
                        console.error("stderr:", stderr);
                        reject(new Error(`qpdf encryption failed: ${err.message}`));
                        return;
                    }
                    const encryptedPdfBuffer = await fs.readFile(outputPdfPath);
                    await cleanupTempFiles(inputPdfPath, outputPdfPath);
                    resolve(encryptedPdfBuffer);
                } catch (readError) {
                    console.error("Error reading encrypted PDF:", readError);
                    await cleanupTempFiles(inputPdfPath, outputPdfPath);
                    reject(readError);
                }
            });
        } catch (writeError) {
            console.error("Error writing temporary PDF file:", writeError);
            await cleanupTempFiles(inputPdfPath, outputPdfPath);
            reject(writeError);
        }
    });
}

async function cleanupTempFiles(...filePaths) {
    for (const filePath of filePaths) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.warn(`Warning: Could not delete temporary file ${filePath}:`, error.message);
        }
    }
}