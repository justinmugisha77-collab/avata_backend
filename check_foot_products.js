const db = require('./config/db');

async function checkFootProducts() {
  const [rows] = await db.execute(`
    SELECT p.id, p.name, p.category as old_category, p.category_id, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.category LIKE '%FOOT%' OR c.name LIKE '%FOOT%'
  `);
  
  console.log('FOOT PROTECTION Products:');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

checkFootProducts();
