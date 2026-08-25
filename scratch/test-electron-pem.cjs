const { app } = require('electron');
const crypto = require('crypto');

app.whenReady().then(() => {
    try {
        const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
        const pem = privateKey.export({ type: 'sec1', format: 'pem' });
        
        const strippedBase64 = pem.replace(/-----BEGIN EC PRIVATE KEY-----/, '').replace(/-----END EC PRIVATE KEY-----/, '').replace(/\s+/g, '');
        const badPem = `-----BEGIN EC PRIVATE KEY-----\n${strippedBase64}\n-----END EC PRIVATE KEY-----`;
        
        const sign = crypto.createSign('sha256');
        sign.update("hello");
        sign.sign(badPem);
        console.log("ELECTRON_SIGN_SUCCESS");
    } catch (e) {
        console.log("ELECTRON_SIGN_ERROR:", e.message);
    }
    app.quit();
});
