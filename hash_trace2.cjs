'use strict';
/**
 * Phase 2: Compare library hash vs what ZATCA would compute from the signed XML.
 * Key question: does ZATCA's DOM removal of UBL/Sig/QR produce the same whitespace
 * as the library's JS-object deletion + toString + C14N?
 */
const crypto = require('crypto');
const signingLib  = require('./node_modules/zatca-xml-js/lib/zatca/signing');
const parserLib   = require('./node_modules/zatca-xml-js/lib/parser');
const { ZATCASimplifiedTaxInvoice } = require('./node_modules/zatca-xml-js');
const xmldom      = require('./node_modules/xmldom');
const { XmlCanonicalizer } = require('./node_modules/xmldsigjs');

const sha256b64 = (s) => crypto.createHash('sha256').update(s).digest('base64');
const sha256hex = (b)  => crypto.createHash('sha256').update(b).digest('hex');

// ── 1. Minimal props (same as compliance sample) ─────────────────────────────
const invoiceProps = {
  invoice_serial_number: 'DIAG-SAMPLE-1',
  egs_info: {
    uuid: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
    CRN_number: '1010010000',
    location: {
      street: 'Prince Muhammad Ibn Salman Al Saud Rd',
      building: '2322',
      plot_identification: '2323',
      city_subdivision: 'As Sulimaniyah',
      city: 'Riyadh',
      postal_zone: '12343',
    },
    VAT_number: '310935949100003',
    VAT_name: 'Test Seller',
  },
  issue_date: '2024-11-05',
  issue_time: '15:30:00Z',
  previous_invoice_hash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=',
  invoice_counter_number: 1,
  line_items: [{
    id: 1,
    name: 'Diagnostic Item',
    tax_exclusive_price: 86.96,
    quantity: 1,
    VAT_percent: 0.15,
  }],
};

// ── 2. Library invoice hash ───────────────────────────────────────────────────
const invoice = new ZATCASimplifiedTaxInvoice({ props: invoiceProps });
const libHash = signingLib.getInvoiceHash(invoice.invoice_xml);
const pureStr = signingLib.getPureInvoiceString(invoice.invoice_xml);

console.log('=== LIBRARY HASH ===');
console.log('  Hash (base64):', libHash);
console.log('  getPureInvoiceString len:', pureStr.length);

// Apply hacks manually to verify
let hacked = pureStr;
hacked = hacked.replace('<cbc:ProfileID>', '\n    <cbc:ProfileID>');
hacked = hacked.replace('<cac:AccountingSupplierParty>', '\n    \n    <cac:AccountingSupplierParty>');
const verifyHash = sha256b64(hacked);
console.log('  Our computed hash:', verifyHash);
console.log('  MATCH:', libHash === verifyHash);

// Show whitespace context
const pi = hacked.indexOf('<cbc:ProfileID>');
const ai = hacked.indexOf('<cac:AccountingSupplierParty>');
console.log('\n  Whitespace before ProfileID (20 chars):', JSON.stringify(hacked.substring(pi - 20, pi)));
console.log('  Whitespace before AccountingSupplierParty (30 chars):', JSON.stringify(hacked.substring(ai - 30, ai)));

// ── 3. Simulate what ZATCA does with the SIGNED XML ───────────────────────────
// We need to build a realistic signed XML. The library's generateSignedXMLString
// replaces SET_UBL_EXTENSIONS_STRING with a multi-line UBL extension block.
// Let's simulate: take the library's unsigned XML (with placeholders) and
// substitute a realistic UBL extension block (just a placeholder string for now).

const unsignedXml = invoice.invoice_xml.toString({ no_header: false });
console.log('\n=== UNSIGNED XML structure around UBLExtensions + ProfileID ===');
const ublEnd = unsignedXml.indexOf('</ext:UBLExtensions>');
const profStart = unsignedXml.indexOf('<cbc:ProfileID>');
if (ublEnd !== -1 && profStart !== -1) {
  console.log('  Between </ext:UBLExtensions> and <cbc:ProfileID>:',
    JSON.stringify(unsignedXml.substring(ublEnd + 20, profStart)));
}

// The signed XML replaces SET_UBL_EXTENSIONS_STRING with an actual UBL block.
// The library does: unsigned_invoice_str.replace("SET_UBL_EXTENSIONS_STRING", ubl_signature_xml_string)
// The UBL extension string is a multi-line XML block starting with <ext:UBLExtension>
// Let's use a representative fake UBL block to see the whitespace:
const fakeUBL = `
    <ext:UBLExtension>
        <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
        <ext:ExtensionContent>
            <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2">
                <sac:SignatureInformation xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2">
                    <ds:Signature Id="signature" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
                        <ds:SignedInfo>
                        </ds:SignedInfo>
                        <ds:SignatureValue>FAKESIG</ds:SignatureValue>
                        <ds:KeyInfo>
                            <ds:X509Data>
                                <ds:X509Certificate>FAKECERT</ds:X509Certificate>
                            </ds:X509Data>
                        </ds:KeyInfo>
                    </ds:Signature>
                </sac:SignatureInformation>
            </sig:UBLDocumentSignatures>
        </ext:ExtensionContent>
    </ext:UBLExtension>`;

// Also replace QR placeholder with a fake QR
let fakeSignedXml = unsignedXml
  .replace('SET_UBL_EXTENSIONS_STRING', fakeUBL)
  .replace('SET_QR_CODE_DATA', 'FAKEQR123456');

console.log('\n=== SIMULATE ZATCA DOM REMOVAL ON SIGNED XML ===');
console.log('  Signed XML around Invoice tag (first 500):');
console.log(fakeSignedXml.substring(0, 500));

// ZATCA's hash algorithm: parse signed XML, remove UBLExtensions/Signature/QR, C14N, hash
// Using the same xmldom + XmlCanonicalizer that the library uses
const domSigned = new xmldom.DOMParser().parseFromString(fakeSignedXml);
const docEl = domSigned.documentElement;

// Remove ext:UBLExtensions
const NS_EXT = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
const NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';

const ublNodes = domSigned.getElementsByTagNameNS(NS_EXT, 'UBLExtensions');
if (ublNodes.length > 0) {
  const parent = ublNodes[0].parentNode;
  parent.removeChild(ublNodes[0]);
  console.log('  Removed UBLExtensions from DOM');
}

// Remove cac:Signature
const sigNodes = domSigned.getElementsByTagNameNS(NS_CAC, 'Signature');
if (sigNodes.length > 0) {
  const parent = sigNodes[0].parentNode;
  parent.removeChild(sigNodes[0]);
  console.log('  Removed cac:Signature from DOM');
}

// Remove QR AdditionalDocumentReference
const adrNodes = Array.from(domSigned.getElementsByTagNameNS(NS_CAC, 'AdditionalDocumentReference'));
for (const adr of adrNodes) {
  const ids = adr.getElementsByTagNameNS(NS_CBC, 'ID');
  if (ids.length > 0 && ids[0].textContent === 'QR') {
    adr.parentNode.removeChild(adr);
    console.log('  Removed QR AdditionalDocumentReference from DOM');
    break;
  }
}

// Canonicalize
const c14nizer = new XmlCanonicalizer(false, false);
const zatcaCanonical = c14nizer.Canonicalize(domSigned);

const zatcaHash_noHacks = sha256b64(zatcaCanonical);

// Apply same hacks
let zatcaHashInput = zatcaCanonical;
zatcaHashInput = zatcaHashInput.replace('<cbc:ProfileID>', '\n    <cbc:ProfileID>');
zatcaHashInput = zatcaHashInput.replace('<cac:AccountingSupplierParty>', '\n    \n    <cac:AccountingSupplierParty>');
const zatcaHash_withHacks = sha256b64(zatcaHashInput);

console.log('\n  ZATCA C14N length:', zatcaCanonical.length);
const zpi = zatcaCanonical.indexOf('<cbc:ProfileID>');
const zai = zatcaCanonical.indexOf('<cac:AccountingSupplierParty>');
console.log('  Whitespace before ProfileID (20 chars):', JSON.stringify(zatcaCanonical.substring(zpi - 20, zpi)));
console.log('  Whitespace before AccountingSupplierParty (30 chars):', JSON.stringify(zatcaCanonical.substring(zai - 30, zai)));

console.log('\n  ZATCA-DOM hash (no hacks)   :', zatcaHash_noHacks);
console.log('  ZATCA-DOM hash (with hacks) :', zatcaHash_withHacks);
console.log('  Library hash                :', libHash);
console.log('  ZATCA-DOM == Library?       :', zatcaHash_withHacks === libHash);

// ── 4. KEY: Show the text between UBLExtensions and ProfileID in signed XML ──
console.log('\n=== TEXT BETWEEN </ext:UBLExtensions> AND <cbc:ProfileID> IN SIGNED XML ===');
const ublEndIdx   = fakeSignedXml.indexOf('</ext:UBLExtensions>');
const profStartIdx= fakeSignedXml.indexOf('<cbc:ProfileID>');
if (ublEndIdx !== -1 && profStartIdx !== -1) {
  const between = fakeSignedXml.substring(ublEndIdx + '</ext:UBLExtensions>'.length, profStartIdx);
  console.log('  between (JSON):', JSON.stringify(between));
  console.log('  Newline count:', (between.match(/\n/g) || []).length);
}

// ── 5. Compare exact C14N text around the two key elements ───────────────────
console.log('\n=== COMPARISON: Library vs ZATCA-DOM ===');
// Library's pure string (after JS object delete + toString + C14N + hacks)
const libraryInput = hacked;
const zatcaInput   = zatcaHashInput;

const profIdxL = libraryInput.indexOf('<cbc:ProfileID>');
const profIdxZ = zatcaInput.indexOf('<cbc:ProfileID>');
const acctIdxL = libraryInput.indexOf('<cac:AccountingSupplierParty>');
const acctIdxZ = zatcaInput.indexOf('<cac:AccountingSupplierParty>');

console.log('  Before ProfileID [Library]:', JSON.stringify(libraryInput.substring(profIdxL - 30, profIdxL)));
console.log('  Before ProfileID [ZATCA]  :', JSON.stringify(zatcaInput.substring(profIdxZ - 30, profIdxZ)));
console.log('  Before AcctSupParty [Library]:', JSON.stringify(libraryInput.substring(acctIdxL - 40, acctIdxL)));
console.log('  Before AcctSupParty [ZATCA]  :', JSON.stringify(zatcaInput.substring(acctIdxZ - 40, acctIdxZ)));

// Are the TWO strings equal (ignoring hacks)?
const libInputRaw = pureStr;
const zatcaInputRaw = zatcaCanonical;
console.log('\n  Library C14N (raw, no hacks) length:', libInputRaw.length);
console.log('  ZATCA C14N (raw, no hacks) length  :', zatcaInputRaw.length);
console.log('  Equal (raw)?', libInputRaw === zatcaInputRaw);
if (libInputRaw !== zatcaInputRaw) {
  // Find first difference
  let firstDiff = -1;
  for (let i = 0; i < Math.min(libInputRaw.length, zatcaInputRaw.length); i++) {
    if (libInputRaw[i] !== zatcaInputRaw[i]) { firstDiff = i; break; }
  }
  if (firstDiff !== -1) {
    console.log('  First difference at char index:', firstDiff);
    console.log('  Library  [diff-30..diff+30]:', JSON.stringify(libInputRaw.substring(firstDiff - 30, firstDiff + 30)));
    console.log('  ZATCA    [diff-30..diff+30]:', JSON.stringify(zatcaInputRaw.substring(firstDiff - 30, firstDiff + 30)));
  }
}
