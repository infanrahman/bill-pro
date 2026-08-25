const { XMLDocument } = require("zatca-xml-js/lib/parser");
const { ZATCASimplifiedTaxInvoice } = require("zatca-xml-js");

Number.prototype.toFixedNoRounding = function(n) {
    return (Math.round(this * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n);
};


const invoiceProps = {
  invoice_serial_number: "INV-001",
  egs_info: {
    uuid: "123e4567-e89b-12d3-a456-426614174000",
    CRN_number: "1234567890",
    location: {
      street: "Street",
      building: "0000",
      plot_identification: "0000",
      city_subdivision: "District",
      city: "City",
      postal_zone: "00000"
    },
    VAT_number: "312345678900003",
    VAT_name: "Seller Name"
  },
  issue_date: "2024-01-01",
  issue_time: "12:00:00Z",
  previous_invoice_hash: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=",
  invoice_counter_number: 1,
  line_items: [
    {
      id: 1,
      name: "Item 1",
      tax_exclusive_price: 13.0435, // 15 inclusive
      quantity: 1,
      VAT_percent: 0.15
    }
  ]
};

const invoice = new ZATCASimplifiedTaxInvoice({ props: invoiceProps });
const xmlStr = invoice.getXML().toString({ format: true });
console.log(xmlStr);
