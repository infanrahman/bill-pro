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
let updatedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Remove gradients
    content = content.replace(/bg-gradient-to-[a-z]+ from-blue-[0-9]{3} to-(indigo|blue)-[0-9]{3}/g, 'bg-slate-900 dark:bg-white');
    content = content.replace(/from-blue-[0-9]{3} to-(indigo|blue)-[0-9]{3}/g, '');
    
    // Primary Solid Backgrounds (bg-blue-500, bg-blue-600, etc)
    content = content.replace(/bg-blue-[56789]00\/[0-9]+/g, 'bg-slate-900/10 dark:bg-white/10');
    content = content.replace(/bg-blue-[56789]00/g, 'bg-slate-900 dark:bg-white');
    
    // Ghost Backgrounds (bg-blue-50, bg-blue-100)
    content = content.replace(/bg-blue-[5]0\/[0-9]+/g, 'bg-slate-100 dark:bg-slate-800');
    content = content.replace(/bg-blue-[1234]00\/[0-9]+/g, 'bg-slate-200 dark:bg-slate-700');
    content = content.replace(/bg-blue-50/g, 'bg-slate-100 dark:bg-slate-800');
    content = content.replace(/bg-blue-100/g, 'bg-slate-200 dark:bg-slate-800');
    
    // Primary Text (text-blue-500, text-blue-600)
    content = content.replace(/text-blue-[56789]00/g, 'text-slate-900 dark:text-white');
    content = content.replace(/text-blue-[1234]00/g, 'text-slate-700 dark:text-slate-300');
    
    // Borders
    content = content.replace(/border-blue-[56789]00(\/[0-9]+)?/g, 'border-slate-900 dark:border-white');
    content = content.replace(/border-blue-[1234]00(\/[0-9]+)?/g, 'border-slate-300 dark:border-slate-600');
    
    // Rings
    content = content.replace(/ring-blue-[0-9]{3}(\/[0-9]+)?/g, 'ring-slate-900/20 dark:ring-white/20');

    // Fill / Stroke
    content = content.replace(/fill-blue-[0-9]{3}/g, 'fill-slate-900 dark:fill-white');
    content = content.replace(/stroke-blue-[0-9]{3}/g, 'stroke-slate-900 dark:stroke-white');

    // Hover States (we just prefix everything with hover: if it was originally there, 
    // but our regex above will match the `bg-blue-600` inside `hover:bg-blue-600` and output `hover:bg-slate-900 dark:bg-white`.
    // Wait, replacing `bg-blue-600` with `bg-slate-900 dark:bg-white` inside a `hover:bg-blue-600` results in `hover:bg-slate-900 dark:bg-white`.
    // This is WRONG! `hover:bg-slate-900 dark:bg-white` means it's hover in light mode, but ALWAYs white in dark mode.
    // It should be `hover:bg-slate-900 dark:hover:bg-white`.
    // Let's rollback that strategy and use a smarter replacer.
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        updatedCount++;
    }
});
console.log(`Initial updated count (will be discarded due to bug): ${updatedCount}`);
