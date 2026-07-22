const { LicenseService } = require('./dist-electron/services/licenseService.js');
const fs = require('fs');
const { webcrypto } = require('crypto');

async function test() {
    const ls = new LicenseService();
    console.log("Current Machine ID:", ls.currentMachineId);

    // Generate a key using the exact JS logic from LicenseManager.html
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
        {
            name: "RSA-PSS",
            hash: "SHA-256",
        },
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
        {
            name: "RSA-PSS",
            saltLength: 32,
        },
        loadedPrivateKey,
        data
    );

    const payloadB64 = btoa(unescape(encodeURIComponent(payloadStr)));
    
    let binary = '';
    const bytes2 = new Uint8Array(signatureBuffer);
    const len2 = bytes2.byteLength;
    for (let i = 0; i < len2; i++) {
        binary += String.fromCharCode(bytes2[i]);
    }
    const signatureB64 = btoa(binary);

    const finalKey = `${payloadB64}:${signatureB64}`;
    
    console.log("Generated Key:", finalKey);
    console.log("Activating...");
    const result = ls.activate(finalKey);
    console.log("Activation result:", result);
}

test().catch(console.error);
