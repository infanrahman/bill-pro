const fs = require('fs');
const path = require('path');

const localesPath = path.join('d:', 'mobile', 'src', 'locales');

const langs = [
    {
        file: 'en.json',
        keys: {
            select: "Select",
            exclusive: "Exclusive",
            inclusive: "Inclusive"
        }
    },
    {
        file: 'ar.json',
        keys: {
            select: "تحديد",
            exclusive: "غير شامل",
            inclusive: "شامل"
        }
    },
    {
        file: 'hi.json',
        keys: {
            select: "चुनें",
            exclusive: "छोड़कर",
            inclusive: "सहित"
        }
    },
    {
        file: 'bn.json',
        keys: {
            select: "নির্বাচন করুন",
            exclusive: "বাদ দিয়ে",
            inclusive: "সহ"
        }
    }
];

langs.forEach(({ file, keys }) => {
    const filePath = path.join(localesPath, file);
    if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        try {
            const data = JSON.parse(raw);
            if (data.common) {
                // Merge keys
                data.common = { ...data.common, ...keys };
                fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
                console.log(`Updated ${file}`);
            }
        } catch (e) {
            console.error(`Error parsing ${file}`, e);
        }
    }
});
