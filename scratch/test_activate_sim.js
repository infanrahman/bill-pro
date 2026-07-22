const fs = require('fs');
const crypto = require('crypto');
const { webcrypto } = require('crypto');

async function test() {
    const PUBLIC_KEY = fs.readFileSync('public_key.pem', 'utf8');
    const privatePem = fs.readFileSync('license_private_key.pem', 'utf8');

    // Simulate currentMachineId
    const currentMachineId = 'test-mid-123';

    // Simulate LicenseManager.html generateKey
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
        mid: currentMachineId,
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

    // Simulate what happens when copied via textContent/innerText
    const finalKey = `${payloadB64}:${signatureB64}`;
    console.log("finalKey:", finalKey);

    // --- Simulate App Validation ---
    const cleanKey = (finalKey || '').trim();
    const parts = cleanKey.split(':');
    if (parts.length !== 2) {
        console.log("Failed split");
        return;
    }

    const recPayloadB64 = parts[0];
    const recSignatureB64 = parts[1];
    const recPayloadStr = Buffer.from(recPayloadB64, 'base64').toString('utf8');
    const recSignature = Buffer.from(recSignatureB64, 'base64');

    const isVerified = crypto.verify(
        "sha256",
        Buffer.from(recPayloadStr),
        {
            key: PUBLIC_KEY,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
        },
        recSignature
    );

    console.log("Is verified:", isVerified);
    if (!isVerified) return;

    const payload = JSON.parse(recPayloadStr);
    if (!payload || payload.mid !== currentMachineId) {
        console.log("MID mismatch");
        return;
    }

    console.log("Activation successful!");
}

test().catch(console.error);
