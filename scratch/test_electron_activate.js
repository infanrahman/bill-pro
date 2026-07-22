const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
    try {
        const { LicenseService } = require('../dist-electron/services/licenseService.js');
        const ls = new LicenseService();
        console.log("Machine ID:", ls.currentMachineId);

        const { webcrypto } = require('crypto');
        const privatePem = fs.readFileSync('license_private_key.pem', 'utf8');

        const b64 = privatePem
            .replace(/-----BEGIN PRIVATE KEY-----/g, "")
            .replace(/-----END PRIVATE KEY-----/g, "")
            .replace(/\s/g, "");

        const binary_string = atob(b64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        const binaryDer = bytes.buffer;

        const loadedPrivateKey = await webcrypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            { name: "RSA-PSS", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const payloadObj = {
            mid: ls.currentMachineId,
            exp: Date.now() + 10000000,
            type: "pro"
        };
        const payloadStr = JSON.stringify(payloadObj);
        const data = new TextEncoder().encode(payloadStr);

        const signatureBuffer = await webcrypto.subtle.sign(
            { name: "RSA-PSS", saltLength: 32 },
            loadedPrivateKey,
            data
        );

        const payloadB64 = btoa(unescape(encodeURIComponent(payloadStr)));
        let binary = '';
        const bytes2 = new Uint8Array(signatureBuffer);
        for (let i = 0; i < bytes2.byteLength; i++) {
            binary += String.fromCharCode(bytes2[i]);
        }
        const signatureB64 = btoa(binary);

        const finalKey = `${payloadB64}:${signatureB64}`;
        console.log("Generated Key:", finalKey);

        const result = ls.activate(finalKey);
        console.log("Activation result:", result);
    } catch (err) {
        console.error(err);
    }
    app.quit();
});
