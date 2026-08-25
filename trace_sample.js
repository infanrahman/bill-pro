require('ts-node').register({ transpileOnly: true });

const { ZatcaService } = require('./electron/services/zatcaService');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

async function run() {
    // Read the ZATCA config directly to get real keys
    // wait, we can't do this easily outside electron if it uses safeStorage
    // But safeStorage is optional: `safeStorage.isEncryptionAvailable()` will return false
    // so we can mock safeStorage
}
run();
