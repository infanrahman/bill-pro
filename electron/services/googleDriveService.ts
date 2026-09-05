import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import http from 'http';
import url from 'url';
import fs from 'fs';
import { app, shell } from 'electron';
import path from 'path';


const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = path.join(app.getPath('userData'), 'google-drive-token.json');
const CONFIG_PATH = path.join(app.getPath('userData'), 'google-drive-config.json');

// DEFAULT DEVELOPER CREDENTIALS (Fallback)
// Replace these with your "Master" keys if you want the app to work out-of-the-box for customers.
const DEFAULT_CLIENT_ID = 'YOUR_DEFAULT_CLIENT_ID';
const DEFAULT_CLIENT_SECRET = 'YOUR_DEFAULT_CLIENT_SECRET';
const DEFAULT_REDIRECT_URI = 'http://localhost:3000/oauth2callback';

interface GoogleDriveConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export class GoogleDriveService {
    private oAuth2Client: any = null;
    private config: GoogleDriveConfig | null = null;

    constructor() {
        this.loadConfig();
    }

    private loadConfig() {
        try {
            // 1. Try to load Custom Config (Admin UI)
            if (fs.existsSync(CONFIG_PATH)) {
                this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            }

            // 2. Fallback to Defaults if no config or fields are missing
            if (!this.config || !this.config.clientId) {
                console.log('Using Default Google Drive Credentials');
                this.config = {
                    clientId: DEFAULT_CLIENT_ID,
                    clientSecret: DEFAULT_CLIENT_SECRET,
                    redirectUri: DEFAULT_REDIRECT_URI
                };
            }

            if (this.config) {
                this.oAuth2Client = new google.auth.OAuth2(
                    this.config.clientId,
                    this.config.clientSecret,
                    this.config.redirectUri
                );
            }
        } catch (error) {
            console.error('Failed to load Google Drive config:', error);
        }
    }

    saveConfig(config: GoogleDriveConfig) {
        this.config = config;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
        this.oAuth2Client = new google.auth.OAuth2(
            config.clientId,
            config.clientSecret,
            config.redirectUri
        );
    }

    getConfig() {
        return this.config;
    }

    /**
     * Start the OAuth2 flow.
     * Open browser -> User logs in -> Callback -> Code -> Token.
     */
    async authenticate(): Promise<boolean> {
        if (!this.oAuth2Client || !this.config) {
            throw new Error("Google Drive credentials not configured.");
        }

        return new Promise((resolve, reject) => {
            // 1. Create a temporary local server to listen for the callback
            const server = http.createServer(async (req, res) => {
                try {
                    const reqUrl = req.url || '';
                    if (reqUrl.includes('/oauth2callback')) {
                        const qs = new url.URL(reqUrl, 'http://localhost').searchParams;
                        const code = qs.get('code');

                        res.end('Authentication successful! You can close this window now.');
                        server.close();

                        if (code) {
                            // 2. Exchange code for tokens
                            const { tokens } = await this.oAuth2Client!.getToken(code);
                            this.oAuth2Client!.setCredentials(tokens);

                            // 3. Save tokens to disk
                            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
                            resolve(true);
                        } else {
                            reject(new Error('No code found in URL'));
                        }
                    }
                } catch (e) {
                    server.close();
                    reject(e);
                }
            });

            // Listen on random available port
            server.listen(0, async () => {
                const address = server.address();
                if (typeof address === 'object' && address !== null) {
                    const port = address.port;

                    // Update client redirect URI to match this dynamic port
                    // Note: You must add "http://localhost:[PORT]" to Google Console if you use fixed, 
                    // but for dynamic ports usually we use loopback IP or fixed port 3000.
                    // For simplicity in this demo, let's assume valid Redirect URI is registered for localhost
                    // Actually, let's try to stick to port 3000 if possible, or instruct user.
                    // To be safe for "App Owners", we often use a custom scheme or strictly port 3000.
                    // Let's force port 3000 for now as it matches standard guides.
                    // If 3000 is busy, this might fail, but it's standard.
                }

            // Fix #14: Port 3000 is hardcoded here to match Google Console redirect URIs.
                    // WARNING: If port 3000 is in use (e.g., another app), this will throw EADDRINUSE
                    // and OAuth will permanently fail. For production, consider using a custom URL scheme
                    // (e.g., myapp://oauth2callback) registered via app.setAsDefaultProtocolClient().
                server.close();
                server.listen(3000, () => {
                    // Generate Auth URL
                    const authUrl = this.oAuth2Client!.generateAuthUrl({
                        access_type: 'offline',
                        scope: SCOPES,
                    });

                    // Open Browser
                    shell.openExternal(authUrl);
                });
            });

            server.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Check if we have valid, non-expired tokens loaded.
     * Fix #13: validates expiry_date and attempts a refresh before giving up.
     */
    async checkconnection(): Promise<boolean> {
        try {
            if (fs.existsSync(TOKEN_PATH) && this.oAuth2Client) {
                const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
                this.oAuth2Client.setCredentials(tokens);

                // Check if the access token is expired (or will expire within 60s)
                const expiresAt = tokens.expiry_date as number | undefined;
                const isExpired = expiresAt ? Date.now() >= expiresAt - 60_000 : false;

                if (isExpired && tokens.refresh_token) {
                    console.log('Google Drive: Access token expired, refreshing...');
                    const { credentials } = await this.oAuth2Client.refreshAccessToken();
                    this.oAuth2Client.setCredentials(credentials);
                    fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
                    console.log('Google Drive: Token refreshed successfully.');
                } else if (isExpired) {
                    // No refresh token — user must re-authenticate
                    console.warn('Google Drive: Token expired and no refresh_token present. Re-auth required.');
                    return false;
                }

                return true;
            }
        } catch (error) {
            console.error('Error loading/refreshing tokens', error);
        }
        return false;
    }

    async logout(): Promise<void> {
        if (fs.existsSync(TOKEN_PATH)) {
            fs.unlinkSync(TOKEN_PATH);
        }
    }

    /**
     * Upload a JSON string as a file to a specific folder (created if missing).
     */
    async uploadFile(filename: string, content: string): Promise<boolean> {
        try {
            // Fix #4: was missing `await` — auth check was being bypassed entirely
            if (!(await this.checkconnection()) || !this.oAuth2Client) {
                throw new Error("Not authenticated");
            }

            const drive = google.drive({ version: 'v3', auth: this.oAuth2Client });

            // 1. Find or Create "BillingApp_Backups" folder
            let folderId = await this.findFolderId(drive, 'BillingApp_Backups');
            if (!folderId) {
                folderId = await this.createFolder(drive, 'BillingApp_Backups');
            }

            // 2. Upload File
            const fileMetadata = {
                name: filename,
                parents: [folderId!]
            };
            const media = {
                mimeType: 'application/json',
                body: content
            };

            await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id'
            });

            return true;
        } catch (error) {
            console.error('Upload failed:', error);
            // If token expired, logic to refresh is built-in to oAuth2Client if refresh_token is present
            return false;
        }
    }

    private async findFolderId(drive: any, name: string): Promise<string | null> {
        const res = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        if (res.data.files && res.data.files.length > 0) {
            return res.data.files[0].id;
        }
        return null;
    }

    private async createFolder(drive: any, name: string): Promise<string> {
        const fileMetadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder'
        };
        const res = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id'
        });
        return res.data.id;
    }
}
