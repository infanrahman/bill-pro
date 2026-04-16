const net = require('net');

const IP = '192.168.0.150';
const PORT = 33581;

console.log(`Connecting to ${IP}:${PORT} for pushing HOTKEY...`);

const client = new net.Socket();
client.setTimeout(10000);

let responseData = '';

client.on('data', (data) => {
    const chunk = data.toString('ascii');
    responseData += chunk;
    console.log(`Received: ${chunk}`);
});

client.on('connect', () => {
    console.log('Connected! Sending DWL KEY...');

    client.write('DWL\tKEY\t\r\n');

    // Most Rongta/ENOTEQ scales format: KEY \t Page \t KeyIndex \t PLUNo \t
    // or KEY \t KeyIndex \t PLUNo
    // Let's try: KEY \t 1 \t 1 \t 1 \t (Page 1, Key 1, Plu 1)
    client.write('KEY\t1\t1\t1\t\r\n');
    client.write('KEY\t1\t2\t2\t\r\n');

    client.write('END\tKEY\t\r\n');
});

client.on('error', (err) => {
    console.error('Socket error:', err.message);
});

client.on('timeout', () => {
    console.log('Timeout. Closing.');
    client.destroy();
});

client.on('close', () => {
    console.log('Connection closed.');
});

client.connect(PORT, IP);
