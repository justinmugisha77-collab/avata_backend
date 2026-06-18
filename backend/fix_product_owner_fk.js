const db = require('./config/db');

async function fixProductOwnerFK() {
  try {
    console.log('Fixing products table foreign key constraint...');

    // Check if the constraint exists
    const [constraints] = await db.execute(`
      SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'trading'
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'owner_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    console.log('Current constraints:', constraints);

    // Drop the old foreign key constraint if it exists
    if (constraints.length > 0) {
      const constraintName = constraints[0].CONSTRAINT_NAME;
      console.log(`Dropping constraint: ${constraintName}`);
      
      await db.execute(`
        ALTER TABLE products 
        DROP FOREIGN KEY ${constraintName}
      `);
      console.log('Old constraint dropped successfully!');
    }

    // Check if users table exists
    const [usersTables] = await db.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'trading' 
      AND TABLE_NAME = 'users'
    `);

    if (usersTables.length === 0) {
      console.error('ERROR: Users table does not exist!');
      process.exit(1);
    }

    // Add new foreign key constraint to reference users table
    console.log('Adding new foreign key constraint to reference users table...');
    
    await db.execute(`
      ALTER TABLE products 
      ADD CONSTRAINT products_owner_fk 
      FOREIGN KEY (owner_id) 
      REFERENCES users(id) 
      ON DELETE CASCADE
    `);

    console.log('New constraint added successfully!');
    console.log('Products table now correctly references users table.');
    
    // Verify the change
    const [newConstraints] = await db.execute(`
      SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'trading'
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'owner_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    console.log('Updated constraints:', newConstraints);
    console.log('\n✅ Foreign key constraint fixed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing foreign key constraint:', error);
    process.exit(1);
  }
}

fixProductOwnerFK();
