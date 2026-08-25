const { app } = require('electron');
const crypto = require('crypto');

app.whenReady().then(() => {
    try {
        const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
        let pem = privateKey.export({ type: 'sec1', format: 'pem' });
        
        const lines = pem.split('\n');
        lines[1] = lines[1].replace('A', 'B'); // corrupt base64
        const badPem = lines.join('\n');
        
        const sign = crypto.createSign('sha256');
        sign.update("hello");
        sign.sign(badPem);
        console.log("SUCCESS");
    } catch (e) {
        console.log("KEY_ERROR:", e.message);
    }
    app.quit();
});
