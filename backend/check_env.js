require('dotenv').config();

console.log('=== Environment Configuration Check ===\n');

console.log('✅ PORT:', process.env.PORT || 'Not set');
console.log('✅ DB_HOST:', process.env.DB_HOST || 'Not set');
console.log('✅ DB_USER:', process.env.DB_USER || 'Not set');
console.log('✅ DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'Not set');
console.log('✅ DB_NAME:', process.env.DB_NAME || 'Not set');
console.log('✅ JWT_SECRET:', process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'Not set');

if (!process.env.JWT_SECRET) {
  console.error('\n❌ ERROR: JWT_SECRET is not set in .env file!');
  process.exit(1);
}

console.log('\n✅ All environment variables loaded successfully!');
console.log('\n📋 Summary:');
console.log(`   - Server will run on port: ${process.env.PORT}`);
console.log(`   - Database: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
console.log(`   - JWT Secret configured: Yes (${process.env.JWT_SECRET.length} characters)`);
