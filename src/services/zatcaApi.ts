import * as forge from 'node-forge';

// ZATCA Endpoints
const ZATCA_SIMULATION_URL = 'https://gw-apic-gov.gazt.gov.sa/e-invoicing/simulation';
const ZATCA_PRODUCTION_URL = 'https://gw-apic-gov.gazt.gov.sa/e-invoicing/core';

export type ZatcaEnvironment = 'SIMULATION' | 'PRODUCTION';

export interface CsrOptions {
    commonName: string;
    organizationName: string;
    organizationUnitName: string;
    countryName: string;
    serialNumber: string;
    registeredAddress: string;
    businessCategory: string;
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
    environment: ZatcaEnvironment;
}

const getBaseUrl = (env: ZatcaEnvironment = 'PRODUCTION') =>
    env === 'PRODUCTION' ? ZATCA_PRODUCTION_URL : ZATCA_SIMULATION_URL;

// 1. Generate CSR and Private Key
export const generateCSR = (options: CsrOptions): Promise<{ csr: string; privateKey: string }> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const keys = forge.pki.rsa.generateKeyPair(2048);
                const csr = forge.pki.createCertificationRequest();
                csr.publicKey = keys.publicKey;

                csr.setSubject([
                    { name: 'commonName', value: options.commonName },
                    { name: 'organizationName', value: options.organizationName },
                    { name: 'organizationalUnitName', value: options.organizationUnitName },
                    { name: 'countryName', value: options.countryName },
                    { name: 'serialNumber', value: options.serialNumber },
                ]);

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

// 2. Request Compliance CSID (Step 1 — works on both Simulation and Production)
export const requestComplianceCSID = async (
    otp: string,
    csr: string,
    env: ZatcaEnvironment = 'PRODUCTION'
): Promise<{ csid: string; secret: string; requestId: string }> => {
    const cleanCsr = csr
        .replace('-----BEGIN CERTIFICATE REQUEST-----', '')
        .replace('-----END CERTIFICATE REQUEST-----', '')
        .replace(/\n/g, '');

    const response = await fetch(`${getBaseUrl(env)}/compliance`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'OTP': otp,
            'Accept-Language': 'en',
            'api-version': 'V2',
        },
        body: JSON.stringify({ csr: cleanCsr }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ZATCA Compliance Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
        csid: data.binarySecurityToken,
        secret: data.secret,
        requestId: data.requestID,
    };
};

// 3. Run Compliance Checks (send 3 auto-generated sample invoices)
export const runComplianceChecks = async (
    csid: string,
    secret: string,
    sampleInvoices: Array<{ xml: string; hash: string; uuid: string }>,
    env: ZatcaEnvironment = 'PRODUCTION'
): Promise<boolean> => {
    const auth = btoa(`${csid}:${secret}`);
    const baseUrl = getBaseUrl(env);

    for (const inv of sampleInvoices) {
        const encodedXml = btoa(unescape(encodeURIComponent(inv.xml)));

        const response = await fetch(`${baseUrl}/compliance/invoices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': 'en',
                'api-version': 'V2',
                'Authorization': `Basic ${auth}`,
            },
            body: JSON.stringify({
                invoiceHash: inv.hash,
                uuid: inv.uuid,
                invoice: encodedXml,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Compliance check failed (${response.status}): ${err}`);
        }

        const data = await response.json();
        const errors = data?.validationResults?.errorMessages ?? [];
        if (errors.length > 0) {
            throw new Error(`ZATCA validation errors: ${JSON.stringify(errors)}`);
        }
    }

    return true;
};

// 4. Get Production CSID (exchanges compliance certificate for production)
export const getProductionCSID = async (
    requestId: string,
    csid: string,
    secret: string,
    env: ZatcaEnvironment = 'PRODUCTION'
): Promise<{ productionCsid: string; productionSecret: string }> => {
    const auth = btoa(`${csid}:${secret}`);

    const response = await fetch(`${getBaseUrl(env)}/production/csids`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept-Language': 'en',
            'api-version': 'V2',
            'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify({ compliance_request_id: requestId }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Production CSID Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
        productionCsid: data.binarySecurityToken,
        productionSecret: data.secret,
    };
};

// 5. Report Invoice (Simplified/B2C) to ZATCA
export const reportInvoice = async (
    invoiceXml: string,
    invoiceHash: string,
    uuid: string,
    csid: string,
    secret: string,
    env: ZatcaEnvironment = 'PRODUCTION'
): Promise<{ status: string; validationResults?: any }> => {
    const auth = btoa(`${csid}:${secret}`);
    const encodedXml = btoa(unescape(encodeURIComponent(invoiceXml)));

    const response = await fetch(`${getBaseUrl(env)}/invoices/reporting/single`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept-Language': 'en',
            'api-version': 'V2',
            'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify({
            invoiceHash,
            uuid,
            invoice: encodedXml,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('ZATCA Reporting Error:', data);
        return { status: 'ERROR', validationResults: data };
    }

    return {
        status: data.reportingStatus,
        validationResults: data.validationResults,
    };
};
