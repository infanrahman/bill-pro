const forge = require('node-forge');
const fs = require('fs');

// We will test parsing a dummy cert
const keys = forge.pki.rsa.generateKeyPair(1024);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '0123456789';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
const attrs = [{
  name: 'commonName',
  value: 'Test'
}, {
  name: 'countryName',
  value: 'SA'
}];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey);

const pem = forge.pki.certificateToPem(cert);
const b64 = pem.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\n/g, '');

const parsedCert = forge.pki.certificateFromPem('-----BEGIN CERTIFICATE-----\n' + b64 + '\n-----END CERTIFICATE-----');
const issuerName = parsedCert.issuer.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');
const serialNumber = parseInt(parsedCert.serialNumber, 16).toString(); // convert hex serial to integer string
const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(parsedCert)).getBytes();
const md = forge.md.sha256.create();
md.update(certDer);
const certHash = forge.util.encode64(md.digest().getBytes());

console.log('Issuer:', issuerName);
console.log('Serial:', serialNumber);
console.log('Hash:', certHash);
