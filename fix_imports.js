const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'frontend', 'src', 'pages');

const files = fs.readdirSync(pagesDir)
    .filter(f => f.endsWith('.jsx'))
    .map(f => path.join(pagesDir, f));

let fixed = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Only fix files that USE ProductCard but DON'T import it
    if (content.includes('<ProductCard') && !content.includes("import ProductCard")) {
        // Add the import right after the first import line
        content = content.replace(
            /(import React[^\n]*\n)/,
            `$1import ProductCard from '../components/ProductCard';\n`
        );
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Fixed: ${path.basename(file)}`);
        fixed++;
    }
}

console.log(`\nTotal fixed: ${fixed}`);
