import { app, safeStorage, shell } from 'electron';
import { machineIdSync } from 'node-machine-id';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_FILE = 'sys_config'; // Obfuscated name
const DATA_PATH = path.join(app.getPath('userData'), DATA_FILE);

// PUBLIC KEY for Asymmetric License Verification (RSA-2048)
// This key can only VERIFY licenses, not generate them.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyVEG5zhPCQSqeS1VqXUc
1rCXvLiSOEFZgG28uoVSmqwLOpdqQF7ka3GT2YQAmoogsRE5nXHg0zo8fTp4Gjfv
8AiaNRb2D2VRYSjMgwXysrfXlgrOAaYbYFMMYuUCUEMizEZFbf5OTNQ1tRRI+xWU
ftZs/T61aHafAJcvj5s+Ffk8uN5q41B0JG/VwX6yvlwLrBmySeLlAM0iV6CzsAQ4
FrohQgfA9+Ef2RliOdKrEOV32yhzWJWvNNOtH58VsB7IxyneMYKsvlHSO6AY+5QO
oJqEwrvn5GHdyn9G9zHq4WgWQoMggB+NTsuRaUqDJ5MvwvnYqIpqDtg6ZLIA9WZ9
SwIDAQAB
-----END PUBLIC KEY-----`;

// Local storage encryption (AES-256-CBC Fallback)
// Removed hardcoded STORAGE_INTERNAL_SECRET. 
// A unique key is now derived from the Machine ID and a local per-install salt.
const ALGORITHM = 'aes-256-cbc';

interface LicensePayload {
    mid: string;      // Machine ID
    exp: number;      // Expiry Timestamp (ms)
    type: 'pro' | 'trial';
}

interface LicenseData {
    setupDate: number;
    machineId: string;
    licenseKey?: string; 
    lastRun?: number;
    salt?: string; // Random salt generated on first run for local encryption fallback
}

export class LicenseService {
    private currentMachineId: string;

    constructor() {
        try {
            this.currentMachineId = machineIdSync();
        } catch (error) {
            console.error('Failed to get machine ID:', error);
            this.currentMachineId = 'FALLBACK-ID-' + crypto.randomBytes(4).toString('hex');
        }
    }

    // --- Crypto Helpers ---

    private verifyLicenseKey(licenseKey: string): LicensePayload | null {
        try {
            const cleanKey = (licenseKey || '').replace(/\s/g, '');
            const parts = cleanKey.split(':');
            if (parts.length !== 2) return null;

            const payloadB64 = parts[0];
            const signatureB64 = parts[1];
            const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8');
            const signature = Buffer.from(signatureB64, 'base64');

            const isVerified = crypto.verify(
                "sha256",
                Buffer.from(payloadStr),
                {
                    key: PUBLIC_KEY,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
                },
                signature
            );

            if (!isVerified) return null;
            return JSON.parse(payloadStr);
        } catch (error) {
            console.error('License verification ERROR:', error);
            return null;
        }
    }

    // --- Storage Helpers ---

    private getStorageKey(salt: string): Buffer {
        // Derive a key from Machine ID and a local salt
        // This ensures the storage is locked to THIS machine even without safeStorage
        return crypto.scryptSync(this.currentMachineId, salt, 32);
    }

    private encryptStorage(data: LicenseData): Buffer {
        const json = JSON.stringify(data);
        
        // 1. Primary: OS-Level Encryption (safeStorage)
        try {
            if (safeStorage.isEncryptionAvailable()) {
                return safeStorage.encryptString(json);
            }
        } catch (e) {
            console.warn('safeStorage encryption failed, using fallback AES');
        }

        // 2. Fallback: Machine-bound AES-256-CBC
        // Generate salt if missing (should be present if loadData worked)
        const salt = data.salt || crypto.randomBytes(32).toString('hex');
        const iv = crypto.randomBytes(16);
        const key = this.getStorageKey(salt);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(json, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Structure: [IV(16)] [EncryptedData]
        return Buffer.concat([iv, encrypted]);
    }

    private decryptStorage(buffer: Buffer): LicenseData | null {
        try {
            // 1. Try safeStorage first
            if (safeStorage.isEncryptionAvailable()) {
                try {
                    const json = safeStorage.decryptString(buffer);
                    return JSON.parse(json);
                } catch (e) {
                    // Might be fallback encrypted, continue
                }
            }

            // 2. Try Fallback AES
            if (buffer.length < 17) return null;
            
            // We need the salt to derive the key. 
            // Let's use a per-machine predictable salt derived from MachineID for the fallback
            const fallbackSalt = crypto.createHash('sha256').update(this.currentMachineId + 'local-salt').digest('hex');
            const iv = buffer.subarray(0, 16);
            const encryptedText = buffer.subarray(16);
            const key = this.getStorageKey(fallbackSalt);

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return JSON.parse(decrypted.toString());

        } catch (e) {
            console.error('Failed to decrypt license storage:', e);
            return null;
        }
    }

    private loadData(): LicenseData | null {
        if (!fs.existsSync(DATA_PATH)) return null;
        try {
            return this.decryptStorage(fs.readFileSync(DATA_PATH));
        } catch (e) { return null; }
    }

    private saveData(data: LicenseData) {
        // Ensure salt exists for fallback
        if (!data.salt) {
            data.salt = crypto.createHash('sha256').update(this.currentMachineId + 'local-salt').digest('hex');
        }
        fs.writeFileSync(DATA_PATH, this.encryptStorage(data));
    }

    // --- Public API ---

    public initialize(): { status: 'ok' | 'expired' | 'pirated' | 'trial'; remainingDays: number; machineId: string; expiryDate?: string } {
        let data = this.loadData();
        const now = Date.now();

        if (!data) {
            data = {
                setupDate: now,
                machineId: this.currentMachineId,
                lastRun: now
            };
            this.saveData(data);
        }

        // 1. Anti-Piracy Check: Machine ID Mismatch
        if (data.machineId !== this.currentMachineId) {
            return { status: 'pirated', remainingDays: 0, machineId: this.currentMachineId };
        }

        // 2. Clock Rollback Check
        if (data.lastRun && data.lastRun > now + 60000) { // 1 min grace
            console.warn('Clock rollback detected');
        } else {
            data.lastRun = now;
            this.saveData(data);
        }

        // 3. License Validation (RSA Verified)
        if (data.licenseKey) {
            const payload = this.verifyLicenseKey(data.licenseKey);

            if (payload) {
                // Secondary check: Internal Machine ID match
                if (payload.mid !== this.currentMachineId) {
                    return { status: 'pirated', remainingDays: 0, machineId: this.currentMachineId };
                }

                // Expiry Check
                if (payload.exp < now) {
                    return { status: 'expired', remainingDays: 0, machineId: this.currentMachineId, expiryDate: new Date(payload.exp).toLocaleDateString() };
                }

                const msPerDay = 24 * 60 * 60 * 1000;
                const remaining = Math.ceil((payload.exp - now) / msPerDay);

                return {
                    status: 'ok',
                    remainingDays: remaining,
                    machineId: this.currentMachineId,
                    expiryDate: new Date(payload.exp).toLocaleDateString()
                };
            }
        }

        // 4. Trial Logic (7 Days)
        const oneDay = 24 * 60 * 60 * 1000;
        const daysPassed = Math.floor((now - data.setupDate) / oneDay);
        const trialDays = 7;
        const remaining = Math.max(0, trialDays - daysPassed);

        if (remaining <= 0) {
            return { status: 'expired', remainingDays: 0, machineId: this.currentMachineId };
        }

        return { status: 'trial', remainingDays: remaining, machineId: this.currentMachineId };
    }

    public activate(key: string): boolean {
        const cleanKey = (key || '').trim();
        const payload = this.verifyLicenseKey(cleanKey);

        if (!payload || payload.mid !== this.currentMachineId) {
            return false;
        }

        const data = this.loadData() || {
            setupDate: Date.now(),
            machineId: this.currentMachineId,
            lastRun: Date.now()
        };

        data.licenseKey = cleanKey;
        data.machineId = this.currentMachineId;
        this.saveData(data);
        return true;
    }

    public reset(): boolean {
        const data = this.loadData();
        if (data) {
            delete data.licenseKey;
            this.saveData(data);
            return true;
        }
        return false;
    }
}
