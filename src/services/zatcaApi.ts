import * as forge from 'node-forge';

// ZATCA Endpoints
const ZATCA_SIMULATION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation';
const ZATCA_PRODUCTION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core';

export type ZatcaEnvironment = 'SIMULATION' | 'PRODUCTION';

export interface CsrOptions {
 commonName: string;
 organizationName: string;
 organizationUnitName: string;
 countryName: string;
 serialNumber: string;
 registeredAddress: string;
 businessCategory: string;
 vatNumber?: string;
 environment?: ZatcaEnvironment;
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

const fetchZatca = async (url: string, options: any) => {
 if (typeof window !== 'undefined' && (window as any).electron?.zatca?.request) {
 const response = await (window as any).electron.zatca.request({ url, ...options });
 if (!response.ok) {
 return {
 ok: false,
 status: response.status,
 text: async () => response.text,
 json: async () => { try { return JSON.parse(response.text); } catch { return {}; } }
 };
 }
 return {
 ok: true,
 status: response.status,
 text: async () => response.text,
 json: async () => JSON.parse(response.text)
 };
 } else {
 return await fetch(url, options);
 }
};

// 1. Generate CSR and Private Key
export const generateCSR = (options: CsrOptions): Promise<{ csr: string; privateKey: string }> => {
 // Must run in Electron — OpenSSL generates a correct EC P-256 (secp256r1) key in SEC1 PEM format.
 // ZATCA only accepts EC keys. The old node-forge fallback generated RSA 2048-bit keys which
 // caused the"DECODE_ERROR"during signing. It is intentionally removed.
 if (typeof window !== 'undefined' && (window as any).electron?.zatca?.generateCSR) {
 return (window as any).electron.zatca.generateCSR(options);
 }

 // Hard fail — never silently produce an RSA key
 return Promise.reject(
 new Error(
 'ZATCA CSR generation requires the Electron desktop app. ' +
 'Please run the application via"npm run dev"(not a plain browser). ' +
 'Generating RSA keys here would cause signing failures downstream.'
)
);
};

const parseZatcaError = (text: string): string => {
 try {
 const parsed = JSON.parse(text);
 if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
 return parsed.errors.map((e: any) => e.message || e.code).join(', ');
 }
 return parsed.message || text;
 } catch {
 return text;
 }
};

// 2. Request Compliance CSID (Step 1 — works on both Simulation and Production)
export const requestComplianceCSID = async (
 otp: string,
 csr: string,
 env: ZatcaEnvironment = 'PRODUCTION'
): Promise<{ csid: string; secret: string; requestId: string }> => {
 const cleanCsr = (typeof btoa !== 'undefined' 
 ? btoa(csr) 
 : Buffer.from(csr).toString('base64')
).replace(/\s+/g, '');

 const response = await fetchZatca(`${getBaseUrl(env)}/compliance`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'OTP': otp,
 'Accept-Language': 'en',
 'Accept-Version': 'V2',
 },
 body: JSON.stringify({ csr: cleanCsr }),
 });

 if (!response.ok) {
 const errorText = await response.text();
 const cleanMessage = parseZatcaError(errorText);
 throw new Error(`ZATCA Compliance Error (${response.status}): ${cleanMessage}`);
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

 const response = await fetchZatca(`${baseUrl}/compliance/invoices`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Accept-Language': 'en',
 'Accept-Version': 'V2',
 'Authorization':`Basic ${auth}`,
 },
 body: JSON.stringify({
 invoiceHash: inv.hash,
 uuid: inv.uuid,
 invoice: encodedXml,
 }),
 });

 if (!response.ok) {
 const err = await response.text();
 const cleanMessage = parseZatcaError(err);
 throw new Error(`Compliance check failed (${response.status}): ${cleanMessage}`);
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

 const response = await fetchZatca(`${getBaseUrl(env)}/production/csids`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Accept-Language': 'en',
 'Accept-Version': 'V2',
 'Authorization':`Basic ${auth}`,
 },
 body: JSON.stringify({ compliance_request_id: requestId }),
 });

 if (!response.ok) {
 const errorText = await response.text();
 const cleanMessage = parseZatcaError(errorText);
 throw new Error(`Production CSID Error (${response.status}): ${cleanMessage}`);
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

 const response = await fetchZatca(`${getBaseUrl(env)}/invoices/reporting/single`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Accept-Language': 'en',
 'Accept-Version': 'V2',
 'Authorization':`Basic ${auth}`,
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
