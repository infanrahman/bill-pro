import re

with open('src/pages/Transactions/SalesHistory.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make the first matching table responsive
content = content.replace('<table className="w-full text-left whitespace-nowrap min-w-[900px]">', '<table className="w-full text-left whitespace-nowrap min-w-[900px] responsive-table">', 1)

# Add data-label to main table cells
content = content.replace('<td {...getGridCellProps(rowIndex, 0)} className="p-6', '<td {...getGridCellProps(rowIndex, 0)} data-label="Invoice No" className="p-6')
content = content.replace('<td {...getGridCellProps(rowIndex, 1)} className="p-6', '<td {...getGridCellProps(rowIndex, 1)} data-label="Date" className="p-6')
content = content.replace('<td {...getGridCellProps(rowIndex, 2)} className="p-6', '<td {...getGridCellProps(rowIndex, 2)} data-label="Customer" className="p-6')
content = content.replace('<td {...getGridCellProps(rowIndex, 3)} className="p-6', '<td {...getGridCellProps(rowIndex, 3)} data-label="Amount" className="p-6')
content = content.replace('<td {...getGridCellProps(rowIndex, 4)} className="p-6', '<td {...getGridCellProps(rowIndex, 4)} data-label="Payment" className="p-6')

# Zatca is dynamic, let's just do a regex replace for any p-6 cell
content = re.sub(r'(<td \{\.\.\.getGridCellProps\(rowIndex, \d+\)\} className="p-6[^"]*">)', 
                 lambda m: m.group(1).replace('className="p-6', 'data-label="Status/Actions" className="p-6 flex-col md:flex-row md:items-center items-end gap-2') if 'Actions' not in m.group(1) else m.group(1), content)

with open('src/pages/Transactions/SalesHistory.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
