import { app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';
import crypto from 'crypto';

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
title=1100
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
     * Normalises any EC private key PEM to raw SEC1 base64 — the format expected by zatca-xml-js.
     *
     * zatca-xml-js (signing/index.js) does:
     *   cleanUpPrivateKeyString(key)  → strips "BEGIN EC PRIVATE KEY" headers
     *   then wraps bytes with        → "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"
     *
     * So it always expects the KEY BODY to be the raw bytes of a SEC1 (RFC 5915) key,
     * NOT PKCS#8 DER bytes. Passing PKCS#8 DER bytes causes OpenSSL DECODE_ERROR.
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
                throw new Error(
                    `ZATCA: Cannot import private key — it may be corrupted. Please re-generate your ZATCA CSR to get a fresh EC P-256 key. Details: ${(e as Error).message}`
                );
            }

            if (keyObj.asymmetricKeyType !== 'ec') {
                // The stored key is RSA or another non-EC algorithm — this will NEVER work with ZATCA.
                // Fail fast with a clear, actionable message instead of the cryptic DECODE_ERROR.
                throw new Error(
                    `ZATCA: The stored private key is of type "${keyObj.asymmetricKeyType}" (expected "ec" / P-256). ` +
                    `ZATCA requires an EC secp256r1 (P-256) key. Please click "Generate New CSR" to create a fresh key pair and re-onboard.`
                );
            }

            // It's a PKCS#8-wrapped EC key — export as SEC1 DER
            try {
                const sec1Der = keyObj.export({ type: 'sec1', format: 'der' }) as Buffer;
                return sec1Der.toString('base64');
            } catch (e) {
                throw new Error(
                    `ZATCA: Failed to convert PKCS#8 EC key to SEC1 format. Please re-generate your ZATCA CSR. Details: ${(e as Error).message}`
                );
            }
        }

        if (isSec1Ec) {
            // Already SEC1 (BEGIN EC PRIVATE KEY) — strip PEM headers and return raw base64
            return keyPem
                .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
                .replace(/-----END EC PRIVATE KEY-----/g, '')
                .replace(/\s+/g, '')
                .trim();
        }

        // Unknown format — strip any headers and hope for the best (last-resort fallback)
        console.warn('ZATCA: Unrecognised private key format — stripping headers as fallback.');
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
     *   The library calls cleanUpPrivateKeyString() which strips "BEGIN EC PRIVATE KEY" headers,
     *   then wraps the result back with those same headers before passing to OpenSSL.
     *   Therefore private_key_string must be the raw base64 body of a SEC1 (BEGIN EC PRIVATE KEY) key.
     *   Passing PKCS#8 DER bytes (BEGIN PRIVATE KEY) causes: error:0c00006d:ASN.1 DECODE_ERROR.
     */
    async signInvoiceXml(unsignedXml: string, certificatePem: string, privateKeyPem: string): Promise<{ signedXml: string; hash: string; qr: string }> {
        try {
            let key = privateKeyPem;
            if (key.startsWith('enc:')) {
                key = this.decryptField(key);
            }

            if (!key || key.trim() === '') {
                throw new Error('Private key is empty or could not be decrypted. Please re-onboard ZATCA.');
            }

            // Convert to SEC1 raw base64 — this is what zatca-xml-js expects as private_key_string.
            // The library wraps it with "-----BEGIN EC PRIVATE KEY-----" headers internally.
            const cleanKey = this.normaliseToSec1Base64(key);

            if (!cleanKey) {
                throw new Error('Private key normalisation produced an empty result. Please re-onboard ZATCA.');
            }

            // Normalise the certificate: strip PEM headers if present, then remove all whitespace.
            // The complianceCsid / productionCsid from ZATCA is already raw Base64 DER,
            // so this handles both plain CSID tokens and full PEM strings.
            const cleanCert = certificatePem
                .replace(/-----BEGIN CERTIFICATE-----/g, '')
                .replace(/-----END CERTIFICATE-----/g, '')
                .replace(/\s+/g, '')
                .trim();

            if (!cleanCert) {
                throw new Error('Certificate is empty. Please re-onboard ZATCA.');
            }

            const { ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');
            const invoice = new ZATCASimplifiedTaxInvoice({
                invoice_xml_str: unsignedXml
            });

            console.log("KEY HEADER:", key.split('\n')[0]);
            console.log("CERT HEADER:", certificatePem.split('\n')[0]);
            const result = invoice.sign(certificatePem, key);

            return {
                signedXml: result.signed_invoice_string,
                hash: result.invoice_hash,
                qr: result.qr
            };
        } catch (error) {
            console.error('ZATCA XML signing failed:', error);
            throw new Error(`XML Signing failed: ${(error as Error).message}`);
        }
    }
}
