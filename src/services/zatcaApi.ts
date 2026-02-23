import * as forge from 'node-forge';

// ZATCA Constants
// const ZATCA_SANDBOX_URL = 'https://gw-apic-gov.gazt.gov.sa/e-invoicing/developer-portal';
const ZATCA_SIMULATION_URL = 'https://gw-apic-gov.gazt.gov.sa/e-invoicing/simulation';
// const ZATCA_PRODUCTION_URL = 'https://gw-apic-gov.gazt.gov.sa/e-invoicing/core';

// Environment Selection (Default to Simulation/Sandbox)
const BASE_URL = ZATCA_SIMULATION_URL;

export interface CsrOptions {
    commonName: string; // TSZ
    organizationName: string; // GON
    organizationUnitName: string; // GOU
    countryName: string; // C
    serialNumber: string; // SN (1-VAT|2-UUID|3-InvoiceType) e.g. 1-3000...|2-...|3-1000
    registeredAddress: string; // Registered Address
    businessCategory: string; // Business Category
}

export interface ZatcaConfig {
    csr: string;
    privateKey: string;
    complianceCsid?: string;
    complianceSecret?: string;
    productionCsid?: string;
    productionSecret?: string;
    requestId?: string;
    status: 'NOT_ONBOARDED' | 'CSR_GENERATED' | 'COMPLIANCE_OBTAINED' | 'CHECKED' | 'LIVE';
}

// 1. Generate CSR and Private Key
export const generateCSR = (options: CsrOptions): Promise<{ csr: string; privateKey: string }> => {
    return new Promise((resolve, reject) => {
        // Use setTimeout to allow UI to update loading state before blocking
        setTimeout(() => {
            try {
                // Generate Key Pair
                const keys = forge.pki.rsa.generateKeyPair(2048);
                const csr = forge.pki.createCertificationRequest();
                csr.publicKey = keys.publicKey;

                // Set Attributes
                csr.setSubject([
                    { name: 'commonName', value: options.commonName },
                    { name: 'organizationName', value: options.organizationName },
                    { name: 'organizationalUnitName', value: options.organizationUnitName },
                    { name: 'countryName', value: options.countryName },
                    { name: 'serialNumber', value: options.serialNumber },
                ]);

                // Sign CSR
                csr.sign(keys.privateKey);

                const pemCsr = forge.pki.certificationRequestToPem(csr);
                const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

                resolve({ csr: pemCsr, privateKey: pemKey });
            } catch (error) {
                reject(error);
            }
        }, 100);
    });
};

// 2. Request Compliance CSID (Onboarding)
export const requestComplianceCSID = async (otp: string, csr: string): Promise<{ csid: string; secret: string; requestId: string }> => {

    // Clean CSR for API (remove headers)
    const cleanCsr = csr.replace('-----BEGIN CERTIFICATE REQUEST-----', '')
        .replace('-----END CERTIFICATE REQUEST-----', '')
        .replace(/\n/g, '');

    console.log("Requesting Compliance CSID with OTP:", otp);

    const response = await fetch(`${BASE_URL}/compliance`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'OTP': otp,
            'Accept-Language': 'en',
            'api-version': 'V2'
        },
        body: JSON.stringify({ csr: cleanCsr })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("ZATCA Compliance Error:", errorText);
        throw new Error(`ZATCA Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("ZATCA Compliance Success:", data);

    return {
        csid: data.binarySecurityToken,
        secret: data.secret,
        requestId: data.requestID
    };
};

// 3. Report Invoice (Simplified/B2C)
export const reportInvoice = async (
    invoiceXml: string,
    invoiceHash: string,
    uuid: string,
    csid: string,
    secret: string
): Promise<{ status: string; validationResults?: any }> => {

    // Basic Auth
    const auth = btoa(`${csid}:${secret}`);

    // Encode XML to Base64
    const encodedXml = btoa(unescape(encodeURIComponent(invoiceXml)));

    const body = {
        invoiceHash: invoiceHash,
        uuid: uuid,
        invoice: encodedXml
    };

    const response = await fetch(`${BASE_URL}/invoices/reporting/single`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept-Language': 'en',
            'api-version': 'V2',
            'Authorization': `Basic ${auth}`,
            // 'Clearance-Status': '1' // Not needed for B2C Reporting, only B2B Clearance
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("ZATCA Reporting Error:", data);
        return {
            status: 'ERROR',
            validationResults: data
        };
    }

    // Check validation results
    // "reportingStatus": "REPORTED",
    // "validationResults": { "infoMessages": [], "warningMessages": [], "errorMessages": [] }

    return {
        status: data.reportingStatus,
        validationResults: data.validationResults
    };
};
