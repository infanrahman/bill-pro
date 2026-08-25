import { format } from 'date-fns';
import type { Invoice } from './db';

// --- Types ---
interface BusinessDetails {
  gstin: string;          // VAT Number (BT-31 / CompanyID in PartyTaxScheme)
  name: string;
  address: string;
  crNo?: string;          // Commercial Registration Number (CRN) — PartyIdentification schemeID="CRN"
  streetName?: string;
  buildingNumber?: string;
  plotIdentification?: string;
  citySubdivisionName?: string;
  cityName?: string;
  postalZone?: string;
  countrySubentity?: string;
}

/**
 * Generates a ZATCA-compliant signed invoice XML for production Sale Bills.
 *
 * ARCHITECTURE:
 * Uses the SAME zatca-xml-js library pipeline that passed ZATCA compliance onboarding
 * (Samples 1/2/3). Instead of constructing XML by hand, this function builds an
 * `invoiceProps` object and passes it as JSON to `signInvoiceXml` in the Electron
 * main process. The `signInvoiceXml` method detects the JSON string and delegates to
 * `new ZATCASimplifiedTaxInvoice({ props: invoiceProps })`, which:
 *   - Generates correctly ordered UBL 2.1 XML (fixes XSD_ZATCA_INVALID)
 *   - Creates line-level TaxTotal with TaxAmount + RoundingAmount only (no TaxSubtotal)
 *   - Creates TWO document-level TaxTotal blocks (one with subtotals, one without)
 *   - Handles PrepaidAmount correctly
 *   - Computes all line/document totals consistently
 *
 * ROOT CAUSES OF PREVIOUS XSD_ZATCA_INVALID ERROR:
 *   • Line-level <cac:TaxTotal> contained <cac:TaxSubtotal> — forbidden by ZATCA UBL 2.1 XSD.
 *     Schema requires line-level TaxTotal to have ONLY TaxAmount + RoundingAmount.
 *   • Missing second document-level TaxTotal (without subtotals) — required by BR-KSA-EN16931-09.
 *   • <cbc:ID schemeID="CRN"> was populated with the VAT number not the CRN.
 *
 * @param invoice         The Sale Bill invoice from the database.
 * @param business        Business/branch details (VAT, CRN, address, etc.).
 * @param privateKeyPem   EC private key PEM (decrypted by signInvoiceXml).
 * @param certificatePem  Production CSID certificate (base64 PEM).
 * @param previousInvoiceHash  PIH from branch.lastInvoiceHash for chain integrity.
 * @param invoiceCounterValue  ICV from branch.invoiceCounter (sequential per device).
 */
export const generateZatcaXML = async (
  invoice: Invoice,
  business: BusinessDetails,
  privateKeyPem: string,
  certificatePem: string,
  previousInvoiceHash: string = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=',
  invoiceCounterValue: number = 1
): Promise<{ xml: string; hash: string; qr: string; uuid: string }> => {

  // --- 1. Timestamps ---
  const issueDate = format(new Date(invoice.createdAt), 'yyyy-MM-dd');
  // IssueTime: zatca-xml-js has a known bug where it reformats in local time and appends 'Z'.
  // The workaround in zatcaService.ts passes local time + 'Z' so the library outputs correctly.
  const issueTime = format(new Date(invoice.createdAt), 'HH:mm:ss') + 'Z';

  // --- 2. UUID ---
  const uuid = generateUUID();

  // --- 3. Address fields ---
  const street = business.streetName || business.address || 'Unknown Street';
  const building = business.buildingNumber || '0000';
  const plotId = business.plotIdentification || building || '0000';
  const district = business.citySubdivisionName || 'District';
  const city = business.cityName || 'Riyadh';
  const zip = business.postalZone || '00000';

  // --- 4. Line items → zatca-xml-js format ---
  // The library takes tax_exclusive_price (unit price BEFORE VAT) and VAT_percent (decimal).
  // It computes line subtotals, VAT amounts, RoundingAmount, and document totals internally,
  // ensuring mathematical consistency across all ZATCA-required fields.
  const line_items = invoice.items.map((item, index) => {
    const vatDecimal = (item.taxRate || 15) / 100;

    let taxExclusiveUnitPrice: number;
    if (item.netAmount !== undefined && item.netAmount !== null && item.quantity > 0) {
      // netAmount = line total after discounts (may include or exclude VAT)
      if (item.taxType === 'inclusive') {
        // Extract pre-VAT amount from inclusive total
        taxExclusiveUnitPrice = (item.netAmount / (1 + vatDecimal)) / item.quantity;
      } else {
        // Already exclusive
        taxExclusiveUnitPrice = item.netAmount / item.quantity;
      }
    } else if (item.price > 0 && item.quantity > 0) {
      // Fallback to unit price
      if (item.taxType === 'inclusive') {
        taxExclusiveUnitPrice = item.price / (1 + vatDecimal);
      } else {
        taxExclusiveUnitPrice = item.price;
      }
    } else {
      taxExclusiveUnitPrice = 0;
    }

    return {
      id: index + 1,
      name: item.name || `Item ${index + 1}`,
      tax_exclusive_price: parseFloat(taxExclusiveUnitPrice.toFixed(4)),
      quantity: item.quantity,
      VAT_percent: vatDecimal,
    };
  });

  // --- 5. Invoice type & cancelation (for return/credit note) ---
  const isReturn = invoice.type === 'return';
  const cancelation = isReturn ? {
    cancelation_type: '381' as const,
    canceled_invoice_number: Math.max(1, invoiceCounterValue - 1),
    payment_method: '10', // Cash
    reason: 'Customer Return',
  } : undefined;

  // --- 6. Customer name for BR-KSA-71 (summary simplified invoices require buyer name) ---
  const customerName = invoice.customerName?.trim() || 'Customer';

  // --- 7. Build invoiceProps for zatca-xml-js ---
  // The _customer_name field is read by zatcaService.signInvoiceXml to inject
  // cac:AccountingCustomerParty with the actual customer name (not hardcoded).
  const invoiceProps: Record<string, any> = {
    invoice_serial_number: invoice.invoiceNumber,
    egs_info: {
      uuid,
      CRN_number: business.crNo || '',
      location: {
        street,
        building,
        plot_identification: plotId,
        city_subdivision: district,
        city,
        postal_zone: zip,
      },
      VAT_number: business.gstin,
      VAT_name: business.name,
    },
    issue_date: issueDate,
    issue_time: issueTime,
    previous_invoice_hash: previousInvoiceHash,
    invoice_counter_number: invoiceCounterValue,
    line_items,
    // Private field read by zatcaService.ts to inject correct buyer name
    _customer_name: customerName,
  };

  if (cancelation) {
    invoiceProps.cancelation = cancelation;
  }

  // --- 8. Safe diagnostics (no private key / secret material logged) ---
  console.log('[ZATCA SALE INVOICE] ========== CRYPTO TRACE ==========');
  console.log('[ZATCA SALE INVOICE] UUID              :', uuid);
  console.log('[ZATCA SALE INVOICE] Invoice Number    :', invoice.invoiceNumber);
  console.log('[ZATCA SALE INVOICE] Invoice Type      :', isReturn ? '381 Credit Note' : '388 Simplified Invoice');
  console.log('[ZATCA SALE INVOICE] ICV               :', invoiceCounterValue);
  console.log('[ZATCA SALE INVOICE] Issue Date/Time   :', issueDate, issueTime);
  console.log('[ZATCA SALE INVOICE] Seller VAT        :', business.gstin);
  console.log('[ZATCA SALE INVOICE] Seller CRN        :', business.crNo || '(not configured)');
  console.log('[ZATCA SALE INVOICE] Customer Name     :', customerName);
  console.log('[ZATCA SALE INVOICE] Line Items        :', line_items.length);
  line_items.forEach((li, i) => {
    const lineTaxable = li.tax_exclusive_price * li.quantity;
    const lineVAT = lineTaxable * li.VAT_percent;
    console.log(
      `[ZATCA SALE INVOICE] Line ${i + 1}: "${li.name}" ` +
      `qty=${li.quantity} unitPrice(excl)=${li.tax_exclusive_price.toFixed(2)} ` +
      `taxable=${lineTaxable.toFixed(2)} VAT=${lineVAT.toFixed(2)} VAT%=${li.VAT_percent * 100}`
    );
  });

  // --- 9. Sign via the Electron ZATCA service (same pipeline as compliance samples) ---
  // signInvoiceXml detects JSON string (starts with '{') and routes through:
  //   new ZATCASimplifiedTaxInvoice({ props: invoiceProps })
  // This guarantees correct UBL 2.1 structure identical to accepted compliance samples.
  const propsJson = JSON.stringify(invoiceProps);

  let signedXml = '';
  let hashBase64 = '';
  let qrText = '';

  try {
    if (typeof window !== 'undefined' && (window as any).electron?.zatca?.signInvoiceXml) {
      const result = await (window as any).electron.zatca.signInvoiceXml(
        propsJson,
        certificatePem,
        privateKeyPem
      );
      signedXml = result.signedXml;
      hashBase64 = result.hash;
      qrText = result.qr;

      console.log('[ZATCA SALE INVOICE] Invoice Hash      :', hashBase64);
      console.log('[ZATCA SALE INVOICE] Signing           : COMPLETE ✓');
      console.log('[ZATCA SALE INVOICE] =============================================');
    } else {
      console.warn('[ZATCA SALE INVOICE] Electron not available — using mock (browser mode only)');
      signedXml = '<!-- MOCK SIGNED XML -->';
      hashBase64 = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';
      qrText = 'MOCK_QR';
    }
  } catch (e) {
    console.error('[ZATCA SALE INVOICE] Signing FAILED:', e);
    throw e;
  }

  return { xml: signedXml, hash: hashBase64, qr: qrText, uuid };
};

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
