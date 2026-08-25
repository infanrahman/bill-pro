const { app } = require('electron');
const crypto = require('crypto');
const forge = require('node-forge');

app.whenReady().then(async () => {
    try {
        const { ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');
        
        // Generate RSA cert for testing (ZATCA uses EC, but the parser might not care until signing)
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
        cert.sign(keys.privateKey);
        const certPem = forge.pki.certificateToPem(cert);
        
        // Generate EC private key
        const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
        const ecKeyPem = privateKey.export({ type: 'sec1', format: 'pem' });
        
        // Clean them like zatcaService.ts does
        const cleanCert = certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s+/g, '').trim();
        const cleanKey = ecKeyPem.replace(/-----BEGIN EC PRIVATE KEY-----/g, '').replace(/-----END EC PRIVATE KEY-----/g, '').replace(/\s+/g, '').trim();
        
        const invoice = new ZATCASimplifiedTaxInvoice({
            invoice_xml_str: "<Invoice><cac:Signature/></Invoice>"
        });
        
        console.log("Calling invoice.sign...");
        invoice.sign(cleanCert, cleanKey);
        console.log("ELECTRON_ZATCA_XML_JS_SUCCESS");
    } catch (e) {
        console.log("ELECTRON_ZATCA_XML_JS_ERROR:", e.message);
    }
    app.quit();
});
