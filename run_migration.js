const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, 'backend/.env') });
const db = require('./backend/config/db');

async function migrate() {
    try {
        console.log('🔍 Checking current database state...');
        const [cols] = await db.execute('DESCRIBE orders');
        const colNames = cols.map(c => c.Field);
        console.log('📋 Current columns:', colNames.join(', '));

        if (!colNames.includes('verified_by')) {
            console.log('➕ Adding verified_by column...');
            await db.execute('ALTER TABLE orders ADD COLUMN verified_by INT DEFAULT NULL AFTER user_id');
            console.log('✅ verified_by column added');
        } else {
            console.log('✓ verified_by column already exists');
        }

        if (!colNames.includes('payment_proof_file')) {
            console.log('➕ Adding payment_proof_file column...');
            await db.execute('ALTER TABLE orders ADD COLUMN payment_proof_file VARCHAR(500) DEFAULT NULL');
            console.log('✅ payment_proof_file column added');
        } else {
            console.log('✓ payment_proof_file column already exists');
        }

        if (!colNames.includes('delivered_at')) {
            console.log('➕ Adding delivered_at column...');
            await db.execute('ALTER TABLE orders ADD COLUMN delivered_at DATETIME DEFAULT NULL');
            console.log('✅ delivered_at column added');
        } else {
            console.log('✓ delivered_at column already exists');
        }

        if (!colNames.includes('verification_status')) {
            console.log('➕ Adding verification_status column...');
            await db.execute("ALTER TABLE orders ADD COLUMN verification_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' AFTER payment_status");
            console.log('✅ verification_status column added');
        } else {
            console.log('✓ verification_status column already exists');
        }

        console.log('🔄 Updating status enum with all workflow statuses...');
        try {
            await db.execute(`ALTER TABLE orders MODIFY COLUMN status ENUM(
                'pending', 
                'confirmed', 
                'processing', 
                'shipped', 
                'sent', 
                'submitted', 
                'completed', 
                'cancelled', 
                'delivered',
                'Paid',
                'Shipped',
                'Delivered',
                'Completed',
                'Not_Delivered',
                'Payment_Under_Review',
                'Waiting_Proof',
                'Cancelled'
            ) DEFAULT 'pending'`);
            console.log('✅ Status enum updated');
        } catch (e) {
            console.log('⚠️  Status enum update might have skipped (already updated):', e.message);
        }

        console.log('🔄 Updating payment_status enum...');
        try {
            await db.execute("ALTER TABLE orders MODIFY COLUMN payment_status ENUM('pending', 'awaiting_verification', 'verified', 'Paid') DEFAULT 'pending'");
            console.log('✅ Payment status enum updated');
        } catch (e) {
            console.log('⚠️  Payment status enum update might have skipped:', e.message);
        }

        console.log('📝 Creating order_comments table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS order_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                user_id INT NOT NULL,
                comment TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_order_id (order_id)
            )
        `);
        console.log('✅ order_comments table ready');

        console.log('');
        console.log('🎉 Migration completed successfully!');
        console.log('✅ All columns and tables are up to date');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
    } finally {
        process.exit();
    }
}

migrate();
