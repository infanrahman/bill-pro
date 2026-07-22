const { ZATCASimplifiedTaxInvoice } = require('zatca-xml-js');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
</Invoice>`;

const cert = `-----BEGIN CERTIFICATE-----
MIIDzjCCAvagAwIBAgIQYn...
-----END CERTIFICATE-----`;

const key = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBkOViH06PzgqYjmlK3Tf198ZJIWf4riknppONsZQ884oAcGBSuBBAAK
oUQDQgAEdzPwCoazmExsulQlh8XzLv40ih8YPY5BlUu6mERp/qyi2RPAMjXLU2oU
qaKzO7cU1gqNj707AphwzD5JtxQcZQ==
-----END EC PRIVATE KEY-----`;

try {
    const invoice = new ZATCASimplifiedTaxInvoice({ invoice_xml_str: xml });
    invoice.sign(cert, key);
    console.log("Success");
} catch (e) {
    console.error(e);
}
