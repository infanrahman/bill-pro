import QRCode from 'qrcode';

/**
 * ZATCA TLV Encoding implementation
 * Tags:
 * 1. Seller Name
 * 2. VAT Registration Number
 * 3. Timestamp
 * 4. Invoice Total (with VAT)
 * 5. VAT Total
 */

const getTLV = (tag: number, value: string): Uint8Array => {
    const encoder = new TextEncoder();
    const valueBytes = encoder.encode(value);
    const length = valueBytes.length;

    // Create array: [tag, length, ...valueBytes]
    // Note: This simple implementation assumes length < 255.
    // ZATCA specs usually have short fields for these tags.
    const tlv = new Uint8Array(2 + length);
    tlv[0] = tag;
    tlv[1] = length;
    tlv.set(valueBytes, 2);

    return tlv;
};

export const generateZatcaQR = async (
    sellerName: string,
    vatRegistrationNumber: string,
    timestamp: string, // ISO format or similar
    invoiceTotal: string,
    vatTotal: string
): Promise<string> => {

    const tlv1 = getTLV(1, sellerName);
    const tlv2 = getTLV(2, vatRegistrationNumber);
    const tlv3 = getTLV(3, timestamp);
    const tlv4 = getTLV(4, invoiceTotal);
    const tlv5 = getTLV(5, vatTotal);

    // Concatenate all TLVs
    const totalLength = tlv1.length + tlv2.length + tlv3.length + tlv4.length + tlv5.length;
    const fullArray = new Uint8Array(totalLength);

    let offset = 0;
    [tlv1, tlv2, tlv3, tlv4, tlv5].forEach(buf => {
        fullArray.set(buf, offset);
        offset += buf.length;
    });

    // Convert Uint8Array to Base64
    let binaryString = '';
    for (let i = 0; i < fullArray.length; i++) {
        binaryString += String.fromCharCode(fullArray[i]);
    }
    const base64TLV = btoa(binaryString);

    // Generate QR Code from the Base64 TLV
    try {
        return await QRCode.toDataURL(base64TLV);
    } catch (err) {
        console.error("QR Generation failed", err);
        return '';
    }
};

/**
 * Returns formatted date for ZATCA (e.g. 2023-01-01T12:00:00Z)
 */
export const formatZatcaDate = (date: Date) => {
    return date.toISOString();
}
