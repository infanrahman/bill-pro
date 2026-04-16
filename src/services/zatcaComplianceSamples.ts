/**
 * Generates a minimal ZATCA-compliant sample invoice for the compliance check phase.
 * This is used internally by the "Go Live" automation.
 */

import * as forge from 'node-forge';
import { format } from 'date-fns';

interface ComplianceSampleOptions {
    sellerName: string;
    vatNumber: string;
    privateKeyPem: string;
    invoiceIndex?: number; // 1, 2, 3 for the 3 required samples
}

export interface SampleInvoice {
    xml: string;
    hash: string;
    uuid: string;
}

const UBL_URN = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
const CAC_URI = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const CBC_URI = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const EXT_URI = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
const SIG_URI = 'urn:nfi:zatca:ti:signature:1';

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function tlvBase64(seller: string, vat: string, time: string, total: string, tax: string, hash: string, sig: string) {
    const tags = [
        { id: 1, val: seller },
        { id: 2, val: vat },
        { id: 3, val: time },
        { id: 4, val: total },
        { id: 5, val: tax },
        { id: 6, val: hash },
        { id: 7, val: sig },
    ];

    const arrays: Uint8Array[] = [];
    tags.forEach((t) => {
        const enc = new TextEncoder();
        const valBytes = enc.encode(t.val);
        arrays.push(new Uint8Array([t.id, valBytes.length]));
        arrays.push(valBytes);
    });

    const totalLen = arrays.reduce((s, a) => s + a.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    arrays.forEach((a) => { result.set(a, offset); offset += a.length; });

    let bin = '';
    for (let i = 0; i < result.length; i++) bin += String.fromCharCode(result[i]);
    return btoa(bin);
}

export const generateComplianceSampleInvoice = async (opts: ComplianceSampleOptions): Promise<SampleInvoice> => {
    const now = new Date();
    const issueDate = format(now, 'yyyy-MM-dd');
    const issueTime = format(now, 'HH:mm:ss');
    const uuid = generateUUID();
    const total = (100 * (opts.invoiceIndex || 1)).toFixed(2);
    const tax = (15 * (opts.invoiceIndex || 1)).toFixed(2);
    const subTotal = (85 * (opts.invoiceIndex || 1)).toFixed(2);
    const prevHash = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';

    const unsignedXML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${UBL_URN}" xmlns:cac="${CAC_URI}" xmlns:cbc="${CBC_URI}" xmlns:ext="${EXT_URI}">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>COMPLIANCE-SAMPLE-${opts.invoiceIndex || 1}</cbc:ID>
    <cbc:UUID>${uuid}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${opts.invoiceIndex || 1}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${prevHash}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${opts.vatNumber}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>${opts.sellerName}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>Main Street</cbc:StreetName>
                <cbc:BuildingNumber>1234</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>Al Olaya</cbc:CitySubdivisionName>
                <cbc:CityName>Riyadh</cbc:CityName>
                <cbc:PostalZone>12345</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>SA</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${opts.vatNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${opts.sellerName}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${tax}</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">${subTotal}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">${subTotal}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">${total}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
        <cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount>
        <cbc:PayableAmount currencyID="SAR">${total}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
</Invoice>`;

    // Hash the XML
    const md = forge.md.sha256.create();
    md.update(unsignedXML, 'utf8');
    const hashHex = md.digest().toHex();
    const hashBase64 = forge.util.encode64(forge.util.hexToBytes(hashHex));

    // Sign
    let signatureBase64 = '';
    try {
        const privateKey = forge.pki.privateKeyFromPem(opts.privateKeyPem);
        const mdSign = forge.md.sha256.create();
        mdSign.update(hashBase64, 'utf8');
        const signature = (privateKey as any).sign(mdSign);
        signatureBase64 = forge.util.encode64(signature);
    } catch (e) {
        console.error('Signing failed', e);
        signatureBase64 = 'SIGNATURE_FAILED';
    }

    // Generate TLV QR
    tlvBase64(opts.sellerName, opts.vatNumber, now.toISOString(), total, tax, hashBase64, signatureBase64);

    // Build signed XML
    const signedXml = unsignedXML.replace('<cac:AdditionalDocumentReference>', `
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionURI>${SIG_URI}</ext:ExtensionURI>
            <ext:ExtensionContent>
                <UBLDocumentSignatures xmlns="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2">
                    <SignatureInformation>
                        <ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:1</ReferencedSignatureID>
                        <ID>urn:oasis:names:specification:ubl:signature:1</ID>
                        <SignatureHash>${hashBase64}</SignatureHash>
                        <SignatureValue>${signatureBase64}</SignatureValue>
                    </SignatureInformation>
                </UBLDocumentSignatures>
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    <cac:AdditionalDocumentReference>`);

    return { xml: signedXml, hash: hashBase64, uuid };
};
