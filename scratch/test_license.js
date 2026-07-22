const crypto = require('crypto');
const fs = require('fs');

const PUBLIC_KEY = fs.readFileSync('public_key.pem', 'utf8');
const PRIVATE_KEY = fs.readFileSync('license_private_key.pem', 'utf8');

const payloadObj = {
    mid: "test-mid-1234",
    exp: Date.now() + 1000000,
    type: "pro"
};

const payloadStr = JSON.stringify(payloadObj);

// Sign like LicenseManager (but using node crypto)
// Node's equivalent of crypto.subtle.sign({name: "RSA-PSS", saltLength: 32}, privateKey, Buffer.from(payloadStr))
const sign = crypto.createSign('SHA256');
sign.update(Buffer.from(payloadStr));
const signatureBuffer = sign.sign({
    key: PRIVATE_KEY,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32 // crypto.constants.RSA_PSS_SALTLEN_DIGEST
});

const payloadB64 = Buffer.from(payloadStr).toString('base64');
const signatureB64 = signatureBuffer.toString('base64');

const finalKey = `${payloadB64}:${signatureB64}`;

console.log("Generated Key:", finalKey);

// Verify like licenseService.ts
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

console.log("Verification result:", isVerified);
