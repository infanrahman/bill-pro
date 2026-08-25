import { ZatcaService } from '../electron/services/zatcaService.js';
import crypto from 'crypto';

(async () => {
    try {
        const service = new ZatcaService();
        
        console.log("Generating CSR...");
        const result = await service.generateCSR({
            commonName: 'مطعم منيرة محمد سعيد الشهراتي لتقديم الوجبات', // Wait, CN is overridden by VAT internally?
            organizationName: 'مطعم منيرة محمد سعيد الشهراتي لتقديم الوجبات',
            organizationUnitName: '310935949100003',
            countryName: 'SA',
            serialNumber: crypto.randomUUID(),
            registeredAddress: 'Muhayil', // Fallback address
            businessCategory: 'Retail',   // Fallback category
            vatNumber: '310935949100003',
            environment: 'PRODUCTION'
        });

        console.log("CSR Generation Successful!");
        console.log("CSR Output Preview:", result.csr.substring(0, 100) + '...');
        console.log("\nIf this succeeded, then there are no OpenSSL encoding issues with the provided details.");
    } catch (e) {
        console.error("CSR Generation Failed!");
        console.error(e);
    }
})();
