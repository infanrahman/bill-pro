const { XMLDocument } = require('zatca-xml-js/lib/parser/index.js');
const signing = require('zatca-xml-js/lib/zatca/signing/index.js');
const crypto = require('crypto');

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"><ext:UBLExtensions>SET_UBL_EXTENSIONS_STRING</ext:UBLExtensions>',
  '    ',
  '    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>',
  '    <cbc:ID>COMPLIANCE-SAMPLE-1</cbc:ID>',
  '    <cbc:UUID>test-uuid-1234</cbc:UUID>',
  '    <cbc:IssueDate>2024-01-01</cbc:IssueDate>',
  '    <cbc:IssueTime>12:00:00</cbc:IssueTime>',
  '    <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>',
  '    <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>',
  '    <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>',
  '    <cac:AdditionalDocumentReference><cbc:ID>ICV</cbc:ID><cbc:UUID>1</cbc:UUID></cac:AdditionalDocumentReference>',
  '    <cac:AdditionalDocumentReference><cbc:ID>PIH</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>',
  '    <cac:AdditionalDocumentReference><cbc:ID>QR</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">SET_QR_CODE_DATA</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>',
  '    <cac:Signature><cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID><cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod></cac:Signature>',
  '    ',
  '    <cac:AccountingSupplierParty>',
  '    <cac:Party>',
  '      <cac:PartyIdentification><cbc:ID schemeID="CRN">1234567890</cbc:ID></cac:PartyIdentification>',
  '      <cac:PostalAddress><cbc:StreetName>Test Street</cbc:StreetName><cbc:BuildingNumber>1234</cbc:BuildingNumber><cbc:CitySubdivisionName>Test</cbc:CitySubdivisionName><cbc:CityName>Riyadh</cbc:CityName><cbc:PostalZone>12345</cbc:PostalZone><cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country></cac:PostalAddress>',
  '      <cac:PartyTaxScheme><cbc:CompanyID>300000000000003</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>',
  '      <cac:PartyLegalEntity><cbc:RegistrationName>Test Seller</cbc:RegistrationName></cac:PartyLegalEntity>',
  '    </cac:Party>',
  '  </cac:AccountingSupplierParty>',
  '  <cac:AccountingCustomerParty></cac:AccountingCustomerParty>',
  '  <cac:TaxTotal><cbc:TaxAmount currencyID="SAR">13.04</cbc:TaxAmount></cac:TaxTotal>',
  '  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="SAR">86.96</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="SAR">86.96</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="SAR">100.00</cbc:TaxInclusiveAmount><cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount><cbc:PayableAmount currencyID="SAR">100.00</cbc:PayableAmount></cac:LegalMonetaryTotal>',
  '  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="PCE">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="SAR">86.96</cbc:LineExtensionAmount><cac:Item><cbc:Name>Test Item</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="SAR">86.96</cbc:PriceAmount></cac:Price></cac:InvoiceLine>',
  '</Invoice>'
].join('\n');

try {
  console.log('exports:', Object.keys(signing));
  const doc = new XMLDocument(xml);
  const step1 = doc.toString({ no_header: false });
  console.log('\nXMLBuilder first line:', step1.split('\n')[0]);
  console.log('XMLBuilder second line:', step1.split('\n')[1]);
  const pure = signing.getPureInvoiceString(doc);
  console.log('\nC14N first 1000:');
  console.log(pure.substring(0, 1000));
  console.log('\n<cbc:ProfileID> literal:', pure.includes('<cbc:ProfileID>'));
  console.log('<cbc:ProfileID xmlns:', pure.includes('<cbc:ProfileID xmlns'));
  console.log('<cac:AccountingSupplierParty> literal:', pure.includes('<cac:AccountingSupplierParty>'));
  const h = signing.getInvoiceHash(doc);
  console.log('\nhash:', h);
} catch(e) { console.error(e.stack); }
