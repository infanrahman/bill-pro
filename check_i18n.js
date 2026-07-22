const fs = require('fs');
const path = require('path');

const enPath = path.join('d:/mobile/src/locales/en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function getNestedValue(obj, pathParts) {
  let current = obj;
  for (const part of pathParts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
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
      const regex = /t\(['"]([^'"]+)['"]\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        const parts = key.split('.');
        if (getNestedValue(en, parts) === undefined) {
          results.push({ file: fullPath, key });
        }
      }
    }
  }
  return results;
}

const missing = scanDir('d:/mobile/src');
const uniqueMissing = {};
missing.forEach(m => {
  if (!uniqueMissing[m.key]) uniqueMissing[m.key] = new Set();
  uniqueMissing[m.key].add(m.file);
});

for (const key in uniqueMissing) {
  console.log(`${key} (in ${Array.from(uniqueMissing[key]).length} files)`);
}
