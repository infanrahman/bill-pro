const mod = require('png-to-ico');

// Ensure we use the correct function export
const convert = mod.default || mod;

// Pass an ARRAY of file paths
convert(['d:/mobile/build/icon.png'])
    .then(buf => {
        require('fs').writeFileSync('d:/mobile/build/icon.ico', buf);
        console.log('Successfully created build/icon.ico');
    })
    .catch(err => {
        console.error('Conversion failed:', err);
        process.exit(1);
    });
