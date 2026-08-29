import re

with open('src/pages/Transactions/SalesHistory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the actions column td
content = content.replace('</td>\n)}\n <td className="p-6">\n <div className="flex items-center justify-end gap-2', '</td>\n)}\n <td data-label="Actions" className="p-6 flex-col md:flex-row md:items-center items-end gap-2">\n <div className="flex items-center justify-end gap-2')

with open('src/pages/Transactions/SalesHistory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
