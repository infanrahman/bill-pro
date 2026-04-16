const net = require('net');

const IP = '192.168.0.150';
const PORT = 33581;

console.log(`Connecting to ${IP}:${PORT}...`);

const client = new net.Socket();
client.setTimeout(10000);

let responseData = '';

client.on('data', (data) => {
    const chunk = data.toString('ascii');
    responseData += chunk;
    console.log(`Received ${chunk.length} bytes...`);
});

client.on('connect', () => {
    console.log('Connected! Sending UPL PLU...');
    client.write('UPL\tPLU\t\r\n');
    client.write('END\tPLU\t\r\n');
});

client.on('error', (err) => {
    console.error('Socket error:', err.message);
});

client.on('timeout', () => {
    console.log('Timeout. Closing.');
    client.destroy();
    console.log('Final data received:');
    console.log(responseData);
});

client.on('close', () => {
    console.log('Connection closed.');
    console.log('Final data received:');
    console.log(responseData);
});

client.connect(PORT, IP);
