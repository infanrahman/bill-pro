const { app } = require('electron');
const crypto = require('crypto');
const forge = require('node-forge');

app.whenReady().then(() => {
    try {
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
        cert.sign(keys.privateKey);
        const certPem = forge.pki.certificateToPem(cert);
        
        const stripped = certPem.replace(/-----BEGIN CERTIFICATE-----/, '').replace(/-----END CERTIFICATE-----/, '').replace(/\s+/g, '');
        const badCert = `-----BEGIN CERTIFICATE-----\n${stripped}\n-----END CERTIFICATE-----`;
        
        const x509 = new crypto.X509Certificate(badCert);
        console.log("ELECTRON_CERT_SUCCESS");
    } catch (e) {
        console.log("ELECTRON_CERT_ERROR:", e.message);
    }
    app.quit();
});
