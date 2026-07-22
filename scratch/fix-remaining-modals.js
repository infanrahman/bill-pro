const fs = require('fs');
const files = [
    'src/components/Settings/LicenseComponents.tsx',
    'src/components/UI/ShareModal.tsx',
    'src/pages/CashBook/AddPartyModal.tsx',
    'src/pages/CashBook/CashEntryModal.tsx',
    'src/pages/Settings/Tabs/DataBackupTab.tsx'
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Specifically target the fixed inset-0 backgrounds
    content = content.replace(/bg-slate-900(?!\/50)/g, 'bg-slate-900/50 backdrop-blur-sm');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
