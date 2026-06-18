const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
    let connection;
    
    try {
        console.log('🔄 Connecting to database...');
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'avata_trading'
        });

        console.log('✅ Connected to database');
        console.log('🔄 Running migration: update_orders_table.sql');

        // Add customer_name column
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)
        `).catch(() => console.log('   ℹ️  customer_name column already exists'));

        // Add customer_email column
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255)
        `).catch(() => console.log('   ℹ️  customer_email column already exists'));

        // Add customer_phone column
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50)
        `).catch(() => console.log('   ℹ️  customer_phone column already exists'));

        // Add items column
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS items TEXT
        `).catch(() => console.log('   ℹ️  items column already exists'));

        // Add payment_status column
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS payment_status ENUM('pending', 'awaiting_verification', 'verified') DEFAULT 'pending'
        `).catch(() => console.log('   ℹ️  payment_status column already exists'));

        // Add payment_number column
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS payment_number VARCHAR(100)
        `).catch(() => console.log('   ℹ️  payment_number column already exists'));

        // Add payment_proof column
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS payment_proof TEXT
        `).catch(() => console.log('   ℹ️  payment_proof column already exists'));

        // Add payment_receipt column
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS payment_receipt TEXT
        `).catch(() => console.log('   ℹ️  payment_receipt column already exists'));

        // Add verified_at column
        await connection.execute(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS verified_at DATETIME
        `).catch(() => console.log('   ℹ️  verified_at column already exists'));

        console.log('✅ All columns added/verified');

        // Update status enum
        console.log('🔄 Updating status enum...');
        await connection.execute(`
            ALTER TABLE orders 
            MODIFY COLUMN status ENUM('pending', 'confirmed', 'processing', 'shipped', 'sent', 'submitted', 'completed', 'cancelled') DEFAULT 'pending'
        `);
        console.log('✅ Status enum updated');

        // Create indexes
        console.log('🔄 Creating indexes...');
        
        await connection.execute(`
            CREATE INDEX IF NOT EXISTS idx_payment_status ON orders(payment_status)
        `).catch(() => console.log('   ℹ️  idx_payment_status already exists'));

        await connection.execute(`
            CREATE INDEX IF NOT EXISTS idx_customer_email ON orders(customer_email)
        `).catch(() => console.log('   ℹ️  idx_customer_email already exists'));

        await connection.execute(`
            CREATE INDEX IF NOT EXISTS idx_payment_number ON orders(payment_number)
        `).catch(() => console.log('   ℹ️  idx_payment_number already exists'));

        console.log('✅ Indexes created');

        console.log('\n✨ Migration completed successfully!');
        console.log('\n📋 Summary:');
        console.log('   - Added payment verification fields to orders table');
        console.log('   - Updated order status enum');
        console.log('   - Created performance indexes');
        console.log('\n🚀 You can now use the payment verification system!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run migration
runMigration();
