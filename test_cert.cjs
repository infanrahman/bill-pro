const fs = require('fs');
const crypto = require('crypto');
const path = 'C:\\\\Users\\\\mashallah\\\\AppData\\\\Roaming\\\\Billing App\\\\zatca_config.enc.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));
const token = config.complianceCsid;

if (!token) {
  console.log('No complianceCsid found in config');
  process.exit(1);
}

console.log('typeof: ' + typeof token);
console.log('string length: ' + token.length);
console.log('first 30 characters: ' + token.substring(0, 30));
console.log('last 10 characters: ' + token.substring(token.length - 10));
console.log('startsWith("-----BEGIN"): ' + token.startsWith('-----BEGIN'));
console.log('contains("-----BEGIN CERTIFICATE-----"): ' + token.includes('-----BEGIN CERTIFICATE-----'));
console.log('contains("\\n"): ' + token.includes('\n'));
console.log('contains("\\r\\n"): ' + token.includes('\r\n'));
console.log('contains whitespace: ' + /\s/.test(token));

const cleanToken = token.replace(/\s+/g, '');
const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(cleanToken) && (cleanToken.length % 4 === 0);
console.log('Base64 character validation result: ' + isValidBase64);

const decoded = Buffer.from(cleanToken, 'base64');
console.log('Base64 decoded byte length: ' + decoded.length);
console.log('first 16 decoded bytes as HEX: ' + decoded.toString('hex', 0, 16));

const hash = crypto.createHash('sha256').update(decoded).digest('hex');
console.log('SHA-256 fingerprint of decoded bytes: ' + hash);

console.log('\n--- TEST 1 ---');
try {
  new crypto.X509Certificate(decoded);
  console.log('PASS');
} catch (e) {
  console.log('FAIL');
  console.log('error code: ' + e.code);
  console.log('error message: ' + e.message);
  console.log('decoded byte length: ' + decoded.length);
  console.log('SHA-256 fingerprint: ' + hash);
}

console.log('\n--- TEST 2 ---');
try {
  const b64 = decoded.toString('base64');
  const lines = b64.match(/.{1,64}/g) || [];
  const pem = '-----BEGIN CERTIFICATE-----\n' + lines.join('\n') + '\n-----END CERTIFICATE-----';
  new crypto.X509Certificate(pem);
  console.log('PASS');
} catch (e) {
  console.log('FAIL');
  console.log('error code: ' + e.code);
  console.log('error message: ' + e.message);
  console.log('decoded byte length: ' + decoded.length);
  console.log('SHA-256 fingerprint: ' + hash);
}

console.log('\n--- TEST 3 ---');
try {
  let body = token;
  if (token.includes('-----BEGIN CERTIFICATE-----')) {
    body = token.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '');
  }
  body = body.replace(/\s+/g, '').trim();
  const decodedBody = Buffer.from(body, 'base64');
  new crypto.X509Certificate(decodedBody);
  console.log('PASS');
} catch (e) {
  console.log('FAIL');
  console.log('error code: ' + e.code);
  console.log('error message: ' + e.message);
  let body = token;
  if (token.includes('-----BEGIN CERTIFICATE-----')) {
    body = token.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '');
  }
  body = body.replace(/\s+/g, '').trim();
  const decodedBody = Buffer.from(body, 'base64');
  console.log('decoded byte length: ' + decodedBody.length);
  console.log('SHA-256 fingerprint: ' + crypto.createHash('sha256').update(decodedBody).digest('hex'));
}

console.log('\n--- TEST 4 ---');
try {
  let normalized = token.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  const pemStrForTest = normalized.includes('BEGIN CERTIFICATE') ? normalized : '-----BEGIN CERTIFICATE-----\n' + normalized + '\n-----END CERTIFICATE-----';
  new crypto.X509Certificate(pemStrForTest);
  console.log('PASS');
} catch (e) {
  console.log('FAIL');
  console.log('error code: ' + e.code);
  console.log('error message: ' + e.message);
  console.log('decoded byte length: N/A');
  console.log('SHA-256 fingerprint: N/A');
}
