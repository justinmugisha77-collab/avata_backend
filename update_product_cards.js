const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'frontend', 'src', 'components');
const pagesDir = path.join(__dirname, 'frontend', 'src', 'pages');

const filesToProcess = [
    path.join(componentsDir, 'AllProductsGrid.jsx'),
    ...fs.readdirSync(pagesDir)
        .filter(f => f.endsWith('.jsx'))
        .map(f => path.join(pagesDir, f))
];

let modifiedCount = 0;

for (const file of filesToProcess) {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    let isModified = false;

    // Add import if not exists
    const importStatement = "import ProductCard from '../components/ProductCard';";
    if (!content.includes('import ProductCard') &&
        (content.includes('.map((product') || content.includes('.map((product, idx)'))) {

        // Some files in components folder need different import path
        const actualImport = file.includes('components')
            ? "import ProductCard from './ProductCard';"
            : importStatement;

        content = content.replace(/(import React.*?;\n)/, `$1${actualImport}\n`);
    }

    // Find the start of the products map block
    // Cases: {filteredProducts.map((product, index) => {
    // Cases: {products.map((product, idx) => {
    const mapRegex = /{(filteredProducts|products)\.map\(\(product,\s*(index|idx)\)\s*=>\s*{[\s\S]*?return\s*\(\s*<div.*?key={.*?}[\s\S]*?<\/div>\s*\);\s*}\)}/g;

    content = content.replace(mapRegex, (match, arrayName, indexName) => {
        isModified = true;
        return `{${arrayName}.map((product, ${indexName}) => (
            <ProductCard key={product.id || ${indexName}} product={product} />
          ))}`;
    });

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated: ${file}`);
        modifiedCount++;
    }
}

console.log(`Total files updated: ${modifiedCount}`);
