import forge from 'node-forge';
import { ZATCASimplifiedTaxInvoice } from 'zatca-xml-js';
import crypto from 'crypto';

function generateCert() {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    cert.sign(keys.privateKey);
    return {
        certPem: forge.pki.certificateToPem(cert),
        keyPem: forge.pki.privateKeyToPem(keys.privateKey)
    };
}

const { certPem, keyPem } = generateCert();

const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const ecKeyPem = privateKey.export({ type: 'sec1', format: 'pem' });


const invoice = new ZATCASimplifiedTaxInvoice({
    invoice_xml_str: "<Invoice><cac:Signature/></Invoice>"
});

try {
    const cleanCert = certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s+/g, '').trim();
    const cleanKey = ecKeyPem.replace(/-----BEGIN EC PRIVATE KEY-----/g, '').replace(/-----END EC PRIVATE KEY-----/g, '').replace(/\s+/g, '').trim();
    
    console.log("Calling invoice.sign...");
    invoice.sign(cleanCert, cleanKey);
    console.log("Success!");
} catch(e) {
    console.error("Failed:", e.message);
}
