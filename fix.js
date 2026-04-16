const fs = require('fs');
const dir = 'd:/mobile/src/pages';

function walk(d) {
    let results = [];
    const list = fs.readdirSync(d);
    list.forEach(file => {
        file = d + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
        }
    });
    return results;
}

const files = walk(dir);
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    let old = content;
    
    // map/filter/forEach/and etc no parens
    content = content.replace(/\.(filter|map|forEach|and|every|some)\(\s*([a-zA-Z0-9_]+)\s*=>/g, '.$1(($2: any) =>');
    
    // Multiple args like sort((a, b) => or reduce((sum, item) => or map((item, id) =>
    content = content.replace(/\.(sort|reduce|map|filter)\(\(\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\)\s*=>/g, '.$1(($2: any, $3: any) =>');
    
    // map((log) => or filter((log) => 
    content = content.replace(/\.(map|filter|forEach)\(\(\s*([a-zA-Z0-9_]+)\s*\)\s*=>/g, '.$1(($2: any) =>');
    
    if (old !== content) {
        console.log(`Fixed ${file}`);
        fs.writeFileSync(file, content);
    }
}
