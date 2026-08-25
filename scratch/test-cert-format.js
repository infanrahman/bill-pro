import crypto from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';

execSync('openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=Test"');
const cert = fs.readFileSync('cert.pem', 'utf8');

const stripped = cert.replace(/-----BEGIN CERTIFICATE-----/, '').replace(/-----END CERTIFICATE-----/, '').replace(/\s+/g, '');
const badCert = `-----BEGIN CERTIFICATE-----\n${stripped}\n-----END CERTIFICATE-----`;

try {
    const x509 = new crypto.X509Certificate(badCert);
    console.log("X509 parsing success!");
} catch (e) {
    console.error("X509 parsing Failed:", e.message);
}
