const fs = require('fs');
const path = require('path');

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
      // Capture t("something"), t('something'), t(`something`)
      const regex = /t\((['"`])(.*?)\1\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        results.push(match[2]);
      }
    }
  }
  return results;
}

const keys = scanDir('d:/mobile/src');
const uniqueKeys = [...new Set(keys)];

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

const missingKeys = uniqueKeys.filter(key => {
  // If it's empty string or contains spaces/special chars, it might not be a valid i18n key but check anyway
  if (!key || key.includes(' ') || !key.includes('.')) return false; 
  
  const parts = key.split(/[\.:]/);
  return getNestedValue(en, parts) === undefined;
});

if (missingKeys.length > 0) {
  console.log('Found missing keys:');
  missingKeys.forEach(key => {
    const parts = key.split(/[\.:]/);
    const lastPart = parts[parts.length - 1];
    const value = titleCase(lastPart);
    console.log(`${key} -> ${value}`);
    setNestedValue(en, parts, value);
  });
  fs.writeFileSync(enPath, JSON.stringify(en, null, 4), 'utf8');
  console.log('Updated en.json');
} else {
  console.log('No missing keys found in en.json.');
}
