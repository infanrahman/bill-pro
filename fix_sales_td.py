import re

with open('src/pages/Transactions/SalesHistory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add data-label to td
content = content.replace('<td className="p-6">\n  <span className="font-mono text-[10px]', '<td data-label="Invoice No" className="p-6">\n  <span className="font-mono text-[10px]')
content = content.replace('<td className="p-6 font-bold text-slate-600', '<td data-label="Date" className="p-6 font-bold text-slate-600')
content = content.replace('<td className="p-6 font-semibold text-slate-800', '<td data-label="Customer" className="p-6 font-semibold text-slate-800')
content = content.replace('<td className="p-6 font-semibold text-slate-900', '<td data-label="Amount" className="p-6 font-semibold text-slate-900')
content = content.replace('<td className="p-4">\n  <span className={px-2 py-1.5', '<td data-label="Payment" className="p-4">\n  <span className={px-2 py-1.5')
content = content.replace('<td className="p-4">\n  {inv.zatcaStatus', '<td data-label="ZATCA" className="p-4">\n  {inv.zatcaStatus')
content = content.replace('<td className="p-6 opacity-0 group-hover:opacity-100', '<td data-label="Actions" className="p-6 opacity-0 group-hover:opacity-100 flex-col md:flex-row md:items-center items-end')

# If Actions cell has different spacing, let's find it.
with open('src/pages/Transactions/SalesHistory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
