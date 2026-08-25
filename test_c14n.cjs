const { DOMParser } = require('xmldom');
const { XmlCanonicalizer } = require('xmldsigjs');
const crypto = require('crypto');
const { ZATCASimplifiedTaxInvoice } = require('./node_modules/zatca-xml-js');

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

// Step 1: Open the invoice XML (unsigned)
const unsignedXml = invoice.invoice_xml.toString({ no_header: false });

// Parse using DOMParser
const dom = new DOMParser().parseFromString(unsignedXml);

// Step 2: Remove UBLExtensions
const NS_EXT = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
const NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';

const ublNodes = dom.getElementsByTagNameNS(NS_EXT, 'UBLExtensions');
if (ublNodes && ublNodes.length > 0) {
    ublNodes[0].parentNode.removeChild(ublNodes[0]);
}

// Step 3: Remove Signature
const cacSigNodes = dom.getElementsByTagNameNS(NS_CAC, 'Signature');
if (cacSigNodes && cacSigNodes.length > 0) {
    cacSigNodes[0].parentNode.removeChild(cacSigNodes[0]);
}

// Step 4: Remove QR
const adrNodes = dom.getElementsByTagNameNS(NS_CAC, 'AdditionalDocumentReference');
for (let i = 0; i < adrNodes.length; i++) {
    const idEls = adrNodes[i].getElementsByTagNameNS(NS_CBC, 'ID');
    if (idEls && idEls.length > 0 && idEls[0].textContent === 'QR') {
        adrNodes[i].parentNode.removeChild(adrNodes[i]);
        break;
    }
}

// Step 5: Canonicalize (C14N 1.1)
// We will use xmldsigjs XmlCanonicalizer(false, false) which acts as C14N 1.0. 
// For this specific XML, C14N 1.0 and 1.1 output should be identical.
const c14nizer = new XmlCanonicalizer(false, false);
const canonicalizedXml = c14nizer.Canonicalize(dom);

// Note: XML declaration is already removed by C14N by default.

// Step 6: SHA-256
const invoiceHash = crypto.createHash('sha256').update(canonicalizedXml).digest('base64');

console.log("Canonicalized XML length:", canonicalizedXml.length);
console.log("Computed Hash:", invoiceHash);

// Compare with library hash
const signingLib = require('./node_modules/zatca-xml-js/lib/zatca/signing');
const libHash = signingLib.getInvoiceHash(invoice.invoice_xml);
console.log("Library Hash:", libHash);
