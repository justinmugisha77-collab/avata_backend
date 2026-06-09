const db = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('Running database migration...');
        
        const migrationPath = path.join(__dirname, 'migrations', 'add_product_images.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                await db.execute(statement);
                console.log('Executed:', statement.substring(0, 50) + '...');
            }
        }
        
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
