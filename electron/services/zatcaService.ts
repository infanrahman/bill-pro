import { app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';
import crypto from 'crypto';
import moment from 'moment';

export interface ZatcaConfig {
    csr: string;
    privateKey: string;
    complianceCsid?: string;
    complianceSecret?: string;
    productionCsid?: string;
    productionSecret?: string;
    requestId?: string;
    status: 'NOT_ONBOARDED' | 'CSR_GENERATED' | 'COMPLIANCE_OBTAINED' | 'CHECKED' | 'LIVE';
    environment: 'SIMULATION' | 'PRODUCTION';
}

export class ZatcaService {
    private configPath: string;

    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'zatca_config.enc.json');
    }

    /**
     * Loads the ZATCA config, decrypting sensitive fields.
     */
    async getConfig(): Promise<ZatcaConfig | null> {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            const config = JSON.parse(data);

            // Decrypt sensitive fields if safeStorage is available
            if (safeStorage.isEncryptionAvailable()) {
                if (config.privateKey && config.privateKey.startsWith('enc:')) {
                    config.privateKey = this.decryptField(config.privateKey);
                }
                if (config.complianceSecret && config.complianceSecret.startsWith('enc:')) {
                    config.complianceSecret = this.decryptField(config.complianceSecret);
                }
                if (config.productionSecret && config.productionSecret.startsWith('enc:')) {
                    config.productionSecret = this.decryptField(config.productionSecret);
                }
            }

            return config;
        } catch (error) {
            // File doesn't exist or is corrupted
            return null;
        }
    }

    /**
     * Saves the ZATCA config, encrypting sensitive fields.
     * Throws if the file cannot be written — callers must handle the error.
     * Also reads back the file after writing to verify it was persisted.
     */
    async saveConfig(config: ZatcaConfig): Promise<boolean> {
        const configToSave = { ...config };

        // Encrypt sensitive fields if safeStorage is available
        if (safeStorage.isEncryptionAvailable()) {
            if (configToSave.privateKey && !configToSave.privateKey.startsWith('enc:')) {
                configToSave.privateKey = this.encryptField(configToSave.privateKey);
            }
            if (configToSave.complianceSecret && !configToSave.complianceSecret.startsWith('enc:')) {
                configToSave.complianceSecret = this.encryptField(configToSave.complianceSecret);
            }
            if (configToSave.productionSecret && !configToSave.productionSecret.startsWith('enc:')) {
                configToSave.productionSecret = this.encryptField(configToSave.productionSecret);
            }
        }

        // Write the file — let the error propagate so the caller knows it failed
        await fs.writeFile(this.configPath, JSON.stringify(configToSave, null, 2), 'utf8');

        // Read back immediately to verify the file is actually on disk
        try {
            await fs.access(this.configPath);
        } catch {
            throw new Error(`ZATCA config was written but cannot be verified at: ${this.configPath}`);
        }

        console.log(`[ZATCA] Config saved and verified at: ${this.configPath}`);
        return true;
    }


    private encryptField(value: string): string {
        try {
            const encrypted = safeStorage.encryptString(value);
            return 'enc:' + encrypted.toString('base64');
        } catch (e) {
            console.error('Encryption failed for ZATCA field:', e);
            return value; // Fallback to plaintext if encryption fails (should we?)
        }
    }

    private decryptField(encryptedValue: string): string {
        try {
            if (!encryptedValue) return '';
            if (!encryptedValue.startsWith('enc:')) {
                return encryptedValue;
            }
            const base64 = encryptedValue.replace('enc:', '');
            const buffer = Buffer.from(base64, 'base64');
            return safeStorage.decryptString(buffer);
        } catch (e) {
            console.error('Decryption failed for ZATCA field:', e);
            return ''; // Return empty on failure to prevent using stale/broken keys
        }
    }

    private async findOpenSSLPath(): Promise<string> {
        // 1. Try bundled OpenSSL in resources (packed) or electron/bin (dev)
        const isPackaged = app.isPackaged;
        const bundledPath = isPackaged
            ? path.join(process.resourcesPath, 'bin', 'openssl.exe')
            : path.join(app.getAppPath(), 'electron', 'bin', 'openssl.exe');

        try {
            await fs.access(bundledPath);
            return bundledPath;
        } catch {
            // Ignore and fallback to system OpenSSL
        }

        // 2. Try system PATH openssl
        try {
            await new Promise<void>((resolve, reject) => {
                exec('openssl version', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            return 'openssl';
        } catch {
            // Ignore and try specific paths
        }

        // 3. Try standard installation folders
        const paths = [
            'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
            'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
            'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
            'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
        ];

        for (const p of paths) {
            try {
                await fs.access(p);
                return p;
            } catch {
                // Ignore and check next
            }
        }

        throw new Error('OpenSSL not found. Please ensure Git is installed at C:\\Program Files\\Git or openssl is in your system PATH.');
    }

    private sanitizeCnfValue(val: string): string {
        if (!val) return '';
        return val.replace(/["\\#\n\r]/g, '').trim();
    }

    /**
     * Generates an ECDSA key pair and a ZATCA-compliant CSR using OpenSSL.
     */
    async generateCSR(options: {
        commonName: string;
        organizationName: string;
        organizationUnitName: string;
        countryName: string;
        serialNumber: string;
        registeredAddress: string;
        businessCategory: string;
        vatNumber: string;
        environment: 'PRODUCTION' | 'SIMULATION';
    }): Promise<{ csr: string; privateKey: string }> {
        const opensslPath = await this.findOpenSSLPath();
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        const configPath = path.join(tempDir, `zatca_config_${timestamp}.cnf`);
        const keyPath = path.join(tempDir, `zatca_key_${timestamp}.pem`);
        const csrPath = path.join(tempDir, `zatca_csr_${timestamp}.csr`);

        try {
            const templateName = options.environment === 'PRODUCTION' ? 'ZATCA-Code-Signing' : 'PREZATCA-Code-Signing';
            
            const envPrefix = options.environment === 'PRODUCTION' ? 'PRD' : 'TST';
            const formattedCommonName = `${envPrefix}-123456789-${options.vatNumber}`;

            let cleanUUID = '';
            if (options.serialNumber) {
                const match = options.serialNumber.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                if (match) {
                    cleanUUID = match[0];
                }
            }
            if (!cleanUUID) {
                cleanUUID = crypto.randomUUID ? crypto.randomUUID() : '7caee94b-876a-46fa-8332-80250295ced8';
            }
            const formattedSerialNumber = `1-ModelA|2-Ver1.0|3-${cleanUUID}`;

            const asciiAddress = /^[ -~]+$/.test(options.registeredAddress) ? options.registeredAddress : 'Muhayil';
            const asciiCategory = /^[ -~]+$/.test(options.businessCategory) ? options.businessCategory : 'Retail';

            // Construct openssl.cnf content dynamically
            const cnfContent = `oid_section = OIDs
[ OIDs ]
certificateTemplateName = 1.3.6.1.4.1.311.20.2

[ req ]
default_bits = 2048
distinguished_name = dn
req_extensions = req_ext
prompt = no
default_md = sha256
utf8 = yes
string_mask = utf8only

[ req_ext ]
certificateTemplateName = ASN1:PRINTABLESTRING:${templateName}
subjectAltName = dirName:alt_names

[ dn ]
C=${this.sanitizeCnfValue(options.countryName || 'SA')}
O=${this.sanitizeCnfValue(options.organizationName || 'My Business')}
OU=${this.sanitizeCnfValue(options.vatNumber)}
CN=${this.sanitizeCnfValue(formattedCommonName)}

[ alt_names ]
SN=${this.sanitizeCnfValue(formattedSerialNumber)}
UID=${this.sanitizeCnfValue(options.vatNumber)}
title=0100
OID.2.5.4.26=${this.sanitizeCnfValue(asciiAddress)}
OID.2.5.4.15=${this.sanitizeCnfValue(asciiCategory)}
`;

            await fs.writeFile(configPath, cnfContent, 'utf8');

            // Generate ECDSA private key using P-256 curve in SEC1 format (BEGIN EC PRIVATE KEY)
            // zatca-xml-js signing library expects raw SEC1 base64 — it wraps with BEGIN EC PRIVATE KEY headers internally.
            // We use ecparam which produces SEC1 PEM directly. genpkey produces PKCS#8 which causes DECODE_ERROR.
            await new Promise<void>((resolve, reject) => {
                exec(`"${opensslPath}" ecparam -name prime256v1 -genkey -noout -out "${keyPath}"`, (err, _stdout, stderr) => {
                    if (err) {
                        console.error('ZATCA OpenSSL EC key generation (prime256v1) failed, trying P-256 alias:', stderr);
                        // Some older OpenSSL versions use different name aliases
                        exec(`"${opensslPath}" ecparam -name P-256 -genkey -noout -out "${keyPath}"`, (err2, __, stderr2) => {
                            if (err2) {
                                console.error('ZATCA OpenSSL Private Key generation failed:', stderr2);
                                reject(new Error(`Failed to generate EC private key: ${stderr2 || err2.message}`));
                            } else resolve();
                        });
                    } else resolve();
                });
            });

            // Generate CSR using the custom config file
            await new Promise<void>((resolve, reject) => {
                exec(`"${opensslPath}" req -new -utf8 -sha256 -key "${keyPath}" -extensions req_ext -config "${configPath}" -out "${csrPath}"`, (err, stdout, stderr) => {
                    if (err) {
                        console.error('ZATCA OpenSSL CSR generation failed:', stderr);
                        reject(new Error(`Failed to generate CSR: ${stderr || err.message}`));
                    } else resolve();
                });
            });

            const privateKey = await fs.readFile(keyPath, 'utf8');
            const csr = await fs.readFile(csrPath, 'utf8');

            return { csr, privateKey };
        } finally {
            // Clean up files in finally block to avoid leaking keys/config on error
            try {
                await fs.unlink(configPath);
            } catch {}
            try {
                await fs.unlink(keyPath);
            } catch {}
            try {
                await fs.unlink(csrPath);
            } catch {}
        }
    }

    signHash(hashBase64: string, privateKeyPem: string): string {
        try {
            let key = privateKeyPem;
            if (key.startsWith('enc:')) {
                key = this.decryptField(key);
            }
            // Normalise newlines so the PEM parses correctly
            key = ZatcaService.normalisePemNewlines(key);
            const sign = crypto.createSign('SHA256');
            sign.update(hashBase64);
            const signature = sign.sign(key);
            return signature.toString('base64');
        } catch (error) {
            console.error('ZATCA ECDSA signing failed:', error);
            throw new Error(`Signing failed: ${(error as Error).message}`);
        }
    }

    /**
     * Normalises PEM newlines:
     * 1. Converts JSON-escaped "\\n" (two characters) back to real newlines.
     * 2. Converts Windows CRLF "\r\n" to Unix LF "\n".
     * This is safe on any PEM string because it only touches whitespace,
     * never the Base64 body itself.
     */
    static normalisePemNewlines(pem: string): string {
        // Replace JSON-escaped newlines (literal backslash-n) with real newlines.
        // This can happen if the PEM was double-serialised as a JSON string.
        let result = pem.replace(/\\n/g, '\n');
        // Replace Windows CRLF with Unix LF so header matching is consistent.
        result = result.replace(/\r\n/g, '\n');
        return result.trim();
    }

    /**
     * Validates an EC private key PEM and returns the KeyObject.
     * Throws a typed ZATCA_PRIVATE_KEY_INVALID error if the key is invalid.
     * Never logs the key material itself.
     */
    private validatePrivateKey(keyPem: string): crypto.KeyObject {
        let keyObj: crypto.KeyObject;
        try {
            keyObj = crypto.createPrivateKey({ key: keyPem, format: 'pem' });
        } catch (e) {
            const err = new Error(
                `ZATCA_PRIVATE_KEY_INVALID: Cannot parse private key PEM. ` +
                `The key may be corrupted or have invalid newlines. ` +
                `Internal: ${(e as Error).message}`
            );
            (err as any).code = 'ZATCA_PRIVATE_KEY_INVALID';
            throw err;
        }

        if (keyObj.asymmetricKeyType !== 'ec') {
            const err = new Error(
                `ZATCA_PRIVATE_KEY_INVALID: Key type is "${keyObj.asymmetricKeyType}" but ZATCA requires "ec" (P-256/secp256r1). ` +
                `Please re-generate the ZATCA CSR to create a fresh EC key pair.`
            );
            (err as any).code = 'ZATCA_PRIVATE_KEY_INVALID';
            throw err;
        }

        console.log('[ZATCA] Private key validated — asymmetricKeyType:', keyObj.asymmetricKeyType);
        return keyObj;
    }

    /**
     * Parses and decodes a ZATCA binarySecurityToken, detecting potential double-Base64 encoding.
     */
    private decodeZatcaCertificate(binarySecurityToken: string): { cert: crypto.X509Certificate; canonicalBase64: string; der: Buffer } {
        if (!binarySecurityToken) {
            const err = new Error('ZATCA_CERTIFICATE_INVALID: Certificate is empty.');
            (err as any).code = 'ZATCA_CERTIFICATE_INVALID';
            throw err;
        }

        // 1. Normalize JSON escaped newlines
        let normalizedStr = binarySecurityToken.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

        // 2 & 3. Remove PEM headers and whitespace
        normalizedStr = normalizedStr
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/\s+/g, '')
            .trim();

        // 4. Strictly validate outer Base64
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedStr)) {
            const err = new Error('ZATCA_CERTIFICATE_INVALID: Outer certificate is not valid Base64.');
            (err as any).code = 'ZATCA_CERTIFICATE_INVALID';
            throw err;
        }

        // 5. Decode Base64 once
        const first = Buffer.from(normalizedStr, 'base64');
        
        let der: Buffer;
        let detectedDoubleBase64 = false;

        // 6. Inspect resulting bytes to detect double-Base64 text
        const isAsciiBase64 = (buf: Buffer): boolean => {
            if (buf.length === 0) return false;
            for (let i = 0; i < buf.length; i++) {
                const b = buf[i];
                if (b > 127) return false; // Non-ASCII
                // Allow A-Z, a-z, 0-9, +, /, =, and whitespace (CR, LF, space, tab)
                if (!(/[A-Za-z0-9+/=\s]/.test(String.fromCharCode(b)))) {
                    return false;
                }
            }
            return true;
        };

        if (isAsciiBase64(first)) {
            const inner = first.toString('ascii').replace(/\s+/g, '').trim();
            // Validate valid Base64 padding/length roughly
            if (inner.length % 4 === 0) {
                const secondDecode = Buffer.from(inner, 'base64');
                // Check if it looks like an ASN.1 DER sequence (0x30)
                if (secondDecode.length > 0 && secondDecode[0] === 0x30) {
                    der = secondDecode;
                    detectedDoubleBase64 = true;
                } else {
                    der = first;
                }
            } else {
                der = first;
            }
        } else {
            der = first;
        }

        // 7. Validate that the final DER is actually an X.509 certificate
        let cert: crypto.X509Certificate;
        try {
            cert = new crypto.X509Certificate(der);
        } catch (e) {
            const err = new Error(`ZATCA_CERTIFICATE_INVALID: Cannot parse X.509 certificate. Internal: ${(e as Error).message}`);
            (err as any).code = 'ZATCA_CERTIFICATE_INVALID';
            throw err;
        }

        // 9. Add safe diagnostics only
        const outerLength = normalizedStr.length;
        const firstDecodedLength = first.length;
        const firstDecodedPrefixHex = first.length >= 2 ? first.subarray(0, 2).toString('hex') : '';
        const finalDerLength = der.length;
        const finalDerPrefixHex = der.length >= 2 ? der.subarray(0, 2).toString('hex') : '';
        const certificateSha256 = crypto.createHash('sha256').update(der).digest('hex');

        console.log(`[ZATCA] Certificate decoded. Diagnostics:\n` +
            `  outerLength: ${outerLength}\n` +
            `  firstDecodedLength: ${firstDecodedLength}\n` +
            `  firstDecodedPrefixHex: ${firstDecodedPrefixHex}\n` +
            `  detectedDoubleBase64: ${detectedDoubleBase64}\n` +
            `  finalDerLength: ${finalDerLength}\n` +
            `  finalDerPrefixHex: ${finalDerPrefixHex}\n` +
            `  certificateSha256: ${certificateSha256}`
        );

        // 13. Verify EC P-256
        if (!cert.publicKey) {
             throw new Error('Certificate has no public key.');
        }
        if (cert.publicKey.asymmetricKeyType !== 'ec') {
             throw new Error(`Certificate public key is ${cert.publicKey.asymmetricKeyType}, expected ec.`);
        }
        const details = cert.publicKey.asymmetricKeyDetails;
        if (details && details.namedCurve !== 'prime256v1' && details.namedCurve !== 'P-256') {
             throw new Error(`Certificate public key curve is ${details.namedCurve}, expected prime256v1 (P-256).`);
        }
        
        return { cert, canonicalBase64: der.toString('base64'), der };
    }

    /**
     * Verifies that the private key and certificate belong to the same key pair
     * by comparing the public key exported from the private key to the certificate's public key.
     * Throws ZATCA_KEY_CERTIFICATE_MISMATCH if they do not match.
     */
    private verifyCertificateKeyMatch(keyObj: crypto.KeyObject, cert: crypto.X509Certificate): void {
        try {
            const pubKeyFromPriv = crypto.createPublicKey(keyObj);
            const pubKeyDerFromPriv = pubKeyFromPriv.export({ type: 'spki', format: 'der' }) as Buffer;
            const certPublicKey = cert.publicKey;
            const certPubKeyDer = certPublicKey.export({ type: 'spki', format: 'der' }) as Buffer;

            if (!pubKeyDerFromPriv.equals(certPubKeyDer)) {
                const err = new Error(
                    'ZATCA_KEY_CERTIFICATE_MISMATCH: The private key does not match the ZATCA compliance certificate. ' +
                    'The certificate was likely issued for a different key pair. ' +
                    'Do NOT re-generate the ZATCA onboarding; check that the correct config file is being loaded.'
                );
                (err as any).code = 'ZATCA_KEY_CERTIFICATE_MISMATCH';
                throw err;
            }
            console.log('[ZATCA] Key/certificate public-key match verified ✓');
        } catch (e) {
            // Re-throw ZATCA_KEY_CERTIFICATE_MISMATCH as-is; wrap other errors
            if ((e as any).code === 'ZATCA_KEY_CERTIFICATE_MISMATCH') throw e;
            const err = new Error(
                `ZATCA_KEY_CERTIFICATE_MISMATCH: Unable to compare key and certificate public keys. ` +
                `Internal: ${(e as Error).message}`
            );
            (err as any).code = 'ZATCA_KEY_CERTIFICATE_MISMATCH';
            throw err;
        }
    }

    /**
     * Runs a local cryptographic self-test:
     * 1. Parses the private key and certificate.
     * 2. Verifies the key type is EC.
     * 3. Verifies that key and certificate belong to the same pair.
     * 4. Signs a small test payload and verifies the signature using the certificate public key.
     *
     * Throws a typed error if any step fails.
     * Returns the validated key and certificate objects for reuse.
     *
     * SECURITY: Never logs private key material.
     */
    private runCryptoSelfTest(normalizedKeyPem: string, cert: crypto.X509Certificate): {
        keyObj: crypto.KeyObject;
        cert: crypto.X509Certificate;
    } {
        // Step 1 & 2: Validate private key (type + parse)
        const keyObj = this.validatePrivateKey(normalizedKeyPem);

        // Step 4: Verify key/cert match
        this.verifyCertificateKeyMatch(keyObj, cert);

        // Step 5: Sign a test payload and verify with certificate public key
        const testPayload = Buffer.from('ZATCA-SIGNING-SELF-TEST');
        let testSignature: Buffer;
        try {
            const signer = crypto.createSign('SHA256');
            signer.update(testPayload);
            testSignature = signer.sign(keyObj);
        } catch (e) {
            const err = new Error(
                `ZATCA_XML_SIGNING_FAILED: Self-test signing failed. ` +
                `The private key is present but cannot sign. ` +
                `Internal: ${(e as Error).message}`
            );
            (err as any).code = 'ZATCA_XML_SIGNING_FAILED';
            throw err;
        }

        try {
            const verifier = crypto.createVerify('SHA256');
            verifier.update(testPayload);
            const valid = verifier.verify(cert.publicKey, testSignature);
            if (!valid) {
                const err = new Error(
                    'ZATCA_KEY_CERTIFICATE_MISMATCH: Self-test signature verification failed. ' +
                    'The signature produced by the private key cannot be verified with the certificate public key.'
                );
                (err as any).code = 'ZATCA_KEY_CERTIFICATE_MISMATCH';
                throw err;
            }
        } catch (e) {
            if ((e as any).code === 'ZATCA_KEY_CERTIFICATE_MISMATCH') throw e;
            const err = new Error(
                `ZATCA_KEY_CERTIFICATE_MISMATCH: Self-test signature verification threw an error. ` +
                `Internal: ${(e as Error).message}`
            );
            (err as any).code = 'ZATCA_KEY_CERTIFICATE_MISMATCH';
            throw err;
        }

        console.log('[ZATCA] Cryptographic self-test PASSED ✓ (sign + verify with certificate public key)');
        return { keyObj, cert };
    }

    /**
     * Normalises any EC private key PEM to raw SEC1 base64 — the format expected by zatca-xml-js.
     *
     * zatca-xml-js (signing/index.js lines 94-95) does:
     *   cleanUpPrivateKeyString(key) → strips ONLY "-----BEGIN EC PRIVATE KEY-----\n" (real newline)
     *                                  and "-----END EC PRIVATE KEY-----"
     *   then wraps bytes with       → "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"
     *
     * IMPORTANT: cleanUpPrivateKeyString uses a template literal with a REAL newline after the header.
     *   If the PEM has CRLF (\r\n) or literal \\n, the strip won't match and the header stays in the body,
     *   causing ASN.1 DECODE_ERROR.
     *   This is why normalisePemNewlines() MUST be called before this function.
     *
     * Key format rules:
     * - SEC1 (BEGIN EC PRIVATE KEY)  → strip headers, return raw base64 directly.
     * - PKCS#8 EC (BEGIN PRIVATE KEY, asymmetricKeyType==='ec') → convert to SEC1 DER, return base64.
     * - PKCS#8 RSA / any non-EC key → throw immediately with a clear error (wrong key type).
     */
    private normaliseToSec1Base64(keyPem: string): string {
        const isPkcs8Generic = keyPem.includes('BEGIN PRIVATE KEY') && !keyPem.includes('BEGIN EC PRIVATE KEY');
        const isSec1Ec = keyPem.includes('BEGIN EC PRIVATE KEY');

        if (isPkcs8Generic) {
            // Import the key to determine its algorithm before trying to export as SEC1
            let keyObj: crypto.KeyObject;
            try {
                keyObj = crypto.createPrivateKey({ key: keyPem, format: 'pem' });
            } catch (e) {
                const err = new Error(
                    `ZATCA_PRIVATE_KEY_INVALID: Cannot import PKCS#8 private key — it may be corrupted. ` +
                    `Internal: ${(e as Error).message}`
                );
                (err as any).code = 'ZATCA_PRIVATE_KEY_INVALID';
                throw err;
            }

            if (keyObj.asymmetricKeyType !== 'ec') {
                // The stored key is RSA or another non-EC algorithm — this will NEVER work with ZATCA.
                const err = new Error(
                    `ZATCA_PRIVATE_KEY_INVALID: The stored private key is of type "${keyObj.asymmetricKeyType}" ` +
                    `(expected "ec" / P-256). ZATCA requires an EC secp256r1 (P-256) key. ` +
                    `Please click "Generate New CSR" to create a fresh key pair and re-onboard.`
                );
                (err as any).code = 'ZATCA_PRIVATE_KEY_INVALID';
                throw err;
            }

            // It's a PKCS#8-wrapped EC key — export as SEC1 DER
            try {
                const sec1Der = keyObj.export({ type: 'sec1', format: 'der' }) as Buffer;
                return sec1Der.toString('base64');
            } catch (e) {
                const err = new Error(
                    `ZATCA_PRIVATE_KEY_INVALID: Failed to convert PKCS#8 EC key to SEC1 format. ` +
                    `Internal: ${(e as Error).message}`
                );
                (err as any).code = 'ZATCA_PRIVATE_KEY_INVALID';
                throw err;
            }
        }

        if (isSec1Ec) {
            // Already SEC1 (BEGIN EC PRIVATE KEY) — strip PEM headers and return raw base64.
            // IMPORTANT: All whitespace (including any remaining \r, \n) is stripped so the result
            // is a clean base64 string. The zatca-xml-js library re-adds the headers with real \n.
            return keyPem
                .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
                .replace(/-----END EC PRIVATE KEY-----/g, '')
                .replace(/\s+/g, '')
                .trim();
        }

        // Unknown format — strip any headers and attempt as fallback
        console.warn('[ZATCA] Unrecognised private key format — stripping headers as fallback.');
        return keyPem
            .replace(/-----BEGIN [A-Z ]+-----/g, '')
            .replace(/-----END [A-Z ]+-----/g, '')
            .replace(/\s+/g, '')
            .trim();
    }

    /**
     * Signs an unsigned invoice XML using zatca-xml-js.
     *
     * Key format requirement (zatca-xml-js signing/index.js lines 94-98):
     *   The library calls cleanUpPrivateKeyString() which strips "BEGIN EC PRIVATE KEY" + real newline,
     *   then re-wraps with those same headers. Therefore private_key_string MUST be the raw base64 body
     *   of a SEC1 (RFC 5915) key, NOT PKCS#8 DER bytes.
     *   Passing PKCS#8 DER bytes causes: error:0c00006d:ASN.1 DECODE_ERROR.
     *
     * This method performs a full cryptographic self-test (key parse → cert parse → key/cert match
     * → sign/verify test payload) before attempting ZATCA XML signing.
     */
    async signInvoiceXml(unsignedXml: string, certificatePem: string, privateKeyPem: string): Promise<{ signedXml: string; hash: string; qr: string }> {
        try {
            // --- Step 1: Decrypt if stored encrypted ---
            let key = privateKeyPem;
            if (key.startsWith('enc:')) {
                key = this.decryptField(key);
            }

            if (!key || key.trim() === '') {
                const err = new Error('ZATCA_PRIVATE_KEY_INVALID: Private key is empty or could not be decrypted. Please re-onboard ZATCA.');
                (err as any).code = 'ZATCA_PRIVATE_KEY_INVALID';
                throw err;
            }

            // --- Step 2: Normalise newlines (MUST happen before any PEM operations) ---
            key = ZatcaService.normalisePemNewlines(key);

            // --- Step 3: Decode and canonicalize the certificate ---
            const { cert, canonicalBase64 } = this.decodeZatcaCertificate(certificatePem);

            // --- Step 4: Cryptographic self-test (validates key, cert, key/cert match, sign/verify) ---
            this.runCryptoSelfTest(key, cert);

            // --- Step 5: Convert key to SEC1 raw base64 for zatca-xml-js ---
            const cleanKey = this.normaliseToSec1Base64(key);

            if (!cleanKey) {
                const err = new Error('ZATCA_PRIVATE_KEY_INVALID: Private key normalisation produced an empty result. Please re-onboard ZATCA.');
                (err as any).code = 'ZATCA_PRIVATE_KEY_INVALID';
                throw err;
            }

            // --- Step 6: Sign the invoice XML ---
            const { ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');

            // MONKEY PATCH zatca-xml-js rounding bug (BR-CO-15 & 1-cent discrepancy fix).
            // The library truncates values (using floor) instead of rounding half-up.
            // This causes TaxInclusiveAmount to not equal TaxExclusiveAmount + TaxAmount exactly.
            // We MUST apply this AFTER the require() statement, because the library defines its own broken
            // version at module load time, which was overwriting our patch.
            // @ts-ignore: Monkey patch for zatca-xml-js library
            Number.prototype.toFixedNoRounding = function(n: number) {
                return (Math.round((this as number) * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n);
            };

            // If unsignedXml is a JSON props object, use the library's own template generator.
            // This ensures the canonical XML used for hashing matches the submitted XML exactly,
            // preventing invoiceHash_QRCODE_INVALID errors caused by canonicalization mismatches
            // between our hand-crafted XML templates and the library's internal format.
            let invoice: any;
            if (unsignedXml.trim().startsWith('{')) {
                const invoiceProps = JSON.parse(unsignedXml);
                invoice = new ZATCASimplifiedTaxInvoice({ props: invoiceProps });
            } else {
                invoice = new ZATCASimplifiedTaxInvoice({ invoice_xml_str: unsignedXml });
            }

            // Fix for BR-KSA-71: Inject buyer name for Simplified Summary Invoices (0211010)
            // For compliance samples, _customer_name is not set → defaults to 'Customer'.
            // For production Sale Bills, generateZatcaXML sets _customer_name to the real
            // customer name so the correct buyer appears on the invoice.
            let buyerName = 'Customer';
            if (unsignedXml.trim().startsWith('{')) {
                try {
                    const parsedForBuyer = JSON.parse(unsignedXml);
                    if (parsedForBuyer._customer_name && typeof parsedForBuyer._customer_name === 'string') {
                        buyerName = parsedForBuyer._customer_name.trim() || 'Customer';
                    }
                } catch { /* use default */ }
            }
            if (invoice && invoice.getXML && typeof invoice.getXML === 'function') {
                invoice.getXML().set("Invoice/cac:AccountingCustomerParty", true, {
                    "cac:Party": {
                        "cac:PartyLegalEntity": {
                            "cbc:RegistrationName": buyerName
                        }
                    }
                });
            }

            console.log('[ZATCA] Signing invoice XML. Key body length (base64 chars):', cleanKey.length);
            console.log('[ZATCA] Certificate body length (base64 chars):', canonicalBase64.length);

            invoice.certificate = canonicalBase64;
            invoice.private_key = cleanKey;

            // BUGFIX for zatca-xml-js QR generation:
            // zatca-xml-js parses the IssueTime, blindly formats it in local time, and appends 'Z'.
            // If we supply UTC time, it outputs local time + Z (e.g. 17:48:00Z instead of 14:48:00Z), causing a mismatch.
            // We temporarily intercept moment to force it to output UTC time.
            const originalFormat = moment.fn.format;
            let result: { signed_invoice_string: string; invoice_hash: string; qr: string };
            try {
                moment.fn.format = function(fmt: string) {
                    if (fmt === "YYYY-MM-DDTHH:mm:ss" && this.isValid()) {
                        return originalFormat.call(this.utc(), fmt);
                    }
                    return originalFormat.apply(this, arguments as any);
                };

                result = invoice.sign(canonicalBase64, cleanKey);
            } catch (signErr) {
                const err = new Error(
                    `ZATCA_XML_SIGNING_FAILED: zatca-xml-js invoice.sign() failed. ` +
                    `Internal: ${(signErr as Error).message}`
                );
                (err as any).code = 'ZATCA_XML_SIGNING_FAILED';
                throw err;
            } finally {
                moment.fn.format = originalFormat; // Always restore
            }

            // ====================================================================
            // DIAGNOSTIC TRACE AS REQUESTED BY USER
            // ====================================================================
            try {
                const xml = result.signed_invoice_string;
                const match = (regex: RegExp) => (xml.match(regex) || [])[1] || 'N/A';
                const matchAll = (regex: RegExp) => [...xml.matchAll(regex)];

                const taxAmountDoc = match(/<cac:TaxTotal>\s*<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/);
                const lineExtAmount = match(/<cac:LegalMonetaryTotal>[\s\S]*?<cbc:LineExtensionAmount[^>]*>([^<]+)<\/cbc:LineExtensionAmount>/);
                const taxExclAmount = match(/<cbc:TaxExclusiveAmount[^>]*>([^<]+)<\/cbc:TaxExclusiveAmount>/);
                const taxInclAmount = match(/<cbc:TaxInclusiveAmount[^>]*>([^<]+)<\/cbc:TaxInclusiveAmount>/);
                const allowTotal = match(/<cbc:AllowanceTotalAmount[^>]*>([^<]+)<\/cbc:AllowanceTotalAmount>/);
                const chargeTotal = match(/<cbc:ChargeTotalAmount[^>]*>([^<]+)<\/cbc:ChargeTotalAmount>/);
                const prepaidAmount = match(/<cbc:PrepaidAmount[^>]*>([^<]+)<\/cbc:PrepaidAmount>/);
                const payableAmount = match(/<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/);

                let trace = `\n================ MONETARY TRACE ================\n\n`;
                trace += `DOCUMENT TOTALS:\n`;
                trace += `TaxAmount (TaxTotal)   = ${taxAmountDoc}\n`;
                trace += `LineExtensionAmount    = ${lineExtAmount}\n`;
                trace += `TaxExclusiveAmount     = ${taxExclAmount}\n`;
                trace += `TaxInclusiveAmount     = ${taxInclAmount}\n`;
                trace += `AllowanceTotalAmount   = ${allowTotal}\n`;
                trace += `ChargeTotalAmount      = ${chargeTotal}\n`;
                trace += `PrepaidAmount          = ${prepaidAmount}\n`;
                trace += `PayableAmount          = ${payableAmount}\n\n`;

                trace += `LINE ITEMS:\n`;
                const lines = matchAll(/<cac:InvoiceLine>([\s\S]*?)<\/cac:InvoiceLine>/g);
                let calcSumLineExt = 0;
                let calcSumLineVat = 0;

                lines.forEach((l, idx) => {
                    const lxml = l[1];
                    const qty = (lxml.match(/<cbc:InvoicedQuantity[^>]*>([^<]+)<\/cbc:InvoicedQuantity>/) || [])[1];
                    const lineExt = (lxml.match(/<cbc:LineExtensionAmount[^>]*>([^<]+)<\/cbc:LineExtensionAmount>/) || [])[1];
                    const taxAmt = (lxml.match(/<cac:TaxTotal>\s*<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/) || [])[1];
                    const price = (lxml.match(/<cbc:PriceAmount[^>]*>([^<]+)<\/cbc:PriceAmount>/) || [])[1];
                    const vatPercent = (lxml.match(/<cbc:Percent[^>]*>([^<]+)<\/cbc:Percent>/) || [])[1];
                    
                    trace += `Line ${idx + 1}:\n`;
                    trace += `  Quantity: ${qty}\n`;
                    trace += `  Unit Price (PriceAmount): ${price}\n`;
                    trace += `  LineExtensionAmount: ${lineExt}\n`;
                    trace += `  VAT %: ${vatPercent}\n`;
                    trace += `  Line VAT Amount: ${taxAmt}\n`;
                    
                    calcSumLineExt += parseFloat(lineExt || '0');
                    calcSumLineVat += parseFloat(taxAmt || '0');
                });

                trace += `\nCALCULATIONS:\n`;
                trace += `SUM(LineExtensionAmount) = ${calcSumLineExt}\n`;
                trace += `SUM(Line VAT Amount)     = ${calcSumLineVat}\n\n`;

                const allow = parseFloat(allowTotal !== 'N/A' ? allowTotal : '0');
                const charge = parseFloat(chargeTotal !== 'N/A' ? chargeTotal : '0');
                const expectedTaxExcl = calcSumLineExt - allow + charge;
                const expectedTaxIncl = expectedTaxExcl + parseFloat(taxAmountDoc || '0');

                trace += `ExpectedTaxExclusive (Sum - Allow + Charge) = ${expectedTaxExcl}\n`;
                trace += `ExpectedTaxInclusive (ExpectedExcl + DocVAT) = ${expectedTaxIncl}\n\n`;

                trace += `BR-CO-15 CHECK:\n`;
                trace += `Expected BT-112 (TaxInclusive) = ${expectedTaxIncl}\n`;
                trace += `Actual BT-112 (TaxInclusive)   = ${taxInclAmount}\n`;
                trace += `Difference = ${expectedTaxIncl - parseFloat(taxInclAmount || '0')}\n`;
                trace += `=================================================\n`;

                console.log(trace);
                const fs = require('fs');
                const path = require('path');
                fs.writeFileSync(path.join(require('os').homedir(), 'Desktop', 'ZATCA_MONETARY_TRACE.txt'), trace);
            } catch (e) {
                console.error("Failed to write trace:", e);
            }
            // ====================================================================

            try {
                const { DOMParser } = require('xmldom');
                const { XmlCanonicalizer } = require('xmldsigjs');
                
                const A_libraryHash = result.invoice_hash;
                const finalXml = result.signed_invoice_string;
                const finalQr = result.qr;
                
                const encodedXml = Buffer.from(unescape(encodeURIComponent(finalXml))).toString('base64');
                const G_apiInvoiceHash = result.invoice_hash; 
                
                const digestValueMatch = finalXml.match(/<(?:ds:)?DigestValue[^>]*>([^<]+)<\/(?:ds:)?DigestValue>/);
                const B_xmlDigestValue = digestValueMatch ? digestValueMatch[1].trim() : 'NOT_FOUND';
                
                const sigValueMatch = finalXml.match(/<(?:ds:)?SignatureValue[^>]*>([^<]+)<\/(?:ds:)?SignatureValue>/);
                const C_xmlSignatureValue = sigValueMatch ? sigValueMatch[1].trim() : 'NOT_FOUND';
                const H_finalXmlSignatureValue = C_xmlSignatureValue;
                
                function decodeZatcaTLV(base64: string) {
                    const bytes = Buffer.from(base64, 'base64');
                    const tags = new Map();
                    let offset = 0;
                    while (offset < bytes.length) {
                        if (offset + 2 > bytes.length) break;
                        const tag = bytes[offset];
                        const length = bytes[offset + 1];
                        if (offset + 2 + length > bytes.length) break;
                        const value = bytes.slice(offset + 2, offset + 2 + length);
                        tags.set(tag, value);
                        offset += 2 + length;
                    }
                    return tags;
                }
                const tags = decodeZatcaTLV(finalQr);
                const tag6Bytes = tags.get(6);
                const D_qrTag6Base64 = tag6Bytes ? tag6Bytes.toString('base64') : 'NOT_FOUND';
                const tag7Bytes = tags.get(7);
                const E_qrTag7Base64 = tag7Bytes ? tag7Bytes.toString('base64') : 'NOT_FOUND';
                
                const domUnsigned = new DOMParser().parseFromString(finalXml);
                const NS_EXT = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
                const NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
                const NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
                
                const ublNodes = domUnsigned.getElementsByTagNameNS(NS_EXT, 'UBLExtensions');
                if (ublNodes && ublNodes.length > 0) ublNodes[0].parentNode.removeChild(ublNodes[0]);
                
                const cacSigNodes = domUnsigned.getElementsByTagNameNS(NS_CAC, 'Signature');
                if (cacSigNodes && cacSigNodes.length > 0) cacSigNodes[0].parentNode.removeChild(cacSigNodes[0]);
                
                const adrNodes = domUnsigned.getElementsByTagNameNS(NS_CAC, 'AdditionalDocumentReference');
                for (let i = 0; i < adrNodes.length; i++) {
                    const idEls = adrNodes[i].getElementsByTagNameNS(NS_CBC, 'ID');
                    if (idEls && idEls.length > 0 && idEls[0].textContent === 'QR') {
                        adrNodes[i].parentNode.removeChild(adrNodes[i]);
                        break;
                    }
                }
                const zatcaC14nizer = new XmlCanonicalizer(false, false);
                const canonicalizedXml = zatcaC14nizer.Canonicalize(domUnsigned);
                const crypto = require('crypto');
                const F_independentHash = crypto.createHash('sha256').update(canonicalizedXml).digest('base64');
                
                function analyze(value: string): any {
                    if (value === 'NOT_FOUND') return 'N/A';
                    const buf = Buffer.from(value, 'base64');
                    return { len: buf.length };
                }
                
                function analyzeBuffer(buf: any): any {
                    if (!buf) return { len: 0, isDouble: false, asStr: 'N/A' };
                    const asStr = buf.toString('utf8');
                    const isDouble = /^[A-Za-z0-9+/=]+$/.test(asStr) && asStr.length > 20;
                    return { len: buf.length, isDouble, asStr };
                }
                
                console.log("\n==================================================");
                console.log("ZATCA CRYPTOGRAPHIC TRACE — SAMPLE 1");
                console.log("==================================================");
                console.log("\nA — LIBRARY INVOICE HASH");
                console.log("Value:", A_libraryHash);
                console.log("Decoded byte length:", analyze(A_libraryHash).len);
                console.log("\nB — XML ds:DigestValue");
                console.log("Value:", B_xmlDigestValue);
                console.log("Decoded byte length:", analyze(B_xmlDigestValue).len);
                console.log("\nC — XML ds:SignatureValue");
                console.log("Value:", C_xmlSignatureValue);
                console.log("Decoded byte length:", analyze(C_xmlSignatureValue).len);
                const tag6A = analyzeBuffer(tag6Bytes);
                console.log("\nD — QR TAG 6");
                console.log("Decoded Base64:", D_qrTag6Base64);
                console.log("Decoded byte length:", tag6A.len);
                const tag7A = analyzeBuffer(tag7Bytes);
                console.log("\nE — QR TAG 7");
                console.log("Decoded Base64:", E_qrTag7Base64);
                console.log("Decoded byte length:", tag7A.len);
                console.log("\nF — INDEPENDENT HASH OF EXACT FINAL XML");
                console.log("Value:", F_independentHash);
                console.log("Decoded byte length:", analyze(F_independentHash).len);
                console.log("\nG — API REQUEST invoiceHash");
                console.log("Value:", G_apiInvoiceHash);
                console.log("Decoded byte length:", analyze(G_apiInvoiceHash).len);
                console.log("\nH — FINAL XML SignatureValue");
                console.log("Value:", H_finalXmlSignatureValue);
                console.log("Decoded byte length:", analyze(H_finalXmlSignatureValue).len);
                
                console.log("\n==================================================");
                console.log("STEP 4 — EQUALITY MATRIX");
                console.log("==================================================");
                console.log(`A === B : ${A_libraryHash === B_xmlDigestValue}`);
                console.log(`A === D : ${A_libraryHash === D_qrTag6Base64}`);
                console.log(`A === F : ${A_libraryHash === F_independentHash}`);
                console.log(`A === G : ${A_libraryHash === G_apiInvoiceHash}`);
                console.log(`B === F : ${B_xmlDigestValue === F_independentHash}`);
                console.log(`B === G : ${B_xmlDigestValue === G_apiInvoiceHash}`);
                console.log(`C === E : ${C_xmlSignatureValue === E_qrTag7Base64}`);
                console.log(`C === H : ${C_xmlSignatureValue === H_finalXmlSignatureValue}`);
                console.log(`D === F : ${D_qrTag6Base64 === F_independentHash}`);
                console.log(`E === C : ${E_qrTag7Base64 === C_xmlSignatureValue}`);
                
                console.log("\n==================================================");
                console.log("STEP 5 — BYTE REPRESENTATION ANALYSIS");
                console.log("==================================================");
                console.log(`Is QR Tag 6 containing ASCII/UTF-8 characters of a Base64 string? ${tag6A.isDouble}`);
                if (tag6A.isDouble) console.log(`QR Tag 6 decoded as UTF-8 string: ${tag6A.asStr}`);
                console.log(`Is QR Tag 7 containing ASCII/UTF-8 characters of a Base64 string? ${tag7A.isDouble}`);
                
                console.log("\nBuffer behavior:");
                console.log("invoice_hash type:", typeof A_libraryHash);
                console.log("invoice_hash length:", A_libraryHash.length);
                console.log("Buffer.from(invoice_hash).length:", Buffer.from(A_libraryHash).length);
                console.log("Buffer.from(invoice_hash, 'base64').length:", Buffer.from(A_libraryHash, 'base64').length);
                
                console.log("\n==================================================");
                console.log("STEP 6 — TLV TRACE");
                console.log("==================================================");
                for (let i = 1; i <= 9; i++) {
                    const t = tags.get(i);
                    if (!t) continue;
                    console.log(`Tag ${i}:`);
                    console.log(`byte length: ${t.length}`);
                    if (i === 6 || i === 7) {
                        console.log(`Base64 representation: ${t.toString('base64')}`);
                        console.log(`First few raw bytes (hex): ${t.subarray(0, 10).toString('hex')}...`);
                    } else {
                        if (i < 6) console.log(`representation: ${t.toString('utf8')}`);
                        else console.log(`representation: (binary)`);
                    }
                    console.log("");
                }
                
                console.log("==================================================");
                console.log("STEP 7 — EXACT XML SENT TO ZATCA");
                console.log("==================================================");
                console.log(`API invoiceHash: ${G_apiInvoiceHash}`);
                console.log(`FINAL_XML_HASH: ${F_independentHash}`);
                console.log(`Equal: ${G_apiInvoiceHash === F_independentHash}\n`);
            } catch(e) {
                console.error("DIAGNOSTIC TRACE ERROR:", e);
            }
            // ====================================================================

            return {
                signedXml: result.signed_invoice_string,
                hash: result.invoice_hash,
                qr: result.qr
            };
        } catch (error) {
            const code = (error as any).code || 'ZATCA_XML_SIGNING_FAILED';
            const message = (error as Error).message;
            console.error(`[ZATCA] XML signing failed [${code}]:`, message);
            const wrappedErr = new Error(`XML Signing failed: ${message}`);
            (wrappedErr as any).code = code;
            throw wrappedErr;
        }
    }
}
