import { safeStorage, app } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const AUTH_CONFIG_FILE = 'auth_config.json';
const AUTH_CONFIG_PATH = path.join(app.getPath('userData'), AUTH_CONFIG_FILE);

interface AuthConfig {
    hmacSecret: string;
}

export class AuthService {
    private hmacSecret: string | null = null;

    constructor() {
        this.initializeSecret();
    }

    private initializeSecret() {
        try {
            if (fs.existsSync(AUTH_CONFIG_PATH)) {
                const encryptedData = fs.readFileSync(AUTH_CONFIG_PATH);
                if (safeStorage.isEncryptionAvailable()) {
                    try {
                        const json = safeStorage.decryptString(encryptedData);
                        const config: AuthConfig = JSON.parse(json);
                        this.hmacSecret = config.hmacSecret;
                    } catch (e) {
                        console.error('Failed to decrypt HMAC secret:', e);
                    }
                }
            }

            if (!this.hmacSecret) {
                // Generate new secret
                this.hmacSecret = crypto.randomBytes(64).toString('hex');
                const config: AuthConfig = { hmacSecret: this.hmacSecret };
                const json = JSON.stringify(config);
                
                if (safeStorage.isEncryptionAvailable()) {
                    const encrypted = safeStorage.encryptString(json);
                    fs.writeFileSync(AUTH_CONFIG_PATH, encrypted);
                } else {
                    // Fallback for dev/unsupported
                    fs.writeFileSync(AUTH_CONFIG_PATH, Buffer.from(json));
                    console.warn('safeStorage unavailable, HMAC secret stored in plaintext');
                }
            }
        } catch (error) {
            console.error('AuthService initialization failed:', error);
            // Emergency fallback secret if persistent storage fails
            this.hmacSecret = 'EMERGENCY-VOLATILE-SECRET-' + crypto.randomBytes(16).toString('hex');
        }
    }

    /**
     * Signs a payload string with HMAC-SHA256
     */
    public signToken(payload: string): string {
        if (!this.hmacSecret) throw new Error('AuthService not initialized');
        
        const hmac = crypto.createHmac('sha256', this.hmacSecret);
        hmac.update(payload);
        const signature = hmac.digest('base64');
        
        // Return structured token: Base64(Payload):Base64(Signature)
        const payloadB64 = Buffer.from(payload).toString('base64');
        return `${payloadB64}.${signature}`;
    }

    /**
     * Verifies a signed token and returns the payload if valid
     */
    public verifyToken(token: string): string | null {
        if (!this.hmacSecret) throw new Error('AuthService not initialized');
        
        try {
            const [payloadB64, signature] = token.split('.');
            if (!payloadB64 || !signature) return null;

            const payload = Buffer.from(payloadB64, 'base64').toString('utf8');
            
            const hmac = crypto.createHmac('sha256', this.hmacSecret);
            hmac.update(payload);
            const expectedSignature = hmac.digest('base64');

            if (signature === expectedSignature) {
                return payload;
            }
        } catch (error) {
            console.error('Token verification failed:', error);
        }
        return null;
    }
}
