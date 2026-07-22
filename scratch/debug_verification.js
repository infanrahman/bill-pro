const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyVEG5zhPCQSqeS1VqXUc
1rCXvLiSOEFZgG28uoVSmqwLOpdqQF7ka3GT2YQAmoogsRE5nXHg0zo8fTp4Gjfv
8AiaNRb2D2VRYSjMgwXysrfXlgrOAaYbYFMMYuUCUEMizEZFbf5OTNQ1tRRI+xWU
ftZs/T61aHafAJcvj5s+Ffk8uN5q41B0JG/VwX6yvlwLrBmySeLlAM0iV6CzsAQ4
FrohQgfA9+Ef2RliOdKrEOV32yhzWJWvNNOtH58VsB7IxyneMYKsvlHSO6AY+5QO
oJqEwrvn5GHdyn9G9zHq4WgWQoMggB+NTsuRaUqDJ5MvwvnYqIpqDtg6ZLIA9WZ9
SwIDAQAB
-----END PUBLIC KEY-----`;

const testKey = 'eyJtaWQiOiJlOGYxMmE4ZTdiNzE2NzFlMGYwOWE2Y2VmNjExODUwZjFkMDRmNWJmZTZjYzQyYWRhMWZlNzkyMThlMzE1MTYyIiwiZXhwIjoxODE1MTI4NDc3NDgxLCJ0eXBlIjoicHJvIn0=:Iq9v2YI0fWcag1e2H8FmY/7b63fNq/n1P3gH0qR/G7iQz5p0c5fN2dDbf3l1+D2nAoH2v7sN1Ld3H15Yp4c+j8Y/eO+9O5WkbP0bD9vRV/8hbJkVexX262+EAJOnvx1OSgnaNVFWIIPxHg9k5nOPwlHwjlNXU7k0J+oAC4HAtWEIwYpwIkCRNxGVyujSzpYsYa/xmRVosErGKQof2bfZgmuoc5Ve1f8JN1nELVRT6ehmfB2GjIz5HMIh9bxsUCIK9CFWXzWrRjV/g57noLUbveKffTKCEuPon78WNR63ybiM0deIgY50307ygHu3N+pewhazuNTFZ9w==';

app.whenReady().then(() => {
    try {
        const cleanKey = testKey.trim();
        const parts = cleanKey.split(':');
        console.log('Parts count:', parts.length);
        if (parts.length !== 2) {
            console.log('Split failed');
            app.quit();
            return;
        }

        const payloadB64 = parts[0];
        const signatureB64 = parts[1];

        const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8');
        const signature = Buffer.from(signatureB64, 'base64');

        console.log('Decoded payload:', payloadStr);
        console.log('Signature length (bytes):', signature.length);

        const isVerified = crypto.verify(
            "sha256",
            Buffer.from(payloadStr),
            {
                key: PUBLIC_KEY,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
            },
            signature
        );

        console.log('Crypto verification returned:', isVerified);

        if (isVerified) {
            const parsed = JSON.parse(payloadStr);
            console.log('Parsed payload:', parsed);
        }

    } catch (e) {
        console.error('Error during debug:', e);
    }
    app.quit();
});
