const { app } = require('electron');
const crypto = require('crypto');

app.whenReady().then(() => {
    try {
        const badCert = `-----BEGIN CERTIFICATE-----\nInvalidBase64Characters!@#$%\n-----END CERTIFICATE-----`;
        const x509 = new crypto.X509Certificate(badCert);
        console.log("SUCCESS");
    } catch (e) {
        console.log("CERT_ERROR:", e.message);
    }
    
    try {
        const badKey = `-----BEGIN EC PRIVATE KEY-----\nInvalidBase64Characters!@#$%\n-----END EC PRIVATE KEY-----`;
        const sign = crypto.createSign('sha256');
        sign.update("hello");
        sign.sign(badKey);
        console.log("SUCCESS");
    } catch (e) {
        console.log("KEY_ERROR:", e.message);
    }
    app.quit();
});
