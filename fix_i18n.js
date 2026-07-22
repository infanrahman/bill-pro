const fs = require('fs');
const path = require('path');

const enPath = path.join('d:/mobile/src/locales/en.json');
let en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function getNestedValue(obj, pathParts) {
  let current = obj;
  for (const part of pathParts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedValue(obj, pathParts, value) {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  current[pathParts[pathParts.length - 1]] = value;
}

function titleCase(str) {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function scanDir(dir) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(scanDir(fullPath));
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const regex = /t\(['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"]\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        const parts = key.split('.');
        if (getNestedValue(en, parts) === undefined) {
          results.push(key);
        }
      }
    }
  }
  return results;
}

const missing = scanDir('d:/mobile/src');
const uniqueMissing = [...new Set(missing)];

console.log('Found missing valid i18n keys:');
uniqueMissing.forEach(key => {
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1];
  const value = titleCase(lastPart);
  console.log(`${key} -> ${value}`);
  setNestedValue(en, parts, value);
});

fs.writeFileSync(enPath, JSON.stringify(en, null, 4), 'utf8');
console.log('Updated en.json');
