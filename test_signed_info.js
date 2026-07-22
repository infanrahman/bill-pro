const forge = require('node-forge');

function buildSignedInfo(hashBase64) {
    // Exact canonicalized format (C14N11) without formatting spaces between tags
    return `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"></ds:SignatureMethod><ds:Reference Id="invoiceSignedData" URI=""><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116"><ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath></ds:Transform><ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod><ds:DigestValue>${hashBase64}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
}

const hashBase64 = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWIyNGEyOTVRMzYxYzI4Y2I1MjM=';
const signedInfo = buildSignedInfo(hashBase64);

const md = forge.md.sha256.create();
md.update(signedInfo, 'utf8');
console.log("SignedInfo Hash:", md.digest().toHex());
