// Mock electron
const m = require('module');
const originalLoader = m._load;
m._load = function (request, parent, isMain) {
    if (request === 'electron') {
        return {
            app: {
                getAppPath: () => __dirname
            },
            safeStorage: {
                isEncryptionAvailable: () => false,
                encryptString: (str) => Buffer.from(str),
                decryptString: (buf) => buf.toString()
            }
        };
    }
    return originalLoader(request, parent, isMain);
};

const fs = require('fs');
const { ZatcaService } = require('./electron/services/zatcaService');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Generate a valid RSA cert that will pass X509Certificate parsing
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Since node doesn't have an easy way to create a self-signed cert from this key in pure JS without node-forge,
// and openssl failed, let's just use a hardcoded valid cert. I will generate one in python!
