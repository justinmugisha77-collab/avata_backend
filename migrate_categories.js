const db = require('./config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('Running categories table migration...');
        
        const sqlPath = path.join(__dirname, 'migrations', 'create_categories_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split SQL by semicolons and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                await db.query(statement);
                console.log('Executed:', statement.substring(0, 50) + '...');
            }
        }
        
        console.log('✅ Categories migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
