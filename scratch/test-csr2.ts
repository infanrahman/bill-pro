import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';
import crypto from 'crypto';

const opensslPath = path.resolve('electron/bin/openssl.exe');

async function testCSR() {
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const configPath = path.join(tempDir, `zatca_config_${timestamp}.cnf`);
    const keyPath = path.join(tempDir, `zatca_key_${timestamp}.pem`);
    const csrPath = path.join(tempDir, `zatca_csr_${timestamp}.csr`);

    const sanitizeCnfValue = (val: string) => {
        if (!val) return '';
        return val.replace(/["\\#\n\r]/g, '').trim();
    };

    try {
        const cnfContent = `oid_section = OIDs
[ OIDs ]
certificateTemplateName = 1.3.6.1.4.1.311.20.2

[ req ]
default_bits = 2048
distinguished_name = dn
req_extensions = req_ext
prompt = no
default_md = sha256
utf8 = yes
string_mask = utf8only

[ req_ext ]
certificateTemplateName = ASN1:PRINTABLESTRING:ZATCA-Code-Signing
subjectAltName = dirName:alt_names

[ dn ]
C=SA
O=${sanitizeCnfValue('مطعم منيرة محمد سعيد الشهراتي لتقديم الوجبات')}
OU=310935949100003
CN=PRD-123456789-310935949100003

[ alt_names ]
SN=1-ModelA|2-Ver1.0|3-${crypto.randomUUID()}
UID=310935949100003
title=1100
OID.2.5.4.26=Muhayil
OID.2.5.4.15=Retail
`;
        await fs.writeFile(configPath, cnfContent, 'utf8');

        console.log("Generating Private Key...");
        await new Promise<void>((resolve, reject) => {
            exec(`"${opensslPath}" ecparam -name prime256v1 -genkey -noout -out "${keyPath}"`, (err, _stdout, stderr) => {
                if (err) reject(err); else resolve();
            });
        });

        console.log("Generating CSR...");
        await new Promise<void>((resolve, reject) => {
            exec(`"${opensslPath}" req -new -utf8 -sha256 -key "${keyPath}" -extensions req_ext -config "${configPath}" -out "${csrPath}"`, (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(`Failed to generate CSR: ${stderr || err.message}`));
                } else resolve();
            });
        });

        const csr = await fs.readFile(csrPath, 'utf8');
        console.log("SUCCESS! Generated CSR length:", csr.length);
        console.log("First 3 lines:\n" + csr.split('\n').slice(0, 3).join('\n'));

    } catch (e) {
        console.error("ERROR generating CSR:");
        console.error(e);
    } finally {
        await fs.unlink(configPath).catch(() => {});
        await fs.unlink(keyPath).catch(() => {});
        await fs.unlink(csrPath).catch(() => {});
    }
}

testCSR();
