import * as forge from 'node-forge';
import { format } from 'date-fns';
import type { Invoice } from './db';

// --- Types ---
interface BusinessDetails {
    gstin: string; // VAT Number
    name: string;
    address: string;
    streetName?: string;
    buildingNumber?: string;
    plotIdentification?: string;
    citySubdivisionName?: string;
    cityName?: string;
    postalZone?: string;
    countrySubentity?: string; // Province
}

// --- CONSTANTS ---
const UBL_URN = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
const CAC_URI = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const CBC_URI = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const EXT_URI = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
const SIG_URI = 'urn:nfi:zatca:ti:signature:1';
// Simplified Invoice (B2C) Profile
const PROFILE_ID = 'reporting:1.0';
const INVOICE_TYPE_CODE = '388'; // 388 = Tax Invoice (generic), ZATCA uses subtypes. 
// For Simplified: 0200000 (Simplified)
const SUBTYPE_SIMPLIFIED = '0200000';

export const generateZatcaXML = async (
    invoice: Invoice,
    business: BusinessDetails,
    privateKeyPem: string,
    previousInvoiceHash: string = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=' // Base64 of 0x0
): Promise<{ xml: string; hash: string; qr: string; uuid: string }> => {

    // 1. Prepare Data
    const issueDate = format(new Date(invoice.createdAt), 'yyyy-MM-dd');
    const issueTime = format(new Date(invoice.createdAt), 'HH:mm:ss');
    const vatNumber = business.gstin;

    // Default Address if missing detailed fields (best effort mapping)
    const street = business.streetName || business.address || 'Unknown Street';
    const building = business.buildingNumber || '0000';
    const district = business.citySubdivisionName || 'District';
    const city = business.cityName || 'Riyadh';
    const zip = business.postalZone || '00000';

    // Totals
    const totalTax = invoice.taxAmount;
    const totalAmount = invoice.grandTotal;
    const subTotal = invoice.subTotal;

    // 2. Build Unsigned XML (Simplified)
    // NOTE: Strictly this should follow ZATCA UBL templates. 
    // This is a minimal valid implementation for key elements to be signed.

    // Generate UUID once
    const uuid = generateUUID();

    const unsignedXML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${UBL_URN}" xmlns:cac="${CAC_URI}" xmlns:cbc="${CBC_URI}" xmlns:ext="${EXT_URI}">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>
    <cbc:ID>${invoice.invoiceNumber}</cbc:ID>
    <cbc:UUID>${uuid}</cbc:UUID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:IssueTime>${issueTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="${SUBTYPE_SIMPLIFIED}">${INVOICE_TYPE_CODE}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${invoice.id || 1}</cbc:UUID> 
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${previousInvoiceHash}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${business.gstin}</cbc:ID> 
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>${business.name}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${street}</cbc:StreetName>
                <cbc:BuildingNumber>${building}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>${district}</cbc:CitySubdivisionName>
                <cbc:CityName>${city}</cbc:CityName>
                <cbc:PostalZone>${zip}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>SA</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${vatNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${business.name}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${totalTax.toFixed(2)}</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="SAR">${subTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="SAR">${subTotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="SAR">${totalAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
        <cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount>
        <cbc:PayableAmount currencyID="SAR">${totalAmount.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
</Invoice>`;

    // 3. Hash the XML
    const md = forge.md.sha256.create();
    md.update(unsignedXML, 'utf8');
    const hashHex = md.digest().toHex();
    const hashBase64 = forge.util.encode64(forge.util.hexToBytes(hashHex));

    // 4. Sign the Hash
    let signatureBase64 = '';
    try {
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
        const mdSign = forge.md.sha256.create();
        mdSign.update(hashBase64, 'utf8');
        const signature = (privateKey as any).sign(mdSign);
        signatureBase64 = forge.util.encode64(signature);
    } catch (e) {
        console.error("Signing failed", e);
        signatureBase64 = "SIGNATURE_FAILED";
    }

    // 5. Generate QR Data
    const tlv = generateZatcaTLV(
        business.name,
        vatNumber,
        new Date(invoice.createdAt).toISOString(),
        totalAmount.toFixed(2),
        totalTax.toFixed(2),
        hashBase64,
        signatureBase64,
    );

    // QR is Base64 of the TLV bytes
    const qrText = tlv;

    return {
        xml: unsignedXML.replace('<cac:AdditionalDocumentReference>', `
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
    <cac:AdditionalDocumentReference>`),
        hash: hashBase64,
        qr: qrText,
        uuid: uuid
    };
};

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateZatcaTLV(
    seller: string,
    vat: string,
    time: string,
    total: string,
    tax: string,
    hash: string,
    signature: string
): string {
    const tags = [
        { id: 1, val: seller },
        { id: 2, val: vat },
        { id: 3, val: time },
        { id: 4, val: total },
        { id: 5, val: tax },
        { id: 6, val: hash },
        { id: 7, val: signature }
    ];

    const arrays: Uint8Array[] = [];
    tags.forEach(t => {
        const encoder = new TextEncoder();
        const valBytes = encoder.encode(t.val);
        const tag = new Uint8Array([t.id, valBytes.length]);
        arrays.push(tag);
        arrays.push(valBytes);
    });

    // Merge
    let totalLen = 0;
    arrays.forEach(a => totalLen += a.length);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    arrays.forEach(a => {
        result.set(a, offset);
        offset += a.length;
    });

    // Base64
    let binary = '';
    for (let i = 0; i < result.length; i++) binary += String.fromCharCode(result[i]);
    return btoa(binary);
}
