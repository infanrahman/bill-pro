const { ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');
const fs = require('fs');

const invoiceProps = {
    invoice_serial_number: `COMPLIANCE-SAMPLE-1`,
    egs_info: {
      uuid: "11111111-1111-1111-1111-111111111111",
      CRN_number: "1234567890",
      location: {
        street: "test",
        building: "1234",
        plot_identification: '1234',
        city_subdivision: "test",
        city: "test",
        postal_zone: "12345",
      },
      VAT_number: "312345678901233",
      VAT_name: "test",
    },
    issue_date: "2023-10-05",
    issue_time: "14:48:00Z",
    previous_invoice_hash: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=",
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

// Inject buyer name for BR-KSA-71
invoice.getXML().set("Invoice/cac:AccountingCustomerParty", true, {
    "cac:Party": {
        "cac:PartyLegalEntity": {
            "cbc:RegistrationName": "Sample Customer"
        }
    }
});

const certKeyContent = fs.readFileSync('temp_cert_key_fixed.txt', 'utf8');
const certStart = certKeyContent.indexOf('-----BEGIN CERTIFICATE-----');
const certEnd = certKeyContent.indexOf('-----END CERTIFICATE-----') + '-----END CERTIFICATE-----'.length;
const keyStart = certKeyContent.indexOf('-----BEGIN EC PRIVATE KEY-----');
const keyEnd = certKeyContent.indexOf('-----END EC PRIVATE KEY-----') + '-----END EC PRIVATE KEY-----'.length;

const dummyCert = certKeyContent.substring(certStart, certEnd).replace(/-----BEGIN CERTIFICATE-----\r?\n/g, '').replace(/\r?\n-----END CERTIFICATE-----/g, '').trim();
const privateKey = certKeyContent.substring(keyStart, keyEnd).replace(/-----BEGIN EC PRIVATE KEY-----\r?\n/g, '').replace(/\r?\n-----END EC PRIVATE KEY-----/g, '').trim();

const signed = invoice.sign(dummyCert, privateKey);
console.log(signed.signed_invoice_string.includes("Sample Customer"));
console.log("Extracted XML:", signed.signed_invoice_string.substring(signed.signed_invoice_string.indexOf("<cac:AccountingCustomerParty>"), signed.signed_invoice_string.indexOf("</cac:AccountingCustomerParty>") + 30));
