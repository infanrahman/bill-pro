import re

with open('src/pages/Settings/Tabs/NetworkSyncTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("from 'capacitor-zeroconf'", "from '@mhaberler/capacitor-zeroconf-nsd'")

with open('src/pages/Settings/Tabs/NetworkSyncTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
