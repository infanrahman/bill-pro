import re

with open('src/pages/Purchase/PurchaseOrders.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make the first table responsive
content = content.replace('<table className="w-full text-left whitespace-nowrap min-w-[900px]">', '<table className="w-full text-left whitespace-nowrap min-w-[900px] responsive-table">', 1)

# Add data-label to main table cells
content = content.replace('<td {...getGridCellProps(rowIndex, 0)} className="p-4', '<td {...getGridCellProps(rowIndex, 0)} data-label="Date" className="p-4')
content = content.replace('<td {...getGridCellProps(rowIndex, 1)} className="p-4', '<td {...getGridCellProps(rowIndex, 1)} data-label="Ref No" className="p-4')
content = content.replace('<td {...getGridCellProps(rowIndex, 2)} className="p-4', '<td {...getGridCellProps(rowIndex, 2)} data-label="Supplier" className="p-4')
content = content.replace('<td {...getGridCellProps(rowIndex, 3)} className="p-4', '<td {...getGridCellProps(rowIndex, 3)} data-label="Items" className="p-4')
content = content.replace('<td {...getGridCellProps(rowIndex, 4)} className=', '<td {...getGridCellProps(rowIndex, 4)} data-label="Total" className=')
content = content.replace('<td {...getGridCellProps(rowIndex, 5)} className="p-4 outline-none', '<td {...getGridCellProps(rowIndex, 5)} data-label="Status/Balance" className="p-4 flex-col md:flex-row md:items-center items-end gap-2 outline-none')
content = content.replace('<td {...getGridCellProps(rowIndex, 6)} className="p-4 text-right', '<td {...getGridCellProps(rowIndex, 6)} data-label="Actions" className="p-4 text-right')

with open('src/pages/Purchase/PurchaseOrders.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
