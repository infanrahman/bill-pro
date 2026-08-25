/**
 * ZATCA Private-Key & Certificate Automated Tests
 *
 * Run with:
 *   node electron/services/zatcaService.test.js
 *
 * No test framework required — uses Node.js built-in assert and crypto.
 *
 * Tests:
 *   A. Valid EC P-256 SEC1 private key loads successfully.
 *   B. Valid PKCS#8 EC private key loads successfully and is converted to SEC1.
 *   C. Corrupted PEM fails with ZATCA_PRIVATE_KEY_INVALID.
 *   D. Key/certificate mismatch is detected (ZATCA_KEY_CERTIFICATE_MISMATCH).
 *   E. Correct key/certificate pair passes validation.
 *   F. Signing a test payload works and verifies correctly.
 *   G. PEM with \\n escaped newlines is normalized correctly.
 *   H. PEM with CRLF line endings is normalized correctly.
 *   I. Non-EC (RSA) key is rejected with ZATCA_PRIVATE_KEY_INVALID.
 *   J. Empty private key is rejected.
 */

'use strict';

const crypto = require('crypto');
const assert = require('assert');
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Portable stubs of ZatcaService static helpers (for tests without Electron)
// ---------------------------------------------------------------------------

function normalisePemNewlines(pem) {
    let result = pem.replace(/\\n/g, '\n');
    result = result.replace(/\r\n/g, '\n');
    return result.trim();
}

function validatePrivateKey(keyPem) {
    let keyObj;
    try {
        keyObj = crypto.createPrivateKey({ key: keyPem, format: 'pem' });
    } catch (e) {
        const err = new Error(`ZATCA_PRIVATE_KEY_INVALID: ${e.message}`);
        err.code = 'ZATCA_PRIVATE_KEY_INVALID';
        throw err;
    }
    if (keyObj.asymmetricKeyType !== 'ec') {
        const err = new Error(`ZATCA_PRIVATE_KEY_INVALID: Key type is "${keyObj.asymmetricKeyType}", expected "ec".`);
        err.code = 'ZATCA_PRIVATE_KEY_INVALID';
        throw err;
    }
    return keyObj;
}

function validateCertificate(certPemOrBase64) {
    let derBytes;
    const hasBeginCert = typeof certPemOrBase64 === 'string' && certPemOrBase64.includes('BEGIN CERTIFICATE');
    
    try {
        if (hasBeginCert) {
            let base64Body = certPemOrBase64.replace(/\\n/g, '\n');
            base64Body = base64Body
                .replace(/-----BEGIN CERTIFICATE-----/g, '')
                .replace(/-----END CERTIFICATE-----/g, '')
                .replace(/\s+/g, '')
                .trim();
            derBytes = Buffer.from(base64Body, 'base64');
        } else {
            const cleanBase64 = certPemOrBase64.replace(/\s+/g, '').trim();
            derBytes = Buffer.from(cleanBase64, 'base64');
        }
        
        let cert;
        try {
            cert = new crypto.X509Certificate(derBytes);
        } catch (e) {
            const b64 = derBytes.toString('base64');
            const pemLines = b64.match(/.{1,64}/g) || [];
            const pemStr = `-----BEGIN CERTIFICATE-----\n${pemLines.join('\n')}\n-----END CERTIFICATE-----`;
            cert = new crypto.X509Certificate(pemStr);
        }
        
        if (!cert.publicKey) throw new Error('Certificate has no public key.');
        if (cert.publicKey.asymmetricKeyType !== 'ec') throw new Error(`Certificate public key is ${cert.publicKey.asymmetricKeyType}, expected ec.`);
        return cert;
    } catch (e) {
        const err = new Error(`ZATCA_CERTIFICATE_INVALID: ${e.message}`);
        err.code = 'ZATCA_CERTIFICATE_INVALID';
        throw err;
    }
}

function verifyCertificateKeyMatch(keyObj, cert) {
    const pubKeyFromPriv = crypto.createPublicKey(keyObj);
    const pubKeyDerFromPriv = pubKeyFromPriv.export({ type: 'spki', format: 'der' });
    const certPubKeyDer = cert.publicKey.export({ type: 'spki', format: 'der' });
    if (!pubKeyDerFromPriv.equals(certPubKeyDer)) {
        const err = new Error('ZATCA_KEY_CERTIFICATE_MISMATCH: The private key does not match the certificate.');
        err.code = 'ZATCA_KEY_CERTIFICATE_MISMATCH';
        throw err;
    }
}

function normaliseToSec1Base64(keyPem) {
    const isPkcs8Generic = keyPem.includes('BEGIN PRIVATE KEY') && !keyPem.includes('BEGIN EC PRIVATE KEY');
    const isSec1Ec = keyPem.includes('BEGIN EC PRIVATE KEY');

    if (isPkcs8Generic) {
        const keyObj = validatePrivateKey(keyPem);
        const sec1Der = keyObj.export({ type: 'sec1', format: 'der' });
        return sec1Der.toString('base64');
    }

    if (isSec1Ec) {
        return keyPem
            .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
            .replace(/-----END EC PRIVATE KEY-----/g, '')
            .replace(/\s+/g, '')
            .trim();
    }

    return keyPem
        .replace(/-----BEGIN [A-Z ]+-----/g, '')
        .replace(/-----END [A-Z ]+-----/g, '')
        .replace(/\s+/g, '')
        .trim();
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  PASS: ${name}`);
        passed++;
    } catch (e) {
        console.error(`  FAIL: ${name}`);
        console.error(`       ${e.message}`);
        failed++;
    }
}

// ---------------------------------------------------------------------------
// Generate fresh test key pairs (P-256 EC + RSA)
// ---------------------------------------------------------------------------

const { privateKey: testPrivKeyObj1 } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const { privateKey: testPrivKeyObj2 } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const { privateKey: testRsaPrivKeyObj } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

const testSec1Pem1  = testPrivKeyObj1.export({ type: 'sec1',  format: 'pem' });
const testPkcs8Pem1 = testPrivKeyObj1.export({ type: 'pkcs8', format: 'pem' });
const testSec1Pem2  = testPrivKeyObj2.export({ type: 'sec1',  format: 'pem' });
const testRsaPem    = testRsaPrivKeyObj.export({ type: 'pkcs8', format: 'pem' });

// ---------------------------------------------------------------------------
// Tests that do not require a certificate
// ---------------------------------------------------------------------------

console.log('\n=== ZATCA Cryptographic Unit Tests ===\n');

// A. Valid EC P-256 SEC1 private key loads successfully
test('A. Valid SEC1 EC P-256 private key loads successfully', () => {
    const keyObj = validatePrivateKey(testSec1Pem1);
    assert.strictEqual(keyObj.asymmetricKeyType, 'ec');
});

// B. Valid PKCS#8 EC private key loads and converts to SEC1 base64
test('B. PKCS#8 EC private key converts to valid SEC1 base64', () => {
    const b64 = normaliseToSec1Base64(testPkcs8Pem1);
    assert.ok(b64.length > 0);
    const der = Buffer.from(b64, 'base64');
    const roundTripped = crypto.createPrivateKey({ key: der, format: 'der', type: 'sec1' });
    assert.strictEqual(roundTripped.asymmetricKeyType, 'ec');
});

// C. Corrupted PEM fails with ZATCA_PRIVATE_KEY_INVALID
test('C. Corrupted PEM throws ZATCA_PRIVATE_KEY_INVALID', () => {
    const lines = testSec1Pem1.split('\n');
    lines[1] = '!' + lines[1].slice(1); // corrupt first base64 char
    const corruptedPem = lines.join('\n');
    let threw = false;
    try {
        validatePrivateKey(corruptedPem);
    } catch (e) {
        threw = true;
        assert.strictEqual(e.code, 'ZATCA_PRIVATE_KEY_INVALID');
    }
    assert.ok(threw, 'Must throw for corrupted PEM');
});

// G. PEM with JSON-escaped newlines (\\n) is normalized correctly
test('G. JSON-escaped \\\\n newlines are normalized correctly', () => {
    const jsonEscaped = testSec1Pem1.replace(/\n/g, '\\n');
    assert.ok(jsonEscaped.includes('\\n'), 'setup: must contain escaped newlines');
    const normalized = normalisePemNewlines(jsonEscaped);
    const keyObj = validatePrivateKey(normalized);
    assert.strictEqual(keyObj.asymmetricKeyType, 'ec');
});

// H. PEM with CRLF line endings is normalized correctly
test('H. CRLF (\\r\\n) line endings are normalized correctly', () => {
    const crlfPem = testSec1Pem1.replace(/\n/g, '\r\n');
    const normalized = normalisePemNewlines(crlfPem);
    assert.ok(!normalized.includes('\r'), 'Must not contain \\r after normalization');
    const keyObj = validatePrivateKey(normalized);
    assert.strictEqual(keyObj.asymmetricKeyType, 'ec');
});

// I. Non-EC (RSA) key is rejected
test('I. Non-EC (RSA) key is rejected with ZATCA_PRIVATE_KEY_INVALID', () => {
    let threw = false;
    try {
        validatePrivateKey(testRsaPem);
    } catch (e) {
        threw = true;
        assert.strictEqual(e.code, 'ZATCA_PRIVATE_KEY_INVALID');
        assert.ok(e.message.toLowerCase().includes('rsa'));
    }
    assert.ok(threw, 'Must throw for RSA key');
});

// J. Empty key is rejected
test('J. Empty private key string is rejected', () => {
    let threw = false;
    try {
        validatePrivateKey('');
    } catch (e) {
        threw = true;
        assert.strictEqual(e.code, 'ZATCA_PRIVATE_KEY_INVALID');
    }
    assert.ok(threw, 'Must throw for empty string');
});

// SEC1 normalisation produces clean base64
test('B2. SEC1 PEM -> normaliseToSec1Base64 produces clean base64 (no headers/newlines)', () => {
    const b64 = normaliseToSec1Base64(testSec1Pem1);
    assert.ok(!b64.includes('BEGIN'));
    assert.ok(!b64.includes('\n'));
    assert.ok(/^[A-Za-z0-9+/]+=*$/.test(b64), 'Must be valid base64');
});

// PKCS#8 SEC1 round-trip
test('B3. PKCS#8 PEM -> normaliseToSec1Base64 -> SEC1 DER parses back correctly', () => {
    const b64 = normaliseToSec1Base64(testPkcs8Pem1);
    const der = Buffer.from(b64, 'base64');
    const keyObj = crypto.createPrivateKey({ key: der, format: 'der', type: 'sec1' });
    assert.strictEqual(keyObj.asymmetricKeyType, 'ec');
});

// ---------------------------------------------------------------------------
// Certificate-dependent tests (require openssl in PATH)
// ---------------------------------------------------------------------------

function findOpenSslBin() {
    // Try 'openssl' in PATH first, then known Windows locations.
    const candidates = [
        'openssl',
        'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
        'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
        'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
    ];
    for (const bin of candidates) {
        try {
            // Quote the path to handle spaces (execSync on Windows needs this)
            execSync(`"${bin}" version`, { stdio: 'pipe', timeout: 5000, shell: true });
            return bin;
        } catch { /* try next */ }
    }
    return null;
}

function tryGenerateSelfSignedCert(privKeyPem, label) {
    const opensslBin = findOpenSslBin();
    if (!opensslBin) return null;
    try {
        const tmpDir = os.tmpdir();
        const keyFile  = path.join(tmpDir, `zatca_test_key_${label}_${Date.now()}.pem`);
        const certFile = path.join(tmpDir, `zatca_test_cert_${label}_${Date.now()}.pem`);
        fs.writeFileSync(keyFile, privKeyPem);
        execSync(
            `"${opensslBin}" req -new -x509 -key "${keyFile}" -out "${certFile}" -days 1 -subj "/CN=TestCert/C=SA/O=Test"`,
            { stdio: 'pipe', timeout: 10000, shell: true }
        );
        const certPem = fs.readFileSync(certFile, 'utf8');
        try { fs.unlinkSync(keyFile);  } catch { /* ignore */ }
        try { fs.unlinkSync(certFile); } catch { /* ignore */ }
        return certPem;
    } catch {
        return null;
    }
}

const cert1Pem = tryGenerateSelfSignedCert(testSec1Pem1, 'k1');
const cert2Pem = tryGenerateSelfSignedCert(testSec1Pem2, 'k2');

if (cert1Pem) {
    console.log('\n  [OpenSSL available - running certificate tests]\n');

    // B4. Valid certificate loads
    test('B4. Valid self-signed certificate loads successfully', () => {
        const cert = validateCertificate(cert1Pem);
        assert.ok(cert.subject.length > 0);
    });

    // E. Matching key/cert passes
    test('E. Matching key and certificate pass verifyCertificateKeyMatch', () => {
        const keyObj = validatePrivateKey(testSec1Pem1);
        const cert   = validateCertificate(cert1Pem);
        verifyCertificateKeyMatch(keyObj, cert); // must not throw
    });

    // D. Mismatch is detected
    test('D. Mismatched key/certificate throws ZATCA_KEY_CERTIFICATE_MISMATCH', () => {
        const keyObj = validatePrivateKey(testSec1Pem2); // different key
        const cert   = validateCertificate(cert1Pem);    // cert from key1
        let threw = false;
        try {
            verifyCertificateKeyMatch(keyObj, cert);
        } catch (e) {
            threw = true;
            assert.strictEqual(e.code, 'ZATCA_KEY_CERTIFICATE_MISMATCH');
        }
        assert.ok(threw, 'Must throw ZATCA_KEY_CERTIFICATE_MISMATCH for mismatched pair');
    });

    // F. Sign test payload and verify with cert public key
    test('F. Sign test payload with private key, verify with certificate public key', () => {
        const keyObj  = validatePrivateKey(testSec1Pem1);
        const cert    = validateCertificate(cert1Pem);
        const payload = Buffer.from('ZATCA-SIGNING-SELF-TEST');

        const signer = crypto.createSign('SHA256');
        signer.update(payload);
        const signature = signer.sign(keyObj);

        const verifier = crypto.createVerify('SHA256');
        verifier.update(payload);
        const valid = verifier.verify(cert.publicKey, signature);
        assert.strictEqual(valid, true);
    });

    // Raw base64 certificate (no PEM headers)
    test('B5. Raw base64 certificate (no PEM headers) loads via validateCertificate', () => {
        const rawB64 = cert1Pem
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/\s+/g, '');
        const cert = validateCertificate(rawB64);
        assert.ok(cert.subject.length > 0);
    });

} else {
    console.warn('\n  [openssl not in PATH - skipping certificate-dependent tests D, E, F, B4, B5]\n');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
    process.exit(1);
}
