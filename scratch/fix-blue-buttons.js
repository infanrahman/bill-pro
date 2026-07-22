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

    // Fix exact identical color matches: bg-blue-600 text-blue-600 -> bg-blue-600 text-white
    content = content.replace(/bg-blue-([456]00) text-blue-\1/g, 'bg-blue-$1 text-white');
    
    // Sometimes there might be a gap: bg-blue-600 dark:text-blue-400 text-blue-600
    // We'll also just replace text-blue-[456]00 with text-white if bg-blue-[456]00 is anywhere in the className, 
    // but the regex above covers 90% of the issues based on our grep search.
    
    // Also let's fix `text-blue-500` if `bg-blue-600`
    content = content.replace(/bg-blue-600 text-blue-500/g, 'bg-blue-600 text-white');
    content = content.replace(/bg-blue-600 dark:text-blue-400/g, 'bg-blue-600 dark:text-white');
    content = content.replace(/bg-blue-500 text-blue-600/g, 'bg-blue-500 text-white');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
        updatedCount++;
    }
});
console.log(`Total files fixed for button colors: ${updatedCount}`);
