const db = require('./config/db');
const fs = require('fs').promises;
const path = require('path');

async function migrateMessages() {
  try {
    console.log('Starting messages table migration...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'create_messages_table.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        await db.execute(statement);
        console.log('Executed:', statement.substring(0, 50) + '...');
      }
    }

    console.log('Messages table migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateMessages();
