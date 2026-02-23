# MyShop Billing Application

A robust, offline-capable Desktop Billing & POS application built with Electron, React, TypeScript, and Dexie.js.

## Features

### 🛒 Point of Sale (POS)
- Fast checkout with Barcode Scanner support.
- Cart management (Add, Remove, Adjust Quantity).
- Customer selection and quick-add.
- Multiple payment modes (Cash, Card, UPI, etc.).
- Thermal Receipt Printing.

### 📦 Inventory Management
- Track Stock levels and Low Stock Alerts.
- Manage Items, Categories, and Prices.
- Support for Inclusive/Exclusive Tax.

### 💰 Sales & Invoices
- Create Sales Orders and convert them to Invoices.
- Handle Sales Returns and Refunds.
- Track Payment status (Paid, Pending, Partial, Overdue).
- Generate Professional PDF Invoices (A4).

### 🚚 Purchasing
- Manage Suppliers and Purchase Orders.
- Track Accounts Payable (Supplier Balances).

### 📊 Reports & Dashboard
- Visual Dashboard with Sales/Purchase charts.
- Key Metrics: Revenue, Profit, Top Selling Items.
- Detailed Reports: Sales vs Purchase, Stock Valuation.
- Export Reports to CSV/PDF.

### 🛡️ Data & Security
- **Backup & Restore**: Secure JSON backup of your entire database.
- **User Roles**: Admin (Full Access) vs Shopkeeper (Restricted Access).
- **Activity Logs**: Audit trail for sensitive actions.

## getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Run the app in development mode (with Hot Reload):
```bash
npm run dev
```

### Building for Production
Create the final Windows installer (`.exe`):
```bash
npm run dist
```
The output file will be located in the `dist` folder.

## Technology Stack
- **Frontend**: React 19, TypeScript, TailwindCSS
- **Backend/Shell**: Electron
- **Database**: Dexie.js (IndexedDB wrapper)
- **Charts**: Recharts
- **PDF**: jsPDF, autoTable
- **Icons**: Lucide React

## License
Private / Proprietary
