const net = require('net');

const IP = '192.168.0.150';
const PORT = 33581;

console.log(`Connecting to ${IP}:${PORT} for HOTKEY layout...`);

const client = new net.Socket();
client.setTimeout(10000);

let responseData = '';

client.on('data', (data) => {
    const chunk = data.toString('ascii');
    responseData += chunk;
});

client.on('connect', () => {
    console.log('Connected! Sending UPL HOTKEY...');
    client.write('UPL\tHOTKEY\t\r\n');
    client.write('END\tHOTKEY\t\r\n');

    // Also try 'KEY' just in case
    setTimeout(() => {
        console.log('Sending UPL KEY...');
        client.write('UPL\tKEY\t\r\n');
        client.write('END\tKEY\t\r\n');
    }, 2000);
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
