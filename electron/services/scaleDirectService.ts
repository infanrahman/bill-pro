import net from 'net';

export interface SyncResponse {
    success: boolean;
    message: string;
    data?: any;
}

export class ScaleDirectService {
    private ip: string;
    private port: number;
    private maxRetries: number = 3;

    constructor(ip: string, port: number = 33581) {
        this.ip = ip;
        this.port = port;
    }

    private async executeCommand(command: string, subCommand: string, dataLines: string[] = []): Promise<string> {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            client.setTimeout(10000); // 10 sec per attempt

            let responseData = '';

            client.on('data', (data) => {
                const chunk = data.toString('ascii');
                responseData += chunk;
            });

            client.on('connect', () => {
                console.log(`[Scale ${this.ip}] Connected for ${command} ${subCommand}, sending payload...`);

                // Removed BOM for pure ASCII communication
                // Header: <COMMAND>\t<SUBCOMMAND>\t\r\n
                client.write(`${command}\t${subCommand}\t\r\n`);

                // Data Lines
                for (const line of dataLines) {
                    client.write(`${line}\r\n`);
                }

                // Footer: END\t<SUBCOMMAND>\t\r\n
                client.write(`END\t${subCommand}\t\r\n`);
            });

            const cleanup = () => {
                if (!client.destroyed) client.destroy();
            };

            client.on('error', (err) => {
                console.error(`[Scale ${this.ip}] Socket error on ${command} ${subCommand}:`, err.message);
                cleanup();
                reject(err);
            });

            client.on('timeout', () => {
                // Many scales do not cleanly close the connection after sending data
                console.log(`[Scale ${this.ip}] Socket timeout. Received ${responseData.length} bytes.`);
                cleanup();
                if (responseData.length > 0) {
                    resolve(responseData);
                } else {
                    reject(new Error('Connection timed out without receiving data. Verify scale port and IP.'));
                }
            });

            client.on('end', () => {
                cleanup();
                resolve(responseData);
            });

            client.on('close', () => {
                cleanup();
                resolve(responseData);
            });

            client.connect(this.port, this.ip);
        });
    }

    // Wrapper with 3 retries
    private async sendCommandWithRetry(command: string, subCommand: string, dataLines: string[] = []): Promise<SyncResponse> {
        let lastError: any;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`[Scale ${this.ip}] Attempt ${attempt}/${this.maxRetries} for ${command} ${subCommand}`);
                const responseData = await this.executeCommand(command, subCommand, dataLines);
                return { success: true, message: 'Success', data: responseData };
            } catch (err: any) {
                lastError = err;
                console.warn(`[Scale ${this.ip}] Attempt ${attempt} failed: ${err.message}`);
                if (attempt < this.maxRetries) {
                    // Wait 1 second before retry
                    await new Promise(res => setTimeout(res, 1000));
                }
            }
        }

        return { success: false, message: lastError?.message || 'Max retries exhausted' };
    }

    // --- Supported Command Types ---

    public async connect(): Promise<SyncResponse> {
        return new Promise((resolve) => {
            const client = new net.Socket();
            client.setTimeout(10000); // 10 sec fail

            const cleanup = () => {
                if (!client.destroyed) client.destroy();
            };

            client.on('connect', () => {
                cleanup();
                resolve({ success: true, message: 'Connection successful' });
            });

            client.on('error', (err) => {
                cleanup();
                resolve({ success: false, message: `TCP Error: ${err.message}` });
            });

            client.on('timeout', () => {
                cleanup();
                // We resolve(false) instead of reject to return a SyncResponse
                resolve({ success: false, message: 'TCP Connection timed out' });
            });

            console.log(`[Scale ${this.ip}] Pinging scale on port ${this.port}...`);
            client.connect(this.port, this.ip);
        });
    }

    public disconnect() {
        // Since the protocol is stateless open/close per command, there is no persistent socket to disconnect here.
        console.log(`[Scale ${this.ip}] Disconnect called (stateless protocol)`);
    }

    public async syncTime(timeStr?: string): Promise<SyncResponse> {
        // Default fallback formats to YYYY-MM-DD HH:mm:ss if nothing provided
        const timeToSend = timeStr || new Date().toISOString().replace('T', ' ').substring(0, 19);
        const res = await this.sendCommandWithRetry('DWL', 'TIM', [timeToSend]);
        if (res.success) res.message = 'Time synced successfully';
        return res;
    }

    public async uploadPLU(product: any): Promise<SyncResponse> {
        // PLU\t{pluNo}\t{name}\t{price}\t{barcode}\t{department}\t{labelFormat}\t\r\n
        const line = this.buildPluLine(product);
        const pluNo = product.rawScaleData?.plu || product.barcode || '00000';

        const res = await this.sendCommandWithRetry('DWL', 'PLU', [line]);
        if (res.success) {
            res.message = `Uploaded PLU ${pluNo} successfully`;
        }
        return res;
    }

    public async deletePLU(pluNumber: string): Promise<SyncResponse> {
        const res = await this.sendCommandWithRetry('DEL', 'PLU', [pluNumber]);
        if (res.success) res.message = `Deleted PLU ${pluNumber} successfully`;
        return res;
    }

    public async downloadPLU(): Promise<SyncResponse> {
        const res = await this.sendCommandWithRetry('UPL', 'PLU');
        if (res.success) {
            res.message = 'Downloaded successfully';
            try {
                require('fs').writeFileSync('C:\\temp_scale_debug.txt', res.data || 'No data');
            } catch (e) { }
            // The raw string response needs parsing on front-end or here. 
            // Sending raw data back to renderer to conform to Item[] structure.
        }
        return res;
    }

    private buildPluLine(product: any): string {
        const raw = product.rawScaleData || {};
        const pluNo = raw.plu || product.barcode || '00000';
        const name = product.name || 'Unknown';
        const unit = raw.unit === 'Piece' ? 1 : 0; // Assuming 0=Weight, 1=Piece for scales
        const price = (product.salePrice || 0).toFixed(2).replace('.', ','); // ENOTEQ uses comma
        const itemCode = raw.itemCode || '0';
        const indexBarcode = raw.indexBarcode || pluNo;
        const printDate = raw.printShelfDate === 'Print' ? 1 : 0;
        const shelfDays = raw.shelfDays || 0;
        const department = product.categoryId || 0;

        // ENOTEQ requires exactly a 68-index tab-separated upload format based on Wireshark PCAP
        const cols = new Array(68).fill('0');
        cols[0] = 'PLU';
        cols[1] = pluNo.toString();        // Number
        cols[2] = '0';                     // Item Code? Usually 0
        cols[3] = indexBarcode.toString(); // Index barcode (e.g. 456)
        cols[4] = unit.toString();         // Unit (1=Weight, 0=Piece)
        cols[5] = price.toString();        // U.Price (e.g. 15,1)
        cols[6] = '0,0';
        cols[7] = '0,0';
        cols[8] = '0';
        cols[14] = department.toString() === '0' ? '9' : department.toString(); // Department
        cols[15] = name;                   // Name

        cols[16] = '';
        cols[17] = '';
        cols[18] = '';
        cols[19] = '';
        cols[20] = '';
        cols[21] = '';
        cols[22] = '';

        cols[35] = '0,0';
        cols[36] = '0,0';
        cols[38] = '127';
        cols[39] = '0,0';
        cols[40] = '0,0';
        cols[41] = '0,0';

        cols[43] = '127';
        cols[44] = '0,0';
        cols[45] = '0,0';
        cols[46] = '0,0';

        cols[48] = '127';
        cols[49] = '0,0';
        cols[50] = '0,0';
        cols[51] = '0,0';

        cols[53] = '127';
        cols[54] = '0,0';
        cols[55] = '0,0';
        cols[56] = '0,0';

        cols[64] = name; // Name gets appended twice

        return cols.join('\t');
    }

    public async fullSync(products: any[]): Promise<SyncResponse> {
        console.log(`[Scale ${this.ip}] Starting Full Sync for ${products.length} products`);
        if (products.length === 0) return { success: true, message: 'No products to sync' };

        // Group all PLU lines into ONE TCP payload
        const lines = products.map(p => this.buildPluLine(p));
        const res = await this.sendCommandWithRetry('DWL', 'PLU', lines);

        if (res.success) {
            res.message = `Full Sync: ${products.length} uploaded successfully`;
        } else {
            res.message = `Full Sync Failed: ${res.message}`;
        }
        return res;
    }

    public async syncHotkeys(hotkeys: { keyIndex: number, plu: number }[]): Promise<SyncResponse> {
        console.log(`[Scale ${this.ip}] Syncing ${hotkeys.length} hotkeys via SCP`);
        if (hotkeys.length === 0) return { success: true, message: 'No hotkeys to sync' };

        // Wireshark PCAP revealed HOTKEYS are defined via 'DWL SCP'
        // Format: SCP \t Page(0) \t KeyIndex(1) \t PluNo(1) \t \r\n
        const lines = hotkeys.map(hk => `SCP\t0\t${hk.keyIndex}\t${hk.plu}\t`);

        const res = await this.sendCommandWithRetry('DWL', 'SCP', lines);

        if (res.success) {
            res.message = `${hotkeys.length} Hotkeys synchronized successfully`;
        } else {
            res.message = `Hotkey Sync Failed: ${res.message}`;
        }
        return res;
    }

    public async incrementalSync(products: any[]): Promise<SyncResponse> {
        console.log(`[Scale ${this.ip}] Starting Incremental Sync for ${products.length} products`);
        if (products.length === 0) return { success: true, message: 'No products to sync' };

        // Even incremental sync should batch the updates in one transmission
        const lines = products.map(p => this.buildPluLine(p));
        const res = await this.sendCommandWithRetry('DWL', 'PLU', lines);

        if (res.success) {
            res.message = `Incremental Sync: ${products.length} updated successfully`;
        } else {
            res.message = `Incremental Sync Failed: ${res.message}`;
        }
        return res;
    }
}
