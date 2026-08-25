const fs = require('fs');
const crypto = require('crypto');
const { DOMParser } = require('xmldom');
const { XmlCanonicalizer } = require('xmldsigjs');
const { ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');
const { getInvoiceHash, createInvoiceDigitalSignature, getCertificateInfo } = require('zatca-xml-js/lib/zatca/signing/index');

// We need a dummy key and cert for the trace
const keyPem = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIBA/6hVp9iZ9+4q5H4b1M+9O+0yT5l3r9B7C7s9j5aB9oAoGCCqGSM49
AwEHoUQDQgAEY+zC7Q+0N6B9p8K2mO1X9F8P1C8H2B6V+K1x7a3N6Z0y3g4U3h
6X9l2r7R4p8P3Q5T7K9v0O5N2L1X4F8P3C7A==
-----END EC PRIVATE KEY-----`;

const certPem = `-----BEGIN CERTIFICATE-----
MIICzjCCAjWgAwIBAgIQC/q1V6fZmffuKuR+G9TPvTAKBggqhkjOPQQDAjBpMQsw
CQYDVQQGEwJTQTETMBEGA1UECBMKUmVnaW9uTmFtZTEQMA4GA1UEBxMHQ2l0eU5h
bWUxEzARBgNVBAoTClZlbmRvck5hbWUxHDAaBgNVBAMTE1ZlbmRvckNlcnRpZmlj
YXRlMB4XDTIzMDEwMTAwMDAwMFoXDTI0MDEwMTAwMDAwMFowaTELMAkGA1UEBhMC
U0ExEzARBgNVBAgTClJlZ2lvbk5hbWUxEDAOBgNVBAcTB0NpdHlOYW1lMRMwEQYD
VQQKEwpWZW5kb3JOYW1lMRwwGgYDVQQDExNWZW5kb3JDZXJ0aWZpY2F0ZTBZMBMG
ByqGSM49AgEGCCqGSM49AwEHA0IABGPswu0PtDegfafCtpjtV/RfD9QvB9gelfit
ce2tzemdMt4OFN4el/Zdq+0eKfD90OU+yvb9DuTdi9V+BfD9wuyjgcowgccwDAYD
VR0TAQH/BAIwADAfBgNVHSMEGDAWgBRP/6hVp9iZ9+4q5H4b1M+9O+0yTzAdBgNV
HQ4EFgQUT/+oVafYmffuKuR+G9TPvTvtMk8wDgYDVR0PAQH/BAQDAgeAMB0GA1Ud
JQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjA/BgNVHR8EODA2MDSgMqAwhi5odHRw
Oi8vY3JsLnZlbmRvci5jb20vdmVuZG9yQ2VydGlmaWNhdGUuY3JsMAoGCCqGSM49
BAMCA0gAMEUCIQDW/6hVp9iZ9+4q5H4b1M+9O+0yT5l3r9B7C7s9j5aB9gIgO/6h
Vp9iZ9+4q5H4b1M+9O+0yT5l3r9B7C7s9j5aB9o=
-----END CERTIFICATE-----`;

// A simple invoice props
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
    
    // We will use clean base64 format for the keys like zatcaService.ts does
    const cleanCert = certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\\s+/g, '').trim();
    const cleanKey = keyPem.replace(/-----BEGIN EC PRIVATE KEY-----/g, '').replace(/-----END EC PRIVATE KEY-----/g, '').replace(/\\s+/g, '').trim();

    const signedResult = invoice.sign(cleanCert, cleanKey);

    const signedXml = signedResult.signed_invoice_string;
    const libraryInvoiceHash = signedResult.invoice_hash;
    
    console.log("=== HASH TRACE ===");
    console.log("A library invoice hash: " + libraryInvoiceHash);
    console.log("A bytes length: " + Buffer.from(libraryInvoiceHash, 'base64').length);

    // Extract B: ds:DigestValue
    const digestValueMatch = signedXml.match(/<(?:ds:)?DigestValue[^>]*>([^<]+)<\\/(?:ds:)?DigestValue>/);
    const xmlDigestValue = digestValueMatch ? digestValueMatch[1].trim() : 'NOT_FOUND';
    console.log("B digest value: " + xmlDigestValue);

    // Extract C: ds:SignatureValue
    const sigValueMatch = signedXml.match(/<(?:ds:)?SignatureValue[^>]*>([^<]+)<\\/(?:ds:)?SignatureValue>/);
    const xmlSignatureValue = sigValueMatch ? sigValueMatch[1].trim() : 'NOT_FOUND';
    console.log("C signature value: " + xmlSignatureValue);

    // Extract QR code from signedXml
    const qrMatch = signedXml.match(/<cbc:ID>QR<\\/cbc:ID>[\\s\\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)<\\/cbc:EmbeddedDocumentBinaryObject>/);
    const qrBase64 = qrMatch ? qrMatch[1].trim() : 'NOT_FOUND';

    // Decode QR TLV
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

    // Fix the QR
    const invoiceHashBuf = Buffer.from(libraryInvoiceHash, 'base64');
    const signatureBuf = Buffer.from(xmlSignatureValue, 'base64');
    
    console.log("\\nMy Fix would encode Tag 6 as Base64: " + invoiceHashBuf.toString('base64'));
    console.log("My Fix would encode Tag 7 as Base64: " + signatureBuf.toString('base64'));
    
    // F: Independent hash of the final XML
    const NS_EXT = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
    const NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
    const NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';

    // We do exactly what zatca validator does
    const dom = new DOMParser().parseFromString(signedXml);
    const ublNodes = dom.getElementsByTagNameNS(NS_EXT, 'UBLExtensions');
    if (ublNodes && ublNodes.length > 0) ublNodes[0].parentNode.removeChild(ublNodes[0]);
    const cacSigNodes = dom.getElementsByTagNameNS(NS_CAC, 'Signature');
    if (cacSigNodes && cacSigNodes.length > 0) cacSigNodes[0].parentNode.removeChild(cacSigNodes[0]);
    const adrNodes = dom.getElementsByTagNameNS(NS_CAC, 'AdditionalDocumentReference');
    for (let i = 0; i < adrNodes.length; i++) {
        const idEls = adrNodes[i].getElementsByTagNameNS(NS_CBC, 'ID');
        if (idEls && idEls.length > 0 && idEls[0].textContent === 'QR') {
            adrNodes[i].parentNode.removeChild(adrNodes[i]);
            break;
        }
    }
    
    const c14nizer = new XmlCanonicalizer(false, false);
    const finalCanonicalized = c14nizer.Canonicalize(dom);
    const finalHash = crypto.createHash('sha256').update(finalCanonicalized).digest('base64');
    
    console.log("F independent final XML hash: " + finalHash);
    console.log("G final XML SignatureValue: " + xmlSignatureValue);
    
    console.log("\\nComparisons:");
    console.log("A === F: " + (libraryInvoiceHash === finalHash));
    console.log("A === D (Base64 vs QR Tag 6 UTF8): " + (libraryInvoiceHash === qrTag6.toString('utf8')));
    console.log("A === D (Base64 vs QR Tag 6 Base64): " + (libraryInvoiceHash === qrTag6.toString('base64')));
    console.log("C === E (Base64 vs QR Tag 7 UTF8): " + (xmlSignatureValue === qrTag7.toString('utf8')));
    console.log("C === E (Base64 vs QR Tag 7 Base64): " + (xmlSignatureValue === qrTag7.toString('base64')));
    console.log("B === A: " + (xmlDigestValue === libraryInvoiceHash));
}
run();
