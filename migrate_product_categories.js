const db = require('./config/db');

async function migrateProductCategories() {
  try {
    console.log('Migrating product categories to use category_id...\n');

    // Get all categories
    const [categories] = await db.execute('SELECT * FROM categories');
    console.log('Found categories:', categories.map(c => ({ id: c.id, name: c.name })));

    // Category mapping - normalize names to match
    const categoryMap = {
      'WORK WEAR': 'Workwear',
      'WORKWEAR': 'Workwear',
      'FOOT PROTECTION': 'FOOT PROTECTION',
      'FOOTPROTECTION': 'FOOT PROTECTION',
      'HEAD PROTECTION': 'Head Protection',
      'HEADPROTECTION': 'Head Protection',
      'DUSTMASK': 'Dust Masks',
      'DUST MASKS': 'Dust Masks',
      'EYE PROTECTION': 'Eye Protection',
      'EYEPROTECTION': 'Eye Protection',
      'EAR PROTECTION': 'Hearing Protection',
      'EARPROTECTION': 'Hearing Protection',
      'HEARING PROTECTION': 'Hearing Protection',
      'GLOVES': 'Gloves',
      'FALL PROTECTION': 'Fall Protection',
      'FALLPROTECTION': 'Fall Protection',
      'FIRST AID': 'First Aid',
      'FIRSTAID': 'First Aid',
      'RESPIRATORS': 'Respirators'
    };

    // Get all products with NULL category_id
    const [products] = await db.execute(`
      SELECT id, name, category, category_id 
      FROM products 
      WHERE category_id IS NULL
    `);

    console.log(`\nFound ${products.length} products to migrate\n`);

    let updated = 0;
    let notFound = 0;

    for (const product of products) {
      const oldCategory = (product.category || '').toUpperCase().trim();
      
      // Try to find matching category
      let categoryId = null;
      
      // First, try direct mapping
      const mappedName = categoryMap[oldCategory];
      if (mappedName) {
        const category = categories.find(c => c.name === mappedName);
        if (category) {
          categoryId = category.id;
        }
      }

      // If not found, try fuzzy matching
      if (!categoryId) {
        const normalizedOld = oldCategory.replace(/\s+/g, '').toLowerCase();
        const category = categories.find(c => {
          const normalizedCat = c.name.replace(/\s+/g, '').toLowerCase();
          return normalizedCat === normalizedOld || normalizedCat.includes(normalizedOld);
        });
        if (category) {
          categoryId = category.id;
        }
      }

      if (categoryId) {
        await db.execute(
          'UPDATE products SET category_id = ? WHERE id = ?',
          [categoryId, product.id]
        );
        console.log(`✓ Product "${product.name}" (${product.category}) → Category ID ${categoryId}`);
        updated++;
      } else {
        console.log(`✗ Product "${product.name}" - No matching category for "${product.category}"`);
        notFound++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Updated: ${updated} products`);
    console.log(`   Not found: ${notFound} products`);

    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateProductCategories();
