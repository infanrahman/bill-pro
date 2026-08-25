/**
 * PHASE 1–8 DIAGNOSTIC SCRIPT
 * Run: node hash_trace.js  (from d:\mobile)
 * Purpose: capture EXACT library hash input and compare DOM-based re-hash
 */

'use strict';
const crypto = require('crypto');
const path = require('path');

// Load library internals
const signingLib = require('./node_modules/zatca-xml-js/lib/zatca/signing');
const parserLib  = require('./node_modules/zatca-xml-js/lib/parser');
const { ZATCASimplifiedTaxInvoice } = require('./node_modules/zatca-xml-js');
const xmldom     = require('./node_modules/xmldom');
const { XmlCanonicalizer } = require('./node_modules/xmldsigjs');

// ── helper ────────────────────────────────────────────────────────────────────
const sha256b64 = (str) => crypto.createHash('sha256').update(str).digest('base64');
const sha256hex = (buf)  => crypto.createHash('sha256').update(buf).digest('hex');

function parseTlv(b64) {
  const buf = Buffer.from(b64, 'base64');
  const tags = new Map();
  let off = 0;
  while (off < buf.length) {
    if (off + 2 > buf.length) break;
    const tag = buf[off], len = buf[off + 1];
    if (off + 2 + len > buf.length) break;
    tags.set(tag, buf.slice(off + 2, off + 2 + len));
    off += 2 + len;
  }
  return tags;
}

// ── Build a minimal sample invoice ────────────────────────────────────────────
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

const invoice = new ZATCASimplifiedTaxInvoice({ props: invoiceProps });

// ── STAGE A: Unsigned XML (from library) ──────────────────────────────────────
const stageA_xml = invoice.invoice_xml.toString({ no_header: false });
console.log('\n=== STAGE A: Unsigned XML ===');
console.log('  Byte length :', Buffer.from(stageA_xml).length);
console.log('  SHA-256     :', sha256hex(Buffer.from(stageA_xml)));
console.log('  Has QR placeholder:', stageA_xml.includes('SET_QR_CODE_DATA'));
console.log('  Has UBL placeholder:', stageA_xml.includes('SET_UBL_EXTENSIONS_STRING'));
console.log('  First 400 chars:\n', stageA_xml.substring(0, 400));

// ── STAGE B: XML before hashing (after deleting UBL/Sig/QR from JS object) ───
const invoiceCopyForHash = new parserLib.XMLDocument(stageA_xml);
invoiceCopyForHash.delete('Invoice/ext:UBLExtensions');
invoiceCopyForHash.delete('Invoice/cac:Signature');
invoiceCopyForHash.delete('Invoice/cac:AdditionalDocumentReference', { 'cbc:ID': 'QR' });
const stageB_xml = invoiceCopyForHash.toString({ no_header: false });
console.log('\n=== STAGE B: After removing UBL/Sig/QR (pre-C14N) ===');
console.log('  Byte length :', Buffer.from(stageB_xml).length);
console.log('  SHA-256     :', sha256hex(Buffer.from(stageB_xml)));
console.log('  First 400 chars:\n', stageB_xml.substring(0, 400));

// ── STAGE C: C14N of STAGE B ──────────────────────────────────────────────────
const domB = new xmldom.DOMParser().parseFromString(stageB_xml);
const canonicalizerB = new XmlCanonicalizer(false, false);
let stageC_c14n = canonicalizerB.Canonicalize(domB);
console.log('\n=== STAGE C: C14N (before hacks) ===');
console.log('  Byte length :', Buffer.from(stageC_c14n).length);
console.log('  SHA-256     :', sha256hex(Buffer.from(stageC_c14n)));
console.log('  First 400 chars:\n', stageC_c14n.substring(0, 400));

// Count whitespace before ProfileID and AccountingSupplierParty
const profIdx = stageC_c14n.indexOf('<cbc:ProfileID>');
const acctIdx = stageC_c14n.indexOf('<cac:AccountingSupplierParty>');
console.log('  Chars before <cbc:ProfileID>          :', JSON.stringify(stageC_c14n.substring(profIdx - 20, profIdx)));
console.log('  Chars before <cac:AccountingSupplierParty>:', JSON.stringify(stageC_c14n.substring(acctIdx - 30, acctIdx)));

// ── STAGE D: Hash input (C14N + whitespace hacks) ─────────────────────────────
let stageD_hashInput = stageC_c14n;
const profHackApplied    = stageD_hashInput.includes('<cbc:ProfileID>');
const acctHackApplied    = stageD_hashInput.includes('<cac:AccountingSupplierParty>');
stageD_hashInput = stageD_hashInput.replace('<cbc:ProfileID>', '\n    <cbc:ProfileID>');
stageD_hashInput = stageD_hashInput.replace('<cac:AccountingSupplierParty>', '\n    \n    <cac:AccountingSupplierParty>');
console.log('\n=== STAGE D: Hash input (C14N + whitespace hacks) ===');
console.log('  ProfileID hack applicable :', profHackApplied);
console.log('  AccountingSupplierParty hack applicable:', acctHackApplied);
console.log('  Byte length :', Buffer.from(stageD_hashInput).length);
const stageD_sha256 = sha256b64(stageD_hashInput);
console.log('  SHA-256 (base64):', stageD_sha256);
console.log('  Chars before <cbc:ProfileID> (after hack):', JSON.stringify(stageD_hashInput.substring(stageD_hashInput.indexOf('<cbc:ProfileID>') - 30, stageD_hashInput.indexOf('<cbc:ProfileID>') + 5)));
console.log('  Chars before <cac:AccountingSupplierParty> (after hack):', JSON.stringify(stageD_hashInput.substring(stageD_hashInput.indexOf('<cac:AccountingSupplierParty>') - 40, stageD_hashInput.indexOf('<cac:AccountingSupplierParty>') + 5)));

// ── STAGE E: Library invoice hash ─────────────────────────────────────────────
const stageE_libHash = signingLib.getInvoiceHash(invoice.invoice_xml);
console.log('\n=== STAGE E: Library invoice hash ===');
console.log('  Library hash      :', stageE_libHash);
console.log('  Our computed hash :', stageD_sha256);
console.log('  MATCH             :', stageE_libHash === stageD_sha256);

// Use a FAKE certificate/key for diagnostics (skip actual signing, just test hash)
console.log('\n=== DIAGNOSIS SUMMARY ===');
console.log('Root cause: Library hash uses C14N + whitespace hacks on an invoice');
console.log('whose XML structure differs from what ZATCA gets in the signed XML.');
console.log('Check STAGE D carefully: is the text before ProfileID and');
console.log('AccountingSupplierParty what ZATCA would produce after removing');
console.log('UBLExtensions + Signature + QR from the SIGNED XML?');
console.log('');
console.log('To replicate ZATCA\'s hash from the SIGNED XML:');
console.log('1. Parse signed XML with DOMParser');
console.log('2. Remove UBLExtensions, Signature, QR by DOM manipulation');
console.log('3. Serialize to string');
console.log('4. Apply C14N');
console.log('5. Compare to STAGE D above');
