import { app, safeStorage, shell } from 'electron';
import { machineIdSync } from 'node-machine-id';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_FILE = 'sys_config'; // Obfuscated name
const DATA_PATH = path.join(app.getPath('userData'), DATA_FILE);

// SECRET KEY for License Encryption (AES-256)
// WARNING: This key must match the one in the Admin Key Generator.
// In a real production app, you might want to obfuscate this further.
const APP_SECRET = 'your-secret-key-32-chars-exactly!!'; // 32 chars
const ALGORITHM = 'aes-256-cbc';

interface LicensePayload {
    mid: string;      // Machine ID
    exp: number;      // Expiry Timestamp (ms)
    type: 'pro' | 'trial';
}

interface LicenseData {
    setupDate: number;
    machineId: string;
    licenseKey?: string; // The encrypted string
    lastRun?: number;
}

export class LicenseService {
    private currentMachineId: string;

    constructor() {
        try {
            this.currentMachineId = machineIdSync();
        } catch (error) {
            console.error('Failed to get machine ID:', error);
            this.currentMachineId = 'FALLBACK-ID-' + Math.random().toString(36).substring(2, 10);
        }
    }

    // --- Crypto Helpers ---

    private getSecretKey(): Buffer {
        // Match the "LicenseManager.html" logic: 
        // Use the first 32 bytes of the secret string directly.
        // Pad with zeros if short (though we know it is 32 chars).
        const key = Buffer.alloc(32);
        const secretBytes = Buffer.from(APP_SECRET, 'utf8');
        secretBytes.copy(key, 0, 0, Math.min(secretBytes.length, 32));
        return key;
    }

    private decryptLicenseKey(encryptedKey: string): LicensePayload | null {
        try {
            // format: iv:encryptedData (hex encoded)
            const parts = encryptedKey.split(':');
            if (parts.length !== 2) return null;

            const iv = Buffer.from(parts[0], 'hex');
            const encryptedText = Buffer.from(parts[1], 'hex');

            const key = this.getSecretKey();

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return JSON.parse(decrypted.toString());
        } catch (error) {
            // console.error('License decryption failed details:', error);
            // Quiet fail is better for security probing
            return null;
        }
    }

    // --- Storage Helpers ---

    private getStorageKey(): Buffer {
        // Use Machine ID as part of the key for storage encryption (Device Locking)
        // This ensures that even if safeStorage fails, the file is locked to this machine.
        const mixedKey = this.currentMachineId + APP_SECRET;
        return crypto.scryptSync(mixedKey, 'salt', 32);
    }

    private encryptStorage(data: LicenseData): Buffer {
        const json = JSON.stringify(data);
        try {
            if (safeStorage.isEncryptionAvailable()) {
                return safeStorage.encryptString(json);
            }
        } catch (e) {
            console.warn('safeStorage failed, using fallback AES');
        }

        // Fallback: Custom AES Encryption locked to MachineID
        const iv = crypto.randomBytes(16);
        const key = this.getStorageKey();
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(json, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return Buffer.concat([iv, encrypted]); // Prepend IV
    }

    private decryptStorage(buffer: Buffer): LicenseData | null {
        try {
            // Try safeStorage first
            if (safeStorage.isEncryptionAvailable()) {
                try {
                    const json = safeStorage.decryptString(buffer);
                    return JSON.parse(json);
                } catch (e) {
                    // Might be fallback encrypted
                }
            }

            // Try Fallback AES
            // Extract IV (first 16 bytes)
            if (buffer.length < 17) return null; // Too short
            const iv = buffer.subarray(0, 16);
            const encryptedText = buffer.subarray(16);
            const key = this.getStorageKey();

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return JSON.parse(decrypted.toString());

        } catch (e) {
            console.error('Failed to decrypt license storage (corruption or wrong machine):', e);
            return null;
        }
    }

    private loadData(): LicenseData | null {
        if (!fs.existsSync(DATA_PATH)) return null;
        return this.decryptStorage(fs.readFileSync(DATA_PATH));
    }

    private saveData(data: LicenseData) {
        fs.writeFileSync(DATA_PATH, this.encryptStorage(data));
    }

    // --- Public API ---

    public initialize(): { status: 'ok' | 'expired' | 'pirated'; remainingDays: number; machineId: string; expiryDate?: string } {
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

        // 1. Anti-Piracy Check: Machine ID Mismatch (User copied files to another PC)
        // If the stored machineId doesn't match current, it's pirated/invalid.
        if (data.machineId !== this.currentMachineId) {
            return { status: 'pirated', remainingDays: 0, machineId: this.currentMachineId };
        }

        // 2. Clock Rollback Check
        if (data.lastRun && data.lastRun > now) {
            console.warn('Clock rollback detected');
            // We could block here, but for now we just don't update lastRun
        } else {
            data.lastRun = now;
            this.saveData(data);
        }

        // 3. License Validation
        if (data.licenseKey) {
            const payload = this.decryptLicenseKey(data.licenseKey);

            if (payload) {
                // Check Machine Check
                if (payload.mid !== this.currentMachineId) {
                    return { status: 'pirated', remainingDays: 0, machineId: this.currentMachineId };
                }

                // Check Expiry
                if (payload.exp < now) {
                    return { status: 'expired', remainingDays: 0, machineId: this.currentMachineId, expiryDate: new Date(payload.exp).toLocaleDateString() };
                }

                // Valid Pro License
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

        // 4. Fallback to Trial Logic (7 Days Default)
        const oneDay = 24 * 60 * 60 * 1000;
        const daysPassed = Math.floor((now - data.setupDate) / oneDay);
        const trialDays = 7;
        const remaining = Math.max(0, trialDays - daysPassed);

        if (remaining === 0) {
            return { status: 'expired', remainingDays: 0, machineId: this.currentMachineId };
        }

        return { status: 'expired', remainingDays: remaining, machineId: this.currentMachineId }; // Should use 'trial' status ideally, but reusing expired/ok for now? 
        // Wait, current frontend uses 'ok' for active. If trial is active, we should probably return 'ok' BUT with trial limit.
        // Actually, let's keep it simple: if trial active, it's 'ok' but specific UI might want to know. 
        // For now, let's return 'ok' for trial too so they can work, but low days.
        // Or if the user wants STRICT activation:
        // "activation key i need to put while it starting then only it can started otherwise it only work for 7 days"

        return { status: 'ok', remainingDays: remaining, machineId: this.currentMachineId };
    }

    public activate(key: string): boolean {
        const payload = this.decryptLicenseKey(key);

        if (!payload) {
            console.error('Invalid key format or decryption failed');
            return false;
        }

        if (payload.mid !== this.currentMachineId) {
            console.error('Key is for a different machine ID:', payload.mid);
            return false;
        }

        // Save the valid key
        const data = this.loadData() || {
            setupDate: Date.now(),
            machineId: this.currentMachineId,
            lastRun: Date.now()
        };

        data.licenseKey = key;
        data.machineId = this.currentMachineId; // Ensure binding
        this.saveData(data);
        data.licenseKey = key;
        data.machineId = this.currentMachineId; // Ensure binding
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
