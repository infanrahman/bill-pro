const net = require('net');
const fs = require('fs');

const PROXY_PORT = 33582;
const SCALE_IP = '192.168.0.150';
const SCALE_PORT = 33581;

// Clear old log
fs.writeFileSync('d:\\mobile\\proxy_dump.txt', '');

const server = net.createServer((clientSocket) => {
    console.log(`[PROXY] Client connected from ${clientSocket.remoteAddress}`);

    const scaleSocket = new net.Socket();

    scaleSocket.connect(SCALE_PORT, SCALE_IP, () => {
        console.log(`[PROXY] Connected to Scale at ${SCALE_IP}:${SCALE_PORT}`);
    });

    clientSocket.on('data', (data) => {
        const str = data.toString('utf8');
        console.log(`[>> TO SCALE] ${str}`);
        fs.appendFileSync('d:\\mobile\\proxy_dump.txt', `\n[>> TO SCALE]\n${str}`);
        scaleSocket.write(data);
    });

    scaleSocket.on('data', (data) => {
        const str = data.toString('utf8');
        console.log(`[<< FROM SCALE] ${str}`);
        fs.appendFileSync('d:\\mobile\\proxy_dump.txt', `\n[<< FROM SCALE]\n${str}`);
        clientSocket.write(data);
    });

    clientSocket.on('error', (err) => console.log('Client error:', err.message));
    scaleSocket.on('error', (err) => console.log('Scale error:', err.message));

    clientSocket.on('close', () => scaleSocket.destroy());
    scaleSocket.on('close', () => clientSocket.destroy());
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
    console.log(`[PROXY] Listening on port ${PROXY_PORT}...`);
    console.log(`[PROXY] Waiting for IM-xA software to connect...`);
});
