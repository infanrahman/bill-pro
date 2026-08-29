import re

with open('src/pages/POS/PosTerminal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("<PauseCircle size={14} /> {t('pos.hold_bill', 'Hold Bill')}", "<PauseCircle size={14} /> {t('pos.table_order', 'Table Order / Hold')}")
content = content.replace("<PlayCircle size={14} /> {t('pos.held_bills', 'Held Bills')}", "<PlayCircle size={14} /> {t('pos.active_tables', 'Active Tables')}")
content = content.replace("title={t('pos.hold_bill', 'Hold Bill')}", "title={t('pos.table_order', 'Table Order / Hold')}")
content = content.replace("{t('pos.hold_bill_name', 'Enter a reference name for this held bill (e.g., Table 4, John):')}", "{t('pos.hold_bill_name', 'Enter Table Number or Name (e.g. Table 4):')}")

with open('src/pages/POS/PosTerminal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Renamed')
