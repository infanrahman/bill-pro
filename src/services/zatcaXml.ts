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
// Simplified Invoice (B2C) Profile
const PROFILE_ID = 'reporting:1.0';
// For Simplified: 0200000 (Simplified)
const SUBTYPE_SIMPLIFIED = '0211010';

export const generateZatcaXML = async (
 invoice: Invoice,
 business: BusinessDetails,
 privateKeyPem: string,
 certificatePem: string,
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

 // Generate UUID once
 const uuid = generateUUID();

 const invoiceTypeCode = invoice.type === 'return' ? '381' : '388';
 const subtypeCode = SUBTYPE_SIMPLIFIED;

 const unsignedXML =`<?xml version="1.0"encoding="UTF-8"?>
<Invoice xmlns="${UBL_URN}"xmlns:cac="${CAC_URI}"xmlns:cbc="${CBC_URI}"xmlns:ext="${EXT_URI}"><ext:UBLExtensions>SET_UBL_EXTENSIONS_STRING</ext:UBLExtensions>
 
 <cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>
 <cbc:ID>${invoice.invoiceNumber}</cbc:ID>
 <cbc:UUID>${uuid}</cbc:UUID>
 <cbc:IssueDate>${issueDate}</cbc:IssueDate>
 <cbc:IssueTime>${issueTime}</cbc:IssueTime>
 <cbc:InvoiceTypeCode name="${subtypeCode}">${invoiceTypeCode}</cbc:InvoiceTypeCode>
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
 <cac:AdditionalDocumentReference>
 <cbc:ID>QR</cbc:ID>
 <cac:Attachment>
 <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">SET_QR_CODE_DATA</cbc:EmbeddedDocumentBinaryObject>
 </cac:Attachment>
 </cac:AdditionalDocumentReference>
 <cac:Signature>
 <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
 <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
 </cac:Signature>
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
 <cac:TaxSubtotal>
 <cbc:TaxableAmount currencyID="SAR">${subTotal.toFixed(2)}</cbc:TaxableAmount>
 <cbc:TaxAmount currencyID="SAR">${totalTax.toFixed(2)}</cbc:TaxAmount>
 <cac:TaxCategory>
 <cbc:ID>S</cbc:ID>
 <cbc:Percent>15.00</cbc:Percent>
 <cac:TaxScheme>
 <cbc:ID>VAT</cbc:ID>
 </cac:TaxScheme>
 </cac:TaxCategory>
 </cac:TaxSubtotal>
 </cac:TaxTotal>
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
 ${invoice.items.map((item, index) => {
 const taxableAmount = item.netAmount || (item.price * item.quantity);
 const unitPriceExclusive = taxableAmount / item.quantity;
 return`
 <cac:InvoiceLine>
 <cbc:ID>${index + 1}</cbc:ID>
 <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
 <cbc:LineExtensionAmount currencyID="SAR">${taxableAmount.toFixed(2)}</cbc:LineExtensionAmount>
 <cac:TaxTotal>
 <cbc:TaxAmount currencyID="SAR">${(item.taxAmount || 0).toFixed(2)}</cbc:TaxAmount>
 <cac:TaxSubtotal>
 <cbc:TaxableAmount currencyID="SAR">${taxableAmount.toFixed(2)}</cbc:TaxableAmount>
 <cbc:TaxAmount currencyID="SAR">${(item.taxAmount || 0).toFixed(2)}</cbc:TaxAmount>
 <cac:TaxCategory>
 <cbc:ID>S</cbc:ID>
 <cbc:Percent>${(item.taxRate || 15).toFixed(2)}</cbc:Percent>
 <cac:TaxScheme>
 <cbc:ID>VAT</cbc:ID>
 </cac:TaxScheme>
 </cac:TaxCategory>
 </cac:TaxSubtotal>
 </cac:TaxTotal>
 <cac:Item>
 <cbc:Name>${item.name}</cbc:Name>
 <cac:ClassifiedTaxCategory>
 <cbc:ID>S</cbc:ID>
 <cbc:Percent>${(item.taxRate || 15).toFixed(2)}</cbc:Percent>
 <cac:TaxScheme>
 <cbc:ID>VAT</cbc:ID>
 </cac:TaxScheme>
 </cac:ClassifiedTaxCategory>
 </cac:Item>
 <cac:Price>
 <cbc:PriceAmount currencyID="SAR">${unitPriceExclusive.toFixed(2)}</cbc:PriceAmount>
 </cac:Price>
 </cac:InvoiceLine>`;
 }).join('')}
</Invoice>`;

 let signedXml = '';
 let hashBase64 = '';
 let qrText = '';

 try {
 if (typeof window !== 'undefined' && (window as any).electron?.zatca?.signInvoiceXml) {
 const result = await (window as any).electron.zatca.signInvoiceXml(unsignedXML, certificatePem, privateKeyPem);
 signedXml = result.signedXml;
 hashBase64 = result.hash;
 qrText = result.qr;
 } else {
 console.log('Running in browser - returning mock signature');
 signedXml = unsignedXML.replace('SET_UBL_EXTENSIONS_STRING', '<mock>Signature</mock>').replace('SET_QR_CODE_DATA', 'MOCK_QR');
 hashBase64 = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';
 qrText = 'MOCK_QR';
 }
 } catch (e) {
 console.error('ZATCA signing failed:', e);
 throw e;
 }

 return {
 xml: signedXml,
 hash: hashBase64,
 qr: qrText,
 uuid: uuid
 };
};

function generateUUID() {
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
 const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
 return v.toString(16);
 });
}
