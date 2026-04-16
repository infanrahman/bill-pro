const payload = `50 4c 55 09 31 09 30 09 34 35 36 09 31 09 31 35
2c 31 09 30 2c 30 09 30 2c 30 09 30 09 30 09 30
09 30 09 30 09 30 09 39 09 61 70 70 6c 65 09 09
09 09 09 09 09 09 30 09 30 09 30 09 30 09 30 09
30 09 30 09 30 09 30 09 30 09 30 09 30 09 30 2c
30 09 30 2c 30 09 30 09 31 32 37 09 30 2c 30 09
30 2c 30 09 30 2c 30 09 30 09 31 32 37 09 30 2c
30 09 30 2c 30 09 30 2c 30 09 30 09 31 32 37 09
30 2c 30 09 30 2c 30 09 30 2c 30 09 30 09 31 32
37 09 30 2c 30 09 30 2c 30 09 30 2c 30 09 30 09
30 09 30 09 30 09 30 09 30 09 30 09 61 70 70 6c
65 09 30 09 30 09 30`;

const hexStr = payload.replace(/\n/g, ' ').replace(/\s+/g, '');
const buffer = Buffer.from(hexStr, 'hex');
const text = buffer.toString('utf-8');
const cols = text.split('\t');

console.log(`Total Columns: ${cols.length}`);
cols.forEach((col, idx) => console.log(`[${idx}] -> ${col}`));

// Look at Frame 35 for SCP:
const scp = `44 57 4c 09 53 43 50 09 0d 0a 53 43 50 09 30 09 31 09 31 09 0d 0a`;
const scpText = Buffer.from(scp.replace(/\s+/g, ''), 'hex').toString('ascii');
console.log('\nSCP Command:');
console.log(scpText);
