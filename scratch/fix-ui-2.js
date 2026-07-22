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

    // Fix the invisible tab text by making the overlay 10% opacity
    content = content.replace(/className="absolute inset-0 bg-blue-600 dark:bg-white"/g, 'className="absolute inset-0 bg-blue-600/10 dark:bg-white/10"');

    // Fix missing text-white in StatCard icons or solid boxes
    content = content.replace(/className=\{`p-4 rounded-2xl \$\{item\.bg\} \$\{item\.color\} group-  `\}/g, 'className={`p-4 rounded-2xl ${item.bg} text-white`}');

    // Fix StatCard color missing in Dashboard
    content = content.replace(/color: 'text-indigo-500', bg: 'bg-indigo-500'/g, 'color: \'text-white\', bg: \'bg-indigo-500\'');
    content = content.replace(/color: 'text-blue-500', bg: 'bg-blue-500'/g, 'color: \'text-white\', bg: \'bg-blue-500\'');
    content = content.replace(/color: 'text-rose-500', bg: 'bg-rose-500\/10'/g, 'color: \'text-rose-500\', bg: \'bg-rose-500/10\''); // This one might be fine as is

    // Remove the annoying absolute blur background decorators completely
    content = content.replace(/<div[^>]*blur-\[\d+px\][^>]*\/>/g, '');
    content = content.replace(/<div[^>]*blur-3xl[^>]*\/>/g, '');

    // Simplify the overall background
    content = content.replace(/bg-gradient-to-br from-blue-50 to-indigo-50/g, 'bg-slate-50');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
