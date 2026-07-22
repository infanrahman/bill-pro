const { app, safeStorage } = require('electron');
const { machineIdSync } = require('node-machine-id');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Set path manually to point to the correct user data folder of 'Billing App'
app.setPath('userData', path.join(process.env.APPDATA, 'Billing App'));

app.whenReady().then(() => {
    try {
        const DATA_FILE = 'sys_config';
        const DATA_PATH = path.join(app.getPath('userData'), DATA_FILE);
        console.log('DATA_PATH:', DATA_PATH);

        if (!fs.existsSync(DATA_PATH)) {
            console.log('No sys_config file found!');
            app.quit();
            return;
        }

        const buffer = fs.readFileSync(DATA_PATH);
        console.log('Read sys_config buffer length:', buffer.length);

        let data = null;

        // 1. Try safeStorage
        if (safeStorage.isEncryptionAvailable()) {
            try {
                const json = safeStorage.decryptString(buffer);
                data = JSON.parse(json);
                console.log('Decrypted successfully using safeStorage!');
            } catch (e) {
                console.log('safeStorage decryption failed, trying fallback...');
            }
        }

        // 2. Try Fallback AES
        if (!data && buffer.length >= 17) {
            try {
                const currentMachineId = machineIdSync();
                const fallbackSalt = crypto.createHash('sha256').update(currentMachineId + 'local-salt').digest('hex');
                const iv = buffer.subarray(0, 16);
                const encryptedText = buffer.subarray(16);
                
                const key = crypto.scryptSync(currentMachineId, fallbackSalt, 32);
                const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                let decrypted = decipher.update(encryptedText);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
                data = JSON.parse(decrypted.toString());
                console.log('Decrypted successfully using Fallback AES!');
            } catch (e) {
                console.error('Fallback AES decryption failed:', e);
            }
        }

        console.log('--- Decrypted Data ---');
        console.log(JSON.stringify(data, null, 2));

        console.log('--- Current Machine ID from Node-Machine-Id ---');
        console.log(machineIdSync());

    } catch (err) {
        console.error('Error running script:', err);
    }
    app.quit();
});
