const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    content = content.replace(/font-black/g, 'font-semibold');
    content = content.replace(/rounded-\[3rem\]/g, 'rounded-2xl');
    content = content.replace(/rounded-\[2\.5rem\]/g, 'rounded-2xl');
    content = content.replace(/rounded-\[2rem\]/g, 'rounded-2xl');
    content = content.replace(/rounded-\[1\.5rem\]/g, 'rounded-xl');
    content = content.replace(/tracking-widest/g, 'tracking-wider');
    content = content.replace(/tracking-\[0\.3em\]/g, 'tracking-wider');
    content = content.replace(/tracking-\[0\.2em\]/g, 'tracking-wide');
    content = content.replace(/tracking-tighter/g, 'tracking-tight');
    content = content.replace(/bg-slate-900 dark:bg-blue-600/g, 'bg-slate-800 dark:bg-slate-700'); // more professional than solid blue
    content = content.replace(/bg-blue-500 blur-\[100px\]/g, 'bg-blue-500/20 blur-[100px]'); // soften glow
    content = content.replace(/bg-blue-600 blur-\[80px\]/g, 'bg-blue-600/20 blur-[80px]');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
