const db = require('./config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixUserPasswords() {
  try {
    console.log('🔧 Fixing user passwords...');

    const salt = await bcrypt.genSalt(10);

    // Update admin password
    const adminPassword = await bcrypt.hash('Admin@123', salt);
    await db.execute(
      `UPDATE users SET password = ? WHERE email = ?`,
      [adminPassword, 'admin@avatatrading.com']
    );
    console.log('✅ Admin password updated');

    // Update owner password
    const ownerPassword = await bcrypt.hash('Owner@123', salt);
    await db.execute(
      `UPDATE users SET password = ? WHERE email = ?`,
      [ownerPassword, 'owner@avatatrading.com']
    );
    console.log('✅ Owner password updated');

    // Update customer password
    const customerPassword = await bcrypt.hash('Customer@123', salt);
    await db.execute(
      `UPDATE users SET password = ? WHERE email = ?`,
      [customerPassword, 'customer@test.com']
    );
    console.log('✅ Customer password updated');

    console.log('\n✨ All user passwords have been hashed successfully!');
    console.log('\n🔐 Login credentials:');
    console.log('   Admin: admin@avatatrading.com / Admin@123');
    console.log('   Owner: owner@avatatrading.com / Owner@123');
    console.log('   Customer: customer@test.com / Customer@123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing passwords:', error.message);
    process.exit(1);
  }
}

fixUserPasswords();
