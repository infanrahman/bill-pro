const fs = require('fs');
const { webcrypto } = require('crypto');
const crypto = require('crypto');

async function test() {
    const PUBLIC_KEY = fs.readFileSync('public_key.pem', 'utf8');
    const privatePem = fs.readFileSync('license_private_key.pem', 'utf8');

    // Simulate LicenseManager.html importPrivateKey
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
        mid: "test-mid",
        exp: Date.now() + 100000,
        type: "pro"
    };
    const payloadStr = JSON.stringify(payloadObj);

    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr);

    // Sign using RSA-PSS
    const signatureBuffer = await webcrypto.subtle.sign(
        {
            name: "RSA-PSS",
            saltLength: 32,
        },
        loadedPrivateKey,
        data
    );

    // Format: Base64(Payload):Base64(Signature)
    const payloadB64 = btoa(unescape(encodeURIComponent(payloadStr)));
    
    // arrayBufferToBase64
    let binary = '';
    const bytes2 = new Uint8Array(signatureBuffer);
    const len2 = bytes2.byteLength;
    for (let i = 0; i < len2; i++) {
        binary += String.fromCharCode(bytes2[i]);
    }
    const signatureB64 = btoa(binary);

    const finalKey = `${payloadB64}:${signatureB64}`;
    console.log("WebCrypto Generated Key:", finalKey);

    // Now verify in node
    const parts = finalKey.split(':');
    const parsedPayloadStr = Buffer.from(parts[0], 'base64').toString('utf8');
    const parsedSignature = Buffer.from(parts[1], 'base64');

    const isVerified = crypto.verify(
        "sha256",
        Buffer.from(parsedPayloadStr),
        {
            key: PUBLIC_KEY,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
        },
        parsedSignature
    );

    console.log("Is verified:", isVerified);
}

test().catch(console.error);
