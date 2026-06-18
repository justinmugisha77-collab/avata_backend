const fs = require('fs');
const path = require('path');
const db = require('./config/db');

async function runMigrations() {
    try {
        console.log('🔍 Starting SQLite migrations...');
        
        const sqlFile = path.join(__dirname, './migrations/sqlite_init.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        // Split by semicolon and filter empty statements
        const statements = sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
        
        console.log(`📝 Found ${statements.length} SQL statements`);
        
        // Execute each statement
        for (const statement of statements) {
            await new Promise((resolve, reject) => {
                db.run(statement, (err) => {
                    if (err) {
                        console.error('❌ Error executing statement:', err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        
        console.log('✅ All migrations completed successfully!');
        console.log('📦 Database initialized at: backend/database.sqlite');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigrations();
