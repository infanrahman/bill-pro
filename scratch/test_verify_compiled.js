const { LicenseService } = require('../dist-electron/services/licenseService');

// Instantiate service
const service = new LicenseService();

const testKey = 'eyJtaWQiOiJlOGYxMmE4ZTdiNzE2NzFlMGYwOWE2Y2VmNjExODUwZjFkMDRmNWJmZTZjYzQyYWRhMWZlNzkyMThlMzE1MTYyIiwiZXhwIjoxODE1MTI2MTg0ODM2LCJ0eXBlIjoicHJvIn0=:cEpv9v5npBi64z6kipWmPih3NvFlGFKoXsP4A974TIy6t9B7pTJRZloWJ7o5BChjrj07S54orGimuJ1vZL7h6WeZIzEobeYBM8SiNa+W9INsfE2RULCtU7he5wjN+5ZQVL3/lqRbigzQvXaVuuLPyiZMrIDPhrUTUfuQ4owGpbgX1H5I+RFBZL/5OnQDSukCWDHJQ/91nNmXN9XC+1RpP3RKB8j8Q8OuXfHGy3MmH8sPKpn2MgFQrmxUtWr54NWleb85tPDoVmz3Zim22k3yUPLX1PZjLcd3DTnZTiLi0dhpvtv5LT74hPN7PkwG1yEdkMdspPgWnkprv8ivMPg/Xg==';

console.log('Current Machine ID from service:', service.currentMachineId);

// Test activate
try {
    const result = service.activate(testKey);
    console.log('Activation result:', result ? '✓ SUCCESS' : '❌ FAILED');
} catch (e) {
    console.error('Error during activation:', e);
}
