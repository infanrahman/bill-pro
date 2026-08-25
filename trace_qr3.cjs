const fs = require('fs');
const crypto = require('crypto');
const { DOMParser } = require('xmldom');
const { XmlCanonicalizer } = require('xmldsigjs');
const { ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');

// We don't sign, we just want to see what generateSignedXMLString does
// Actually, we need to sign. We can mock the private key with a dummy one
const { generateKeyPairSync } = crypto;
const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'secp256k1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'sec1', format: 'pem' }
});
const dummyCert = `-----BEGIN CERTIFICATE-----\nMIICzjCCAjWgAwIBAgIQC/q1V6fZmffuKuR+G9TPvTAKBggqhkjOPQQDAjBpMQsw\nCQYDVQQGEwJTQTETMBEGA1UECBMKUmVnaW9uTmFtZTEQMA4GA1UEBxMHQ2l0eU5h\nbWUxEzARBgNVBAoTClZlbmRvck5hbWUxHDAaBgNVBAMTE1ZlbmRvckNlcnRpZmlj\nYXRlMB4XDTIzMDEwMTAwMDAwMFoXDTI0MDEwMTAwMDAwMFowaTELMAkGA1UEBhMC\nU0ExEzARBgNVBAgTClJlZ2lvbk5hbWUxEDAOBgNVBAcTB0NpdHlOYW1lMRMwEQYD\nVQQKEwpWZW5kb3JOYW1lMRwwGgYDVQQDExNWZW5kb3JDZXJ0aWZpY2F0ZTBZMBMG\nByqGSM49AgEGCCqGSM49AwEHA0IABGPswu0PtDegfafCtpjtV/RfD9QvB9gelfit\nce2tzemdMt4OFN4el/Zdq+0eKfD90OU+yvb9DuTdi9V+BfD9wuyjgcowgccwDAYD\nVR0TAQH/BAIwADAfBgNVHSMEGDAWgBRP/6hVp9iZ9+4q5H4b1M+9O+0yTzAdBgNV\nHQ4EFgQUT/+oVafYmffuKuR+G9TPvTvtMk8wDgYDVR0PAQH/BAQDAgeAMB0GA1Ud\nJQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjA/BgNVHR8EODA2MDSgMqAwhi5odHRw\nOi8vY3JsLnZlbmRvci5jb20vdmVuZG9yQ2VydGlmaWNhdGUuY3JsMAoGCCqGSM49\nBAMCA0gAMEUCIQDW/6hVp9iZ9+4q5H4b1M+9O+0yT5l3r9B7C7s9j5aB9gIgO/6h\nVp9iZ9+4q5H4b1M+9O+0yT5l3r9B7C7s9j5aB9o=\n-----END CERTIFICATE-----`;

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

async function run() {
    console.log("Generating invoice...");
    const invoice = new ZATCASimplifiedTaxInvoice({ props: invoiceProps });
    
    // zatca-xml-js sign requires ec-secp256k1 key
    const cleanCert = dummyCert.replace(/-----BEGIN CERTIFICATE-----\\n/g, '').replace(/\\n-----END CERTIFICATE-----/g, '').trim();
    const cleanKey = privateKey.replace(/-----BEGIN EC PRIVATE KEY-----\\n/g, '').replace(/\\n-----END EC PRIVATE KEY-----/g, '').trim();

    const signedResult = invoice.sign(dummyCert, privateKey);

    const signedXml = signedResult.signed_invoice_string;
    const libraryInvoiceHash = signedResult.invoice_hash;
    
    console.log("=== HASH TRACE ===");
    console.log("A library invoice hash: " + libraryInvoiceHash);
    console.log("A bytes length: " + Buffer.from(libraryInvoiceHash, 'base64').length);

    const digestValueMatch = signedXml.match(/<(?:ds:)?DigestValue[^>]*>([^<]+)<\\/(?:ds:)?DigestValue>/);
    const xmlDigestValue = digestValueMatch ? digestValueMatch[1].trim() : 'NOT_FOUND';
    console.log("B digest value: " + xmlDigestValue);

    const sigValueMatch = signedXml.match(/<(?:ds:)?SignatureValue[^>]*>([^<]+)<\\/(?:ds:)?SignatureValue>/);
    const xmlSignatureValue = sigValueMatch ? sigValueMatch[1].trim() : 'NOT_FOUND';
    console.log("C signature value: " + xmlSignatureValue);

    const qrMatch = signedXml.match(/<cbc:ID>QR<\\/cbc:ID>[\\s\\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)<\\/cbc:EmbeddedDocumentBinaryObject>/);
    const qrBase64 = qrMatch ? qrMatch[1].trim() : 'NOT_FOUND';

    const qrBytes = Buffer.from(qrBase64, 'base64');
    let offset = 0;
    let qrTag6 = 'NOT_FOUND';
    let qrTag7 = 'NOT_FOUND';
    while (offset < qrBytes.length) {
        const tag = qrBytes[offset];
        const len = qrBytes[offset + 1];
        const val = qrBytes.subarray(offset + 2, offset + 2 + len);
        if (tag === 6) qrTag6 = val;
        if (tag === 7) qrTag7 = val;
        offset += 2 + len;
    }

    console.log("D QR Tag 6 (hex): " + (qrTag6 !== 'NOT_FOUND' ? qrTag6.toString('hex') : qrTag6));
    console.log("D QR Tag 6 (base64): " + (qrTag6 !== 'NOT_FOUND' ? qrTag6.toString('base64') : qrTag6));
    console.log("D QR Tag 6 (utf8 string interpretation): " + (qrTag6 !== 'NOT_FOUND' ? qrTag6.toString('utf8') : qrTag6));
    console.log("E QR Tag 7 (hex): " + (qrTag7 !== 'NOT_FOUND' ? qrTag7.toString('hex') : qrTag7));
    console.log("E QR Tag 7 (base64): " + (qrTag7 !== 'NOT_FOUND' ? qrTag7.toString('base64') : qrTag7));
    console.log("E QR Tag 7 (utf8 string interpretation): " + (qrTag7 !== 'NOT_FOUND' ? qrTag7.toString('utf8') : qrTag7));

    console.log("\\nComparisons:");
    console.log("A === D (Base64 vs QR Tag 6 UTF8): " + (libraryInvoiceHash === qrTag6.toString('utf8')));
    console.log("A === D (Base64 vs QR Tag 6 Base64): " + (libraryInvoiceHash === qrTag6.toString('base64')));
    console.log("C === E (Base64 vs QR Tag 7 UTF8): " + (xmlSignatureValue === qrTag7.toString('utf8')));
    console.log("C === E (Base64 vs QR Tag 7 Base64): " + (xmlSignatureValue === qrTag7.toString('base64')));
    console.log("B === A: " + (xmlDigestValue === libraryInvoiceHash));
}
run();
