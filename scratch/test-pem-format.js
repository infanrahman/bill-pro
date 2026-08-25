import crypto from 'crypto';

const keyBase64 = "MHcCAQEEINKt+vJ1L+qM3W+r8v7u8V6M/pYqJ5xJ3tY8K4v8G0mpoAoGCCqGSM49AwEHoUQDQgAEy8A+H8f9K/4/X7X+mY8/w8/Z+qQ6/q8/X7X+mY8/w8/Z+qQ6/q8/X7X+mY8/w8/Z+qQ6/q8/X7X+mY8=";
// This is not a real key, just to see if it throws DECODE_ERROR or something else.
// Let's actually generate a real EC key to be sure.

const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = privateKey.export({ type: 'sec1', format: 'pem' });

// The real PEM has line breaks.
console.log("Original PEM:\n" + pem);

// Try to sign with original PEM
const sign1 = crypto.createSign('sha256');
sign1.update("hello");
console.log("Sign1 success!");

// Now strip line breaks from the base64 part
const strippedBase64 = pem.replace(/-----BEGIN EC PRIVATE KEY-----/, '').replace(/-----END EC PRIVATE KEY-----/, '').replace(/\s+/g, '');
const badPem = `-----BEGIN EC PRIVATE KEY-----\n${strippedBase64}\n-----END EC PRIVATE KEY-----`;

console.log("Bad PEM:\n" + badPem);

try {
    const sign2 = crypto.createSign('sha256');
    sign2.update("hello");
    sign2.sign(badPem);
    console.log("Sign2 success!");
} catch (e) {
    console.error("Sign2 Failed:", e.message);
}
