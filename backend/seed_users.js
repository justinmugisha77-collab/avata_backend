const db = require('./config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedUsers() {
  try {
    console.log('🔧 Setting up users table...');

    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        reset_password_token VARCHAR(255) NULL,
        reset_password_expires DATETIME NULL,
        role ENUM('customer', 'admin', 'owner') DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created successfully!');

    // Keep existing databases compatible with forgot-password flow.
    await db.execute(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS reset_password_expires DATETIME NULL
    `);

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('Admin@123', salt);
    const ownerPassword = await bcrypt.hash('Owner@123', salt);
    const customerPassword = await bcrypt.hash('Customer@123', salt);

    // Check if admin exists
    const [adminCheck] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      ['admin@avatatrading.com']
    );

    if (adminCheck.length === 0) {
      // Insert admin user
      await db.execute(
        'INSERT INTO users (full_name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
        ['Admin User', '+250788000001', 'admin@avatatrading.com', adminPassword, 'admin']
      );
      console.log('✅ Admin user created!');
      console.log('   📧 Email: admin@avatatrading.com');
      console.log('   🔑 Password: Admin@123');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Check if owner exists
    const [ownerCheck] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      ['owner@avatatrading.com']
    );

    if (ownerCheck.length === 0) {
      // Insert owner user
      await db.execute(
        'INSERT INTO users (full_name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
        ['Owner User', '+250788000002', 'owner@avatatrading.com', ownerPassword, 'owner']
      );
      console.log('✅ Owner user created!');
      console.log('   📧 Email: owner@avatatrading.com');
      console.log('   🔑 Password: Owner@123');
    } else {
      console.log('ℹ️  Owner user already exists');
    }

    // Check if test customer exists
    const [customerCheck] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      ['customer@test.com']
    );

    if (customerCheck.length === 0) {
      // Insert test customer
      await db.execute(
        'INSERT INTO users (full_name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
        ['Test Customer', '+250788000003', 'customer@test.com', customerPassword, 'customer']
      );
      console.log('✅ Test customer created!');
      console.log('   📧 Email: customer@test.com');
      console.log('   🔑 Password: Customer@123');
    } else {
      console.log('ℹ️  Test customer already exists');
    }

    // Display all users
    const [users] = await db.execute('SELECT id, full_name, email, role FROM users');
    console.log('\n📋 All Users in Database:');
    console.table(users);

    console.log('\n✨ User seeding completed successfully!');
    console.log('\n🚀 You can now login with these credentials:');
    console.log('   👨‍💼 Admin Dashboard: http://localhost:5173/admin');
    console.log('      Email: admin@avatatrading.com');
    console.log('      Password: Admin@123');
    console.log('\n   👑 Owner Dashboard: http://localhost:5173/owner');
    console.log('      Email: owner@avatatrading.com');
    console.log('      Password: Owner@123');
    console.log('\n   👤 Customer Account: http://localhost:5173');
    console.log('      Email: customer@test.com');
    console.log('      Password: Customer@123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error.message);
    process.exit(1);
  }
}

seedUsers();
