/**
 * Generates a minimal ZATCA-compliant sample invoice for the compliance check phase.
 * This is used internally by the"Go Live"automation.
 */

import { format } from 'date-fns';

interface ComplianceSampleOptions {
 sellerName: string;
 vatNumber: string;
 privateKeyPem: string;
 complianceCsid: string;
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

function generateUUID() {
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
 const r = (Math.random() * 16) | 0;
 const v = c === 'x' ? r : (r & 0x3) | 0x8;
 return v.toString(16);
 });
}

export const generateComplianceSampleInvoice = async (opts: ComplianceSampleOptions): Promise<SampleInvoice> => {
 const now = new Date();
 const issueDate = format(now, 'yyyy-MM-dd');
 const issueTime = format(now, 'HH:mm:ss');
 const uuid = generateUUID();
 const idx = opts.invoiceIndex || 1;

 const total = (100 * idx).toFixed(2);
 const tax = (13.04 * idx).toFixed(2); // 15% VAT on taxable amount
 const subTotal = (86.96 * idx).toFixed(2); // taxable amount (excl. VAT)
 const prevHash = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';

 const unsignedXML =`<?xml version="1.0"encoding="UTF-8"?>
<Invoice xmlns="${UBL_URN}"xmlns:cac="${CAC_URI}"xmlns:cbc="${CBC_URI}"xmlns:ext="${EXT_URI}"><ext:UBLExtensions>SET_UBL_EXTENSIONS_STRING</ext:UBLExtensions>
 
 <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
 <cbc:ID>COMPLIANCE-SAMPLE-${idx}</cbc:ID>
 <cbc:UUID>${uuid}</cbc:UUID>
 <cbc:IssueDate>${issueDate}</cbc:IssueDate>
 <cbc:IssueTime>${issueTime}</cbc:IssueTime>
 <cbc:InvoiceTypeCode name="0211010">388</cbc:InvoiceTypeCode>
 <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
 <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
 <cac:AdditionalDocumentReference>
 <cbc:ID>ICV</cbc:ID>
 <cbc:UUID>${idx}</cbc:UUID>
 </cac:AdditionalDocumentReference>
 <cac:AdditionalDocumentReference>
 <cbc:ID>PIH</cbc:ID>
 <cac:Attachment>
 <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${prevHash}</cbc:EmbeddedDocumentBinaryObject>
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
 <cbc:ID schemeID="CRN">1010010000</cbc:ID>
 </cac:PartyIdentification>
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
 <cac:AccountingCustomerParty>
 <cac:Party>
 <cac:PostalAddress>
 <cbc:StreetName>Customer Street</cbc:StreetName>
 <cbc:BuildingNumber>5678</cbc:BuildingNumber>
 <cbc:CitySubdivisionName>Al Malaz</cbc:CitySubdivisionName>
 <cbc:CityName>Riyadh</cbc:CityName>
 <cbc:PostalZone>54321</cbc:PostalZone>
 <cac:Country>
 <cbc:IdentificationCode>SA</cbc:IdentificationCode>
 </cac:Country>
 </cac:PostalAddress>
 <cac:PartyLegalEntity>
 <cbc:RegistrationName>Walk-in Customer</cbc:RegistrationName>
 </cac:PartyLegalEntity>
 </cac:Party>
 </cac:AccountingCustomerParty>
 <cac:TaxTotal>
 <cbc:TaxAmount currencyID="SAR">${tax}</cbc:TaxAmount>
 <cac:TaxSubtotal>
 <cbc:TaxableAmount currencyID="SAR">${subTotal}</cbc:TaxableAmount>
 <cbc:TaxAmount currencyID="SAR">${tax}</cbc:TaxAmount>
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
 <cac:InvoiceLine>
 <cbc:ID>1</cbc:ID>
 <cbc:InvoicedQuantity unitCode="PCE">${idx}</cbc:InvoicedQuantity>
 <cbc:LineExtensionAmount currencyID="SAR">${subTotal}</cbc:LineExtensionAmount>
 <cac:TaxTotal>
 <cbc:TaxAmount currencyID="SAR">${tax}</cbc:TaxAmount>
 <cac:TaxSubtotal>
 <cbc:TaxableAmount currencyID="SAR">${subTotal}</cbc:TaxableAmount>
 <cbc:TaxAmount currencyID="SAR">${tax}</cbc:TaxAmount>
 <cac:TaxCategory>
 <cbc:ID>S</cbc:ID>
 <cbc:Percent>15.00</cbc:Percent>
 <cac:TaxScheme>
 <cbc:ID>VAT</cbc:ID>
 </cac:TaxScheme>
 </cac:TaxCategory>
 </cac:TaxSubtotal>
 </cac:TaxTotal>
 <cac:Item>
 <cbc:Name>Compliance Sample Item ${idx}</cbc:Name>
 <cac:ClassifiedTaxCategory>
 <cbc:ID>S</cbc:ID>
 <cbc:Percent>15.00</cbc:Percent>
 <cac:TaxScheme>
 <cbc:ID>VAT</cbc:ID>
 </cac:TaxScheme>
 </cac:ClassifiedTaxCategory>
 </cac:Item>
 <cac:Price>
 <cbc:PriceAmount currencyID="SAR">${(parseFloat(subTotal) / idx).toFixed(2)}</cbc:PriceAmount>
 </cac:Price>
 </cac:InvoiceLine>
</Invoice>`;

 let signedXml = '';
 let hashBase64 = '';
 try {
 if (typeof window !== 'undefined' && (window as any).electron?.zatca?.signInvoiceXml) {
 const result = await (window as any).electron.zatca.signInvoiceXml(unsignedXML, opts.complianceCsid, opts.privateKeyPem);
 signedXml = result.signedXml;
 hashBase64 = result.hash;
 } else {
 console.log('Running in browser - returning mock signature');
 signedXml = unsignedXML.replace('SET_UBL_EXTENSIONS_STRING', '<mock>Signature</mock>').replace('SET_QR_CODE_DATA', 'MOCK_QR');
 hashBase64 = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';
 }
 } catch (e) {
 console.error('ZATCA compliance sample signing failed:', e);
 throw e;
 }

 return { xml: signedXml, hash: hashBase64, uuid };
};
