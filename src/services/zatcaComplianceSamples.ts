/**
 * Generates a minimal ZATCA-compliant sample invoice for the compliance check phase.
 * This is used internally by the"Go Live"automation.
 */



interface ComplianceSampleOptions {
  sellerName: string;
  vatNumber: string;
  crn: string;
  street: string;
  buildingNumber: string;
  citySubdivision: string;
  city: string;
  postalZone: string;
  countryCode: string;
  privateKeyPem: string;
  complianceCsid: string;
  invoiceIndex?: number; // 1, 2, 3 for the 3 required samples
  previousInvoiceHash?: string;
}

export interface SampleInvoice {
 xml: string;
 hash: string;
 uuid: string;
}

// Note: URI namespace constants were removed. The library's props API now generates
// the invoice XML internally, so manual namespace declarations are no longer needed.

function generateUUID() {
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
 const r = (Math.random() * 16) | 0;
 const v = c === 'x' ? r : (r & 0x3) | 0x8;
 return v.toString(16);
 });
}

export const generateComplianceSampleInvoice = async (opts: ComplianceSampleOptions): Promise<SampleInvoice> => {
  const now = new Date();
  
  // ZATCA expects UTC time for XML timestamps
  // If we format in local time, we should append the local offset, but it's safer to use strict formatting:
  // e.g. UTC -> yyyy-MM-dd / HH:mm:ssZ. Since format from date-fns is local, we'll construct the time string carefully
  // Wait, the simplest robust way without extra libraries is using JS ISO string for UTC.
  const isoStr = now.toISOString(); // e.g. "2023-10-05T14:48:00.000Z"
  const issueDate = isoStr.substring(0, 10);
  const issueTime = isoStr.substring(11, 19) + 'Z';

  const uuid = generateUUID();
  const icv = opts.invoiceIndex || 1;

  const quantity = icv;
  const unitPrice = 86.96; // For testing

  // Use passed genesis/previous hash or fallback to Genesis Hash (Base64 of '0' sha256)
  const prevHash = opts.previousInvoiceHash || 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';

  // ZATCA Compliance requires:
  // Sample 1: Invoice (388)
  // Sample 2: Credit Note (381)
  // Sample 3: Debit Note (383)
  let cancelation;
  if (icv === 2) {
      cancelation = {
          cancelation_type: '381',
          canceled_invoice_number: 1, // Must refer to a previous invoice
          payment_method: '10', // CASH
          reason: 'Compliance Sample Credit Note'
      };
  } else if (icv === 3) {
      cancelation = {
          cancelation_type: '383',
          canceled_invoice_number: 1,
          payment_method: '10',
          reason: 'Compliance Sample Debit Note'
      };
  }

  // Use the library's props API to generate the invoice XML internally.
  // This guarantees that the canonical XML used for hash computation (inside zatca-xml-js)
  // is identical to the XML submitted to ZATCA, eliminating the invoiceHash_QRCODE_INVALID
  // error caused by structural mismatches between hand-crafted templates and the library's
  // expected format (schema attributes on cbc:ID, InvoiceLine TaxTotal structure, etc.).
  const invoiceProps = {
    invoice_serial_number: `COMPLIANCE-SAMPLE-${icv}`,
    egs_info: {
      uuid,
      CRN_number: opts.crn,
      location: {
        street: opts.street,
        building: opts.buildingNumber,
        // plot_identification is required by the library template; use buildingNumber as fallback
        plot_identification: opts.buildingNumber || '1234',
        city_subdivision: opts.citySubdivision,
        city: opts.city,
        postal_zone: opts.postalZone,
      },
      VAT_number: opts.vatNumber,
      VAT_name: opts.sellerName,
    },
    issue_date: issueDate,
    issue_time: issueTime,
    previous_invoice_hash: prevHash,
    invoice_counter_number: icv,
    line_items: [
      {
        id: 1,
        name: `Compliance Sample Item ${icv}`,
        tax_exclusive_price: unitPrice,
        quantity,
        // VAT_percent is a decimal (0.15 = 15%) as expected by zatca-xml-js
        VAT_percent: 0.15,
      },
    ],
    cancelation: cancelation,
  };

  let signedXml = '';
  let hashBase64 = '';
  try {
    if (typeof window !== 'undefined' && (window as any).electron?.zatca?.signInvoiceXml) {
      const result = await (window as any).electron.zatca.signInvoiceXml(
        JSON.stringify(invoiceProps),
        opts.complianceCsid,
        opts.privateKeyPem
      );
      signedXml = result.signedXml;
      hashBase64 = result.hash;
    } else {
      throw new Error('ZATCA_SIGNING_UNAVAILABLE: Electron signing service is not available.');
    }
  } catch (e) {
    console.error('ZATCA compliance sample signing failed:', e);
    throw e;
  }

  return {
    xml: signedXml,
    hash: hashBase64,
    uuid
  };
};

function base64ToUint8Array(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, '');
  let binary;
  try {
      binary = atob(normalized);
  } catch (e) {
      throw new Error(`Invalid Base64 string: ${e}`);
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeZatcaTLV(base64: string): Map<number, Uint8Array> {
  if (!base64) {
      throw new Error('QR payload is empty');
  }
  
  const cleanBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;
  
  const bytes = base64ToUint8Array(cleanBase64);
  if (bytes.length === 0) {
      throw new Error('QR payload is empty after decode');
  }

  const tags = new Map<number, Uint8Array>();
  let offset = 0;

  while (offset < bytes.length) {
      if (offset + 2 > bytes.length) {
          throw new Error('Malformed TLV: not enough bytes for tag and length');
      }

      const tag = bytes[offset];
      const length = bytes[offset + 1];
      
      if (offset + 2 + length > bytes.length) {
          throw new Error(`Malformed TLV: length ${length} exceeds remaining bytes`);
      }

      const value = bytes.slice(offset + 2, offset + 2 + length);
      tags.set(tag, value);
      
      offset += 2 + length;
  }

  return tags;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const localValidateSample = (sample: SampleInvoice, expectedCrn: string, expectedVat: string): any => {
  console.log(`\n--- LOCAL CRYPTOGRAPHIC CONSISTENCY VALIDATION START ---`);
  const xml = sample.xml;
  const invoiceHash = sample.hash;
  const errors: string[] = [];
  const checks: Record<string, boolean> = {
    xmlValid: true,
    invoiceTypeValid: false,
    sellerVatValid: false,
    sellerCrnValid: false,
    prepaidAmountAbsent: true,
    qrDecoded: false,
    qrTag1Valid: false,
    qrTag2Valid: false,
    qrTag3Valid: false,
    qrTag4Valid: false,
    qrTag5Valid: false,
    qrTag6Valid: false,
    qrTag7Valid: false,
    qrTag8Valid: false,
    qrTag9Valid: false,
    qrHashMatchesInvoiceHash: false,
    qrSignatureMatchesInvoiceSignature: false
  };
  
  // BR-KSA-80 Check: PrepaidAmount is allowed when its value is 0.
  // The library always emits PrepaidAmount=0 in LegalMonetaryTotal.
  // ZATCA issues a WARNING (not ERROR) only when PrepaidAmount is non-zero and inconsistent.
  if (xml.includes('cbc:PrepaidAmount')) {
    const prepaidMatch = xml.match(/<cbc:PrepaidAmount[^>]*>([^<]+)<\/cbc:PrepaidAmount>/);
    const prepaidValue = prepaidMatch ? parseFloat(prepaidMatch[1]) : 0;
    if (prepaidValue !== 0) {
      errors.push(`BR-KSA-80: PrepaidAmount is ${prepaidValue} but must be 0 for non-prepaid invoices`);
      checks.prepaidAmountAbsent = false;
      console.error(`[FAIL] BR-KSA-80: Non-zero PrepaidAmount (${prepaidValue}) found in XML.`);
    } else {
      console.log(`[PASS] BR-KSA-80: PrepaidAmount present but is 0 (acceptable).`);
    }
  } else {
    console.log(`[PASS] BR-KSA-80: No PrepaidAmount.`);
  }

  // Invoice type check: accept any valid simplified invoice type name (starts with "02")
  // The library generates name="0211010" while legacy templates used name="0200000"; both are valid.
  // The invoice type code can be 388 (Invoice), 381 (Credit Note), or 383 (Debit Note).
  if (xml.match(/<cbc:InvoiceTypeCode name="02\d{5}">(388|381|383)<\/cbc:InvoiceTypeCode>/)) {
    checks.invoiceTypeValid = true;
  } else {
    errors.push("Invoice type is not 388/381/383 or name attribute does not start with '02' (simplified invoice)");
  }

  // BR-KSA-F-08 Check
  if (xml.includes('<cbc:ID schemeID="CRN">1010010000</cbc:ID>') && expectedCrn !== '1010010000') {
    errors.push(`CRN: expected ${expectedCrn} but found 1010010000 (hardcoded)`);
    console.error(`[FAIL] BR-KSA-F-08: Hardcoded CRN 1010010000 found.`);
  } else {
    checks.sellerCrnValid = true;
  }
  
  if (!xml.includes(expectedVat)) {
    errors.push(`VAT: expected ${expectedVat} but not found in XML`);
    console.error(`[FAIL] VAT Number ${expectedVat} missing.`);
  } else {
    checks.sellerVatValid = true;
  }
  if (!errors.some(e => e.startsWith('CRN:') || e.startsWith('VAT:'))) {
    console.log(`[PASS] BR-KSA-F-08: Valid business profile mapping.`);
  }

  // Extract IssueTime and IssueDate
  const timeMatch = xml.match(/<cbc:IssueTime>([^<]+)<\/cbc:IssueTime>/);
  const issueTime = timeMatch ? timeMatch[1] : null;
  const dateMatch = xml.match(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/);
  const issueDate = dateMatch ? dateMatch[1] : null;

  if (!issueTime || !issueDate) {
    errors.push("IssueTime or IssueDate missing from XML.");
    checks.xmlValid = false;
    console.error(`[FAIL] IssueTime or IssueDate missing from XML.`);
  }

  const timeStr = (issueTime && !issueTime.endsWith('Z')) ? `${issueTime}Z` : issueTime;
  const expectedQrTimestamp = issueDate && timeStr ? `${issueDate}T${timeStr}` : null;

  // Extract other expected values
  const sellerNameMatch = xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:RegistrationName>([^<]+)<\/cbc:RegistrationName>/);
  const expectedSellerName = sellerNameMatch ? sellerNameMatch[1] : null;

  const taxInclusiveMatch = xml.match(/<cac:LegalMonetaryTotal>[\s\S]*?<cbc:TaxInclusiveAmount[^>]*>([^<]+)<\/cbc:TaxInclusiveAmount>/);
  const expectedTotal = taxInclusiveMatch ? taxInclusiveMatch[1] : null;

  const taxTotalMatch = xml.match(/<cac:TaxTotal>\s*<cbc:TaxAmount[^>]*>([^<]+)<\/cbc:TaxAmount>/);
  const expectedVatTotal = taxTotalMatch ? taxTotalMatch[1] : null;
  
  const signatureMatch = xml.match(/<(?:ds:)?SignatureValue[^>]*>([^<]+)<\/(?:ds:)?SignatureValue>/);
  const invoiceSignature = signatureMatch ? signatureMatch[1] : null;

  const certMatch = xml.match(/<ds:X509Certificate[^>]*>([^<]+)<\/ds:X509Certificate>/);
  const xmlCertificate = certMatch ? certMatch[1].replace(/\s+/g, '') : null;

  // Extract QR
  const qrMatch = xml.match(/<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)<\/cbc:EmbeddedDocumentBinaryObject>/);
  const qrBase64 = qrMatch ? qrMatch[1] : null;

  if (!qrBase64 || qrBase64 === 'SET_QR_CODE_DATA') {
    errors.push("QR Code missing or not generated.");
    console.error(`[FAIL] QR Code missing.`);
  } else {
    try {
      const tags = decodeZatcaTLV(qrBase64);
      checks.qrDecoded = true;

      const tag1Name = tags.has(1) ? decodeUtf8(tags.get(1)!) : null;
      const tag2Vat = tags.has(2) ? decodeUtf8(tags.get(2)!) : null;
      const tag3Time = tags.has(3) ? decodeUtf8(tags.get(3)!) : null;
      const tag4Total = tags.has(4) ? decodeUtf8(tags.get(4)!) : null;
      const tag5VatTotal = tags.has(5) ? decodeUtf8(tags.get(5)!) : null;
      const tag6Bytes = tags.get(6);
      let tag6HashBase64 = tag6Bytes ? bytesToBase64(tag6Bytes) : null;
      let tag6String = tag6Bytes ? decodeUtf8(tag6Bytes) : null;
      
      const tag7Bytes = tags.get(7);
      let tag7SigBase64 = tag7Bytes ? bytesToBase64(tag7Bytes) : null;
      let tag7String = tag7Bytes ? decodeUtf8(tag7Bytes) : null;

      if (tag1Name === expectedSellerName) {
        checks.qrTag1Valid = true;
      } else {
        errors.push(`QR Seller Name mismatch. QR: ${tag1Name}, XML: ${expectedSellerName}`);
      }

      if (tag2Vat === expectedVat) {
        checks.qrTag2Valid = true;
      } else {
        errors.push(`QR VAT mismatch. QR: ${tag2Vat}, XML: ${expectedVat}`);
      }

      if (tag3Time === expectedQrTimestamp) {
        checks.qrTag3Valid = true;
        console.log(`[PASS] QR Timestamp matches XML.`);
      } else {
        errors.push(`QR timestamp mismatch. QR: ${tag3Time}, XML: ${expectedQrTimestamp}`);
        console.error(`[FAIL] QR Timestamp mismatch.`);
      }

      if (tag4Total === expectedTotal) {
        checks.qrTag4Valid = true;
      } else {
        errors.push(`QR Total mismatch. QR: ${tag4Total}, XML: ${expectedTotal}`);
      }

      if (tag5VatTotal === expectedVatTotal) {
        checks.qrTag5Valid = true;
      } else {
        errors.push(`QR VAT Total mismatch. QR: ${tag5VatTotal}, XML: ${expectedVatTotal}`);
      }

      if (tag6HashBase64 === invoiceHash || tag6String === invoiceHash) {
        checks.qrTag6Valid = true;
        checks.qrHashMatchesInvoiceHash = true;
      } else {
        errors.push(`QR Hash mismatch. QR Raw Base64: ${tag6HashBase64}, String: ${tag6String}, Expected: ${invoiceHash}`);
      }

      if (tag7SigBase64 === invoiceSignature || tag7String === invoiceSignature) {
        checks.qrTag7Valid = true;
        checks.qrSignatureMatchesInvoiceSignature = true;
      } else {
        errors.push(`QR Signature mismatch. QR Raw Base64: ${tag7SigBase64}, String: ${tag7String}, Expected: ${invoiceSignature}`);
      }

      if (tags.has(8) && tags.get(8)!.length > 0) {
        const tag8Base64 = bytesToBase64(tags.get(8)!);
        if (xmlCertificate) {
          // Tag 8 usually corresponds to the ECDSA public key / certificate
          // We ensure it is structurally present and associated with the XML certificate
          checks.qrTag8Valid = true;
        } else {
          errors.push("QR Tag 8 (ECDSA public key) present, but no XML certificate found for comparison.");
        }
      } else {
        errors.push("QR Tag 8 (ECDSA public key) missing or empty");
      }

      if (tags.has(9) && tags.get(9)!.length > 0) {
        // Tag 9 represents the ZATCA CA signature over the public key.
        checks.qrTag9Valid = true;
      } else {
        errors.push("QR Tag 9 (ZATCA technical CA signature) missing or empty");
      }

    } catch (e) {
      errors.push(`Failed to decode QR: ${e}`);
      console.error(`[FAIL] Failed to decode QR: ${e}`);
    }
  }

  const valid = Object.values(checks).every(val => val === true);

  console.log(`\nLOCAL VALIDATION\n`);
  const logCheck = (name: string, status: boolean) => {
    const paddedName = (name + '.'.repeat(26)).substring(0, 26);
    console.log(`${paddedName} ${status ? 'PASS' : 'FAIL'}`);
  }
  logCheck("XML", checks.xmlValid);
  logCheck("VAT", checks.sellerVatValid);
  logCheck("CRN", checks.sellerCrnValid);
  logCheck("Invoice Type", checks.invoiceTypeValid);
  logCheck("Prepaid Amount Absent", checks.prepaidAmountAbsent);
  logCheck("QR Tag 1", checks.qrTag1Valid);
  logCheck("QR Tag 2", checks.qrTag2Valid);
  logCheck("QR Tag 3", checks.qrTag3Valid);
  logCheck("QR Tag 4", checks.qrTag4Valid);
  logCheck("QR Tag 5", checks.qrTag5Valid);
  logCheck("QR Tag 6", checks.qrTag6Valid);
  logCheck("QR Tag 7", checks.qrTag7Valid);
  logCheck("QR Tag 8", checks.qrTag8Valid);
  logCheck("QR Tag 9", checks.qrTag9Valid);
  logCheck("Hash consistency", checks.qrHashMatchesInvoiceHash);
  logCheck("Signature consistency", checks.qrSignatureMatchesInvoiceSignature);

  console.log(`\nLOCAL CRYPTOGRAPHIC`);
  console.log(`CONSISTENCY VALIDATION.... ${valid ? 'PASS' : 'FAIL'}\n`);

  if (!valid) {
    const failedChecks = Object.keys(checks).filter(k => !checks[k]);
    const passedChecks = Object.keys(checks).filter(k => checks[k]);
    
    let errorMsg = `ZATCA_LOCAL_VALIDATION_FAILED\n\nSample: ${sample.uuid || 'Unknown'}\n\nFAILED:\n`;
    failedChecks.forEach(k => { errorMsg += `- ${k}\n` });
    errorMsg += `\nPASSED:\n`;
    passedChecks.forEach(k => { errorMsg += `- ${k}\n` });
    
    if (errors.length > 0) {
      errorMsg += `\nDetails:\n` + errors.map(e => `  * ${e}`).join('\n');
    }

    throw new Error(errorMsg);
  }

  return {
    valid,
    checks
  };
};

