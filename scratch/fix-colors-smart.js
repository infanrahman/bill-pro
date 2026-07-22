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

function processToken(token) {
    // If it doesn't have blue, keep it
    if (!token.includes('blue')) return token;

    // Drop any existing dark mode blue variants, we will auto-generate them from the light mode ones
    if (token.startsWith('dark:') && token.includes('blue')) {
        return '';
    }

    // Extract prefix (e.g. hover:, focus:, group-hover:)
    const parts = token.split(':');
    const baseClass = parts.pop(); // The actual class, e.g. bg-blue-600
    const prefixes = parts.length > 0 ? parts.join(':') + ':' : '';

    // Handle gradients (remove them)
    if (baseClass.startsWith('from-blue') || baseClass.startsWith('via-blue') || baseClass.startsWith('to-blue')) {
        return '';
    }

    // Match the type and shade
    const match = baseClass.match(/^(bg|text|border|ring|stroke|fill)-blue-([0-9]{2,3})(\/[0-9]+)?$/);
    if (!match) return token; // Fallback if it's a weird class

    const type = match[1];
    const shade = parseInt(match[2]);
    const opacity = match[3] || '';

    let light, dark;

    if (type === 'bg') {
        if (shade >= 500) { light = `bg-slate-900${opacity}`; dark = `bg-white${opacity}`; }
        else { light = `bg-slate-100${opacity}`; dark = `bg-slate-800${opacity}`; }
    } else if (type === 'text') {
        if (shade >= 500) { light = `text-slate-900${opacity}`; dark = `text-white${opacity}`; }
        else { light = `text-slate-500${opacity}`; dark = `text-slate-400${opacity}`; }
    } else if (type === 'border') {
        if (shade >= 500) { light = `border-slate-900${opacity}`; dark = `border-white${opacity}`; }
        else { light = `border-slate-300${opacity}`; dark = `border-slate-600${opacity}`; }
    } else if (type === 'ring') {
        light = `ring-slate-900/20`; dark = `ring-white/20`;
    } else if (type === 'fill' || type === 'stroke') {
        if (shade >= 500) { light = `${type}-slate-900${opacity}`; dark = `${type}-white${opacity}`; }
        else { light = `${type}-slate-500${opacity}`; dark = `${type}-slate-400${opacity}`; }
    }

    if (light && dark) {
        return `${prefixes}${light} dark:${prefixes}${dark}`;
    }

    return token;
}

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We need to parse all className="...", className={`...`}, clsx(...) etc.
    // The safest way is to just do a global replace on words that contain 'blue-'
    // But we need to handle the whole token, including prefixes.
    // Let's match any continuous string of characters that represents a tailwind class containing 'blue-'
    // A tailwind class can contain letters, numbers, hyphens, colons, slashes, square brackets, percentages.
    
    // First, let's remove bg-gradient-to-r because gradients are no longer needed
    content = content.replace(/bg-gradient-to-[a-z]+/g, '');
    
    // Replace all tokens containing blue
    content = content.replace(/[a-zA-Z0-9-:/\[\]%]+blue-[0-9]{2,3}(\/[0-9]+)?/g, (match) => {
        return processToken(match);
    });

    // Clean up multiple spaces that might have been created by dropping tokens (returning '')
    content = content.replace(/ +/g, ' ');
    content = content.replace(/ \)/g, ')');
    content = content.replace(/ "/g, '"');
    content = content.replace(/" /g, '"');
    content = content.replace(/ `/g, '`');
    content = content.replace(/` /g, '`');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        updatedCount++;
    }
});

console.log(`Total files updated for dual-tone theme: ${updatedCount}`);
