import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class ThermalPrinterService {
    private printer: ThermalPrinter;

    constructor() {
        this.printer = new ThermalPrinter({
            type: PrinterTypes.EPSON, // Default to EPSON (most common)
            interface: 'printer', // Not used for buffer generation
            characterSet: CharacterSet.PC864_ARABIC, // Critical for Arabic
            removeSpecialCharacters: false,
            lineCharacter: "-",
            options: {
                timeout: 5000
            }
        });
    }

    async printReceipt(data: any, printerName: string) {
        try {
            this.printer.clear();

            // 1. Header
            this.printer.alignCenter();
            if (data.businessName) {
                this.printer.bold(true);
                this.printer.println(data.businessName);
                this.printer.bold(false);
            }
            if (data.businessAddress) {
                this.printer.println(data.businessAddress);
            }
            if (data.businessPhone) {
                this.printer.println(`Tel: ${data.businessPhone}`);
            }
            this.printer.drawLine();

            // 2. Title & Meta
            if (data.title) {
                this.printer.bold(true);
                this.printer.println(data.title);
                this.printer.bold(false);
                this.printer.println("");
            }

            this.printer.alignLeft();
            if (data.date) this.printer.println(`Date: ${data.date}`);
            if (data.invoiceNo) this.printer.println(`Ref: ${data.invoiceNo}`);
            if (data.customerName) this.printer.println(`Customer: ${data.customerName}`);
            if (data.customerPhone) this.printer.println(`Phone: ${data.customerPhone}`);
            if (data.customerAddress) this.printer.println(`Addr: ${data.customerAddress}`);
            if (data.customerVatNumber) this.printer.println(`VAT: ${data.customerVatNumber}`);

            this.printer.drawLine();

            // 3. Items
            this.printer.tableCustom([
                { text: "Item", align: "LEFT", width: 0.45 },
                { text: "Qty", align: "CENTER", width: 0.15 },
                { text: "T", align: "RIGHT", width: 0.25 }
            ]);
            this.printer.drawLine();

            if (data.items && Array.isArray(data.items)) {
                data.items.forEach((item: any) => {
                    this.printer.tableCustom([
                        { text: item.name, align: "LEFT", width: 0.45 },
                        { text: item.qty.toString(), align: "CENTER", width: 0.15 },
                        { text: item.total, align: "RIGHT", width: 0.25 }
                    ]);
                });
            }

            this.printer.drawLine();

            // 4. Totals
            this.printer.alignRight();
            if (data.subTotal) this.printer.println(`Subtotal: ${data.subTotal}`);
            if (data.tax) this.printer.println(`VAT (${data.taxRate || 15}%): ${data.tax}`);
            if (data.discount > 0) this.printer.println(`Discount: ${data.discount}`);

            this.printer.bold(true);
            if (data.grandTotal) this.printer.println(`TOTAL: ${data.grandTotal}`);
            this.printer.bold(false);

            if (data.paidAmount !== undefined) this.printer.println(`Paid: ${data.paidAmount}`);
            if (data.remainingAmount !== undefined && data.remainingAmount > 0) this.printer.println(`Balance: ${data.remainingAmount}`);

            this.printer.println("");
            this.printer.alignCenter();
            if (data.footer) this.printer.println(data.footer);

            this.printer.cut();

            // 5. Send to Printer
            const buffer = this.printer.getBuffer();
            const success = await this.sendToPrinter(buffer, printerName);

            return success;
        } catch (error) {
            console.error('Thermal Print Failed:', error);
            return false;
        }
    }

    // Raw printing bypass
    private async sendToPrinter(buffer: Buffer, printerName: string): Promise<boolean> {
        const tempPath = path.join(app.getPath('temp'), `print_${Date.now()}.bin`);
        await fs.writeFile(tempPath, buffer);

        // Best command for Windows Raw Print without Drivers
        // Use Powershell to copy bytes to the printer queue if possible, OR standard LPR
        // Reliable fallback: COPY /B file \\Computer\Printer
        // NOTE: This usually requires the printer to be Shared.

        const computerName = process.env.COMPUTERNAME || 'localhost';
        // Sanitize printer name for path
        const safePrinterName = printerName;

        // Command: print /D:"\\%COMPUTERNAME%\Printer" "File"
        // or Copy "File" "\\%COMPUTERNAME%\Printer"

        const command = `print /D:"\\\\${computerName}\\${safePrinterName}" "${tempPath}"`;
        console.log('Executing Print Command:', command);

        try {
            const { stdout, stderr } = await execAsync(command);
            console.log('Print Output:', stdout);

            // Check for common failure messages even if exit code is 0
            if (stdout.includes("Unable to initialize device") || stdout.includes("Fail")) {
                console.error("Print command failed (detected in stdout):", stdout);
                return false;
            }

            if (stderr) console.error('Print Stderr:', stderr);
            return true;
        } catch (e) {
            // Fallback: Copy
            console.warn("Print command failed, trying Copy...", e);
            try {
                await execAsync(`copy /B "${tempPath}" "\\\\${computerName}\\${safePrinterName}"`);
                return true;
            } catch (e2) {
                console.error("All Copy/Print methods failed:", e2);
                return false;
            }
        } finally {
            try { await fs.unlink(tempPath); } catch { }
        }
    }
}
