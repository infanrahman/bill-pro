const fs = require('fs');
const crypto = require('crypto');
const path = 'C:\\\\Users\\\\mashallah\\\\AppData\\\\Roaming\\\\Billing App\\\\zatca_config.enc.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));
const token = config.complianceCsid;

function decodeZatcaCertificate(binarySecurityToken) {
    if (!binarySecurityToken) {
        throw new Error('ZATCA_CERTIFICATE_INVALID: Certificate is empty.');
    }

    let normalizedStr = binarySecurityToken.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
    normalizedStr = normalizedStr
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s+/g, '')
        .trim();

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedStr)) {
        throw new Error('ZATCA_CERTIFICATE_INVALID: Outer certificate is not valid Base64.');
    }

    const first = Buffer.from(normalizedStr, 'base64');
    let der;
    let detectedDoubleBase64 = false;

    const isAsciiBase64 = (buf) => {
        if (buf.length === 0) return false;
        for (let i = 0; i < buf.length; i++) {
            const b = buf[i];
            if (b > 127) return false;
            if (!(/[A-Za-z0-9+/=\s]/.test(String.fromCharCode(b)))) {
                return false;
            }
        }
        return true;
    };

    if (isAsciiBase64(first)) {
        const inner = first.toString('ascii').replace(/\s+/g, '').trim();
        if (inner.length % 4 === 0) {
            const secondDecode = Buffer.from(inner, 'base64');
            if (secondDecode.length > 0 && secondDecode[0] === 0x30) {
                der = secondDecode;
                detectedDoubleBase64 = true;
            } else {
                der = first;
            }
        } else {
            der = first;
        }
    } else {
        der = first;
    }

    let cert;
    try {
        cert = new crypto.X509Certificate(der);
    } catch (e) {
        throw new Error(`ZATCA_CERTIFICATE_INVALID: Cannot parse X.509 certificate. Internal: ${e.message}`);
    }

    const outerLength = normalizedStr.length;
    const firstDecodedLength = first.length;
    const firstDecodedPrefixHex = first.length >= 2 ? first.subarray(0, 2).toString('hex') : '';
    const finalDerLength = der.length;
    const finalDerPrefixHex = der.length >= 2 ? der.subarray(0, 2).toString('hex') : '';
    const certificateSha256 = crypto.createHash('sha256').update(der).digest('hex');

    console.log(`[ZATCA] Certificate decoded. Diagnostics:\n` +
        `  outerLength: ${outerLength}\n` +
        `  firstDecodedLength: ${firstDecodedLength}\n` +
        `  firstDecodedPrefixHex: ${firstDecodedPrefixHex}\n` +
        `  detectedDoubleBase64: ${detectedDoubleBase64}\n` +
        `  finalDerLength: ${finalDerLength}\n` +
        `  finalDerPrefixHex: ${finalDerPrefixHex}\n` +
        `  certificateSha256: ${certificateSha256}`
    );

    return { cert, canonicalBase64: der.toString('base64'), der };
}

try {
    const res = decodeZatcaCertificate(token);
    console.log('SUCCESS! Parsed certificate subject:', res.cert.subject);
} catch (e) {
    console.error('FAILED:', e.message);
}
