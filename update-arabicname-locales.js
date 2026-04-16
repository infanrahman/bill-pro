const fs = require('fs');
const path = require('path');

const localesPath = path.join('d:', 'mobile', 'src', 'locales');

const langs = [
    {
        file: 'en.json',
        keys: { arabic_name: "Arabic Name" }
    },
    {
        file: 'ar.json',
        keys: { arabic_name: "الاسم العربي" }
    },
    {
        file: 'hi.json',
        keys: { arabic_name: "अरबी नाम" }
    },
    {
        file: 'bn.json',
        keys: { arabic_name: "আরবি নাম" }
    }
];

langs.forEach(({ file, keys }) => {
    const filePath = path.join(localesPath, file);
    if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        try {
            const data = JSON.parse(raw);
            if (data.inventory) {
                // Merge keys
                data.inventory = { ...data.inventory, ...keys };
                fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
                console.log(`Updated ${file}`);
            }
        } catch (e) {
            console.error(`Error parsing ${file}`, e);
        }
    }
});
