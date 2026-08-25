const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const { execSync } = require('child_process');

app.whenReady().then(() => {
    try {
        execSync('electron\\\\bin\\\\openssl.exe req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=Test"');
        const cert = fs.readFileSync('cert.pem', 'utf8');
        
        const stripped = cert.replace(/-----BEGIN CERTIFICATE-----/, '').replace(/-----END CERTIFICATE-----/, '').replace(/\s+/g, '');
        const badCert = `-----BEGIN CERTIFICATE-----\n${stripped}\n-----END CERTIFICATE-----`;
        
        const x509 = new crypto.X509Certificate(badCert);
        console.log("ELECTRON_CERT_SUCCESS");
    } catch (e) {
        console.log("ELECTRON_CERT_ERROR:", e.message);
    }
    app.quit();
});
