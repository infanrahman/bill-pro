const net = require('net');
const fs = require('fs');
const IP = '192.168.0.150';
const PORT = 33581;

const client = new net.Socket();
client.setTimeout(10000);

let buffers = [];

client.on('data', (data) => {
    buffers.push(data);
});

client.on('connect', () => {
    client.write('UPL\tPLU\t\r\n');
    client.write('END\tPLU\t\r\n');
});

client.on('timeout', () => {
    client.destroy();
    const finalData = Buffer.concat(buffers);
    fs.writeFileSync('d:\\mobile\\scale_dump_hex.txt', finalData.toString('hex'));
    fs.writeFileSync('d:\\mobile\\scale_dump_raw.txt', finalData.toString('utf-8'));
    console.log('Saved to scale_dump_raw.txt');
});

client.connect(PORT, IP);
