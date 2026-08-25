const { XMLDocument } = require('zatca-xml-js/lib/parser/index.js');
const signing = require('zatca-xml-js/lib/zatca/signing/index.js');
const crypto = require('crypto');

const unsignedXML = <?xml version="1.0" encoding="UTF-8"?>
<Invoice
    xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
 <ext:UBLExtensions>SET_UBL_EXTENSIONS_STRING</ext:UBLExtensions>
 <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
 <cbc:ID>COMPLIANCE-SAMPLE-1</cbc:ID>
 <cbc:UUID>test-uuid-1234</cbc:UUID>
 <cbc:IssueDate>2024-01-01</cbc:IssueDate>
 <cbc:IssueTime>12:00:00</cbc:IssueTime>
 <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
 <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
 <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
 <cac:AdditionalDocumentReference>
  <cbc:ID>ICV</cbc:ID>
  <cbc:UUID>1</cbc:UUID>
 </cac:AdditionalDocumentReference>
 <cac:AdditionalDocumentReference>
  <cbc:ID>PIH</cbc:ID>
  <cac:Attachment>
   <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=</cbc:EmbeddedDocumentBinaryObject>
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
    <cbc:ID schemeID="CRN">1234567890</cbc:ID>
   </cac:PartyIdentification>
   <cac:PostalAddress>
    <cbc:StreetName>Test Street</cbc:StreetName>
    <cbc:BuildingNumber>1234</cbc:BuildingNumber>
    <cbc:CitySubdivisionName>Test District</cbc:CitySubdivisionName>
    <cbc:CityName>Riyadh</cbc:CityName>
    <cbc:PostalZone>12345</cbc:PostalZone>
    <cac:Country>
     <cbc:IdentificationCode>SA</cbc:IdentificationCode>
    </cac:Country>
   </cac:PostalAddress>
   <cac:PartyTaxScheme>
    <cbc:CompanyID>300000000000003</cbc:CompanyID>
    <cac:TaxScheme>
     <cbc:ID>VAT</cbc:ID>
    </cac:TaxScheme>
   </cac:PartyTaxScheme>
   <cac:PartyLegalEntity>
    <cbc:RegistrationName>Test Seller</cbc:RegistrationName>
   </cac:PartyLegalEntity>
  </cac:Party>
 </cac:AccountingSupplierParty>
 <cac:TaxTotal>
  <cbc:TaxAmount currencyID="SAR">13.04</cbc:TaxAmount>
 </cac:TaxTotal>
 <cac:LegalMonetaryTotal>
  <cbc:LineExtensionAmount currencyID="SAR">86.96</cbc:LineExtensionAmount>
  <cbc:TaxExclusiveAmount currencyID="SAR">86.96</cbc:TaxExclusiveAmount>
  <cbc:TaxInclusiveAmount currencyID="SAR">100.00</cbc:TaxInclusiveAmount>
  <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
  <cbc:PayableAmount currencyID="SAR">100.00</cbc:PayableAmount>
 </cac:LegalMonetaryTotal>
 <cac:InvoiceLine>
  <cbc:ID>1</cbc:ID>
  <cbc:InvoicedQuantity unitCode="PCE">1</cbc:InvoicedQuantity>
  <cbc:LineExtensionAmount currencyID="SAR">86.96</cbc:LineExtensionAmount>
  <cac:Item>
   <cbc:Name>Test Item</cbc:Name>
  </cac:Item>
  <cac:Price>
   <cbc:PriceAmount currencyID="SAR">86.96</cbc:PriceAmount>
  </cac:Price>
 </cac:InvoiceLine>
</Invoice>;

try {
    console.log('signing exports:', Object.keys(signing));
    const doc = new XMLDocument(unsignedXML);
    const step1 = doc.toString({ no_header: false });
    console.log('XMLBuilder lines 1-3:');
    step1.split('\n').slice(0,3).forEach(l => console.log(l));

    const pureStr = signing.getPureInvoiceString(doc);
    console.log('\nC14N first 800:');
    console.log(pureStr.substring(0,800));
    console.log('\nNamespace check:');
    console.log('<cbc:ProfileID> literal:', pureStr.includes('<cbc:ProfileID>'));
    console.log('<cbc:ProfileID xmlns:', pureStr.includes('<cbc:ProfileID xmlns'));
    console.log('<cac:AccountingSupplierParty> literal:', pureStr.includes('<cac:AccountingSupplierParty>'));
    console.log('<cac:AccountingSupplierParty xmlns:', pureStr.includes('<cac:AccountingSupplierParty xmlns'));

    const libHash = signing.getInvoiceHash(doc);
    console.log('\nLibrary hash:', libHash);
} catch(e) {
    console.error(e.message);
    console.error(e.stack);
}
