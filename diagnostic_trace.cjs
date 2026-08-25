const fs = require('fs');
const crypto = require('crypto');
const { DOMParser } = require('xmldom');
const { XmlCanonicalizer } = require('xmldsigjs');
const { ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');
const moment = require('moment');

const certKeyContent = fs.readFileSync('temp_cert_key_fixed.txt', 'utf8');
const certStart = certKeyContent.indexOf('-----BEGIN CERTIFICATE-----');
const certEnd = certKeyContent.indexOf('-----END CERTIFICATE-----') + '-----END CERTIFICATE-----'.length;
const keyStart = certKeyContent.indexOf('-----BEGIN EC PRIVATE KEY-----');
const keyEnd = certKeyContent.indexOf('-----END EC PRIVATE KEY-----') + '-----END EC PRIVATE KEY-----'.length;

if (certStart === -1 || keyStart === -1) {
    console.error("Failed to parse cert/key from python output");
    process.exit(1);
}

const dummyCert = certKeyContent.substring(certStart, certEnd);
const privateKey = certKeyContent.substring(keyStart, keyEnd);

const cleanCert = dummyCert.replace(/-----BEGIN CERTIFICATE-----\r?\n/g, '').replace(/\r?\n-----END CERTIFICATE-----/g, '').trim();
const cleanKey = privateKey.replace(/-----BEGIN EC PRIVATE KEY-----\r?\n/g, '').replace(/\r?\n-----END EC PRIVATE KEY-----/g, '').trim();

// 2. Generate Invoice
const invoiceProps = {
    invoice_serial_number: `COMPLIANCE-SAMPLE-1`,
    egs_info: {
      uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
      CRN_number: '1234567890',
      location: {
        street: 'test',
        building: '1234',
        plot_identification: '1234',
        city_subdivision: 'test',
        city: 'test',
        postal_zone: '12345',
      },
      VAT_number: '312345678901233',
      VAT_name: 'test',
    },
    issue_date: '2023-10-05',
    issue_time: '14:48:00Z',
    previous_invoice_hash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=',
    invoice_counter_number: 1,
    line_items: [
      {
        id: 1,
        name: `Compliance Sample Item 1`,
        tax_exclusive_price: 86.96,
        quantity: 1,
        VAT_percent: 0.15,
      },
    ],
  };

const invoice = new ZATCASimplifiedTaxInvoice({ props: invoiceProps });

const originalFormat = moment.fn.format;
moment.fn.format = function(fmt) {
    if (fmt === "YYYY-MM-DDTHH:mm:ss" && this.isValid()) {
        return originalFormat.call(this.utc(), fmt);
    }
    return originalFormat.apply(this, arguments);
};

const result = invoice.sign(cleanCert, cleanKey);
moment.fn.format = originalFormat;

// Clean up
try { fs.unlinkSync('temp_cert_key.txt'); } catch(e){}

// Values
const A_libraryHash = result.invoice_hash;
const finalXml = result.signed_invoice_string;
const finalQr = result.qr;

// API preparation matching zatcaApi.ts
const encodedXml = Buffer.from(unescape(encodeURIComponent(finalXml))).toString('base64');
const G_apiInvoiceHash = result.invoice_hash; // In zatcaApi.ts: invoiceHash: inv.hash

// B & C extraction from finalXml
const digestValueMatch = finalXml.match(/<(?:ds:)?DigestValue[^>]*>([^<]+)<\/(?:ds:)?DigestValue>/);
const B_xmlDigestValue = digestValueMatch ? digestValueMatch[1].trim() : 'NOT_FOUND';

const sigValueMatch = finalXml.match(/<(?:ds:)?SignatureValue[^>]*>([^<]+)<\/(?:ds:)?SignatureValue>/);
const C_xmlSignatureValue = sigValueMatch ? sigValueMatch[1].trim() : 'NOT_FOUND';
const H_finalXmlSignatureValue = C_xmlSignatureValue; // Same

// D & E from QR
function decodeZatcaTLV(base64) {
    const bytes = Buffer.from(base64, 'base64');
    const tags = new Map();
    let offset = 0;
    while (offset < bytes.length) {
        if (offset + 2 > bytes.length) break;
        const tag = bytes[offset];
        const length = bytes[offset + 1];
        if (offset + 2 + length > bytes.length) break;
        const value = bytes.slice(offset + 2, offset + 2 + length);
        tags.set(tag, value);
        offset += 2 + length;
    }
    return tags;
}
const tags = decodeZatcaTLV(finalQr);
const tag6Bytes = tags.get(6);
const D_qrTag6Base64 = tag6Bytes ? tag6Bytes.toString('base64') : 'NOT_FOUND';
const tag7Bytes = tags.get(7);
const E_qrTag7Base64 = tag7Bytes ? tag7Bytes.toString('base64') : 'NOT_FOUND';

// F: Independent hash of exact final XML
const domUnsigned = new DOMParser().parseFromString(finalXml);
const NS_EXT = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
const NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';

const ublNodes = domUnsigned.getElementsByTagNameNS(NS_EXT, 'UBLExtensions');
if (ublNodes && ublNodes.length > 0) ublNodes[0].parentNode.removeChild(ublNodes[0]);

const cacSigNodes = domUnsigned.getElementsByTagNameNS(NS_CAC, 'Signature');
if (cacSigNodes && cacSigNodes.length > 0) cacSigNodes[0].parentNode.removeChild(cacSigNodes[0]);

const adrNodes = domUnsigned.getElementsByTagNameNS(NS_CAC, 'AdditionalDocumentReference');
for (let i = 0; i < adrNodes.length; i++) {
    const idEls = adrNodes[i].getElementsByTagNameNS(NS_CBC, 'ID');
    if (idEls && idEls.length > 0 && idEls[0].textContent === 'QR') {
        adrNodes[i].parentNode.removeChild(adrNodes[i]);
        break;
    }
}
const zatcaC14nizer = new XmlCanonicalizer(false, false);
const canonicalizedXml = zatcaC14nizer.Canonicalize(domUnsigned);
const F_independentHash = crypto.createHash('sha256').update(canonicalizedXml).digest('base64');

// Check types
function analyze(value) {
    if (value === 'NOT_FOUND') return 'N/A';
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(value);
    const buf = Buffer.from(value, 'base64');
    return { isBase64, len: buf.length };
}

function analyzeBuffer(buf) {
    if (!buf) return 'N/A';
    // Is it double-base64?
    const asStr = buf.toString('utf8');
    const isDouble = /^[A-Za-z0-9+/=]+$/.test(asStr) && asStr.length > 20;
    return { len: buf.length, isDouble, asStr };
}

console.log("==================================================");
console.log("ZATCA CRYPTOGRAPHIC TRACE — SAMPLE 1");
console.log("==================================================");
console.log("");
console.log("A — LIBRARY INVOICE HASH");
console.log("Value:", A_libraryHash);
console.log("Decoded byte length:", analyze(A_libraryHash).len);
console.log("");
console.log("B — XML ds:DigestValue");
console.log("Value:", B_xmlDigestValue);
console.log("Decoded byte length:", analyze(B_xmlDigestValue).len);
console.log("");
console.log("C — XML ds:SignatureValue");
console.log("Value:", C_xmlSignatureValue);
console.log("Decoded byte length:", analyze(C_xmlSignatureValue).len);
console.log("");
const tag6A = analyzeBuffer(tag6Bytes);
console.log("D — QR TAG 6");
console.log("Decoded Base64:", D_qrTag6Base64);
console.log("Decoded byte length:", tag6A.len);
console.log("");
const tag7A = analyzeBuffer(tag7Bytes);
console.log("E — QR TAG 7");
console.log("Decoded Base64:", E_qrTag7Base64);
console.log("Decoded byte length:", tag7A.len);
console.log("");
console.log("F — INDEPENDENT HASH OF EXACT FINAL XML");
console.log("Value:", F_independentHash);
console.log("Decoded byte length:", analyze(F_independentHash).len);
console.log("");
console.log("G — API REQUEST invoiceHash");
console.log("Value:", G_apiInvoiceHash);
console.log("Decoded byte length:", analyze(G_apiInvoiceHash).len);
console.log("");
console.log("H — FINAL XML SignatureValue");
console.log("Value:", H_finalXmlSignatureValue);
console.log("Decoded byte length:", analyze(H_finalXmlSignatureValue).len);
console.log("");
console.log("==================================================");
console.log("STEP 4 — EQUALITY MATRIX");
console.log("==================================================");
console.log(`A === B : ${A_libraryHash === B_xmlDigestValue}`);
console.log(`A === D : ${A_libraryHash === D_qrTag6Base64}`);
console.log(`A === F : ${A_libraryHash === F_independentHash}`);
console.log(`A === G : ${A_libraryHash === G_apiInvoiceHash}`);
console.log(`B === F : ${B_xmlDigestValue === F_independentHash}`);
console.log(`B === G : ${B_xmlDigestValue === G_apiInvoiceHash}`);
console.log(`C === E : ${C_xmlSignatureValue === E_qrTag7Base64}`);
console.log(`C === H : ${C_xmlSignatureValue === H_finalXmlSignatureValue}`);
console.log(`D === F : ${D_qrTag6Base64 === F_independentHash}`);
console.log(`E === C : ${E_qrTag7Base64 === C_xmlSignatureValue}`);

// Check specific double base64
console.log(`\nIs QR Tag 6 containing ASCII/UTF-8 characters of a Base64 string? ${tag6A.isDouble}`);
if (tag6A.isDouble) {
    console.log(`QR Tag 6 decoded as UTF-8 string: ${tag6A.asStr}`);
}
console.log(`Is QR Tag 7 containing ASCII/UTF-8 characters of a Base64 string? ${tag7A.isDouble}`);

// Buffer from behavior
console.log("\nBuffer behavior:");
console.log("invoice_hash type:", typeof A_libraryHash);
console.log("invoice_hash length:", A_libraryHash.length);
console.log("Buffer.from(invoice_hash).length:", Buffer.from(A_libraryHash).length);
console.log("Buffer.from(invoice_hash, 'base64').length:", Buffer.from(A_libraryHash, 'base64').length);

// TLV
console.log("\n==================================================");
console.log("STEP 6 — TLV TRACE");
console.log("==================================================");
for (let i = 1; i <= 9; i++) {
    const t = tags.get(i);
    if (!t) continue;
    console.log(`Tag ${i}:`);
    console.log(`byte length: ${t.length}`);
    if (i === 6 || i === 7) {
        console.log(`Base64 representation: ${t.toString('base64')}`);
        console.log(`First few raw bytes (hex): ${t.subarray(0, 10).toString('hex')}...`);
    } else {
        if (i < 6) {
            console.log(`representation: ${t.toString('utf8')}`);
        } else {
            console.log(`representation: (binary)`);
        }
    }
    console.log("");
}

console.log("==================================================");
console.log("STEP 7 — EXACT XML SENT TO ZATCA");
console.log("==================================================");
console.log(`API invoiceHash: ${G_apiInvoiceHash}`);
console.log(`FINAL_XML_HASH: ${F_independentHash}`);
console.log(`Equal: ${G_apiInvoiceHash === F_independentHash}`);
