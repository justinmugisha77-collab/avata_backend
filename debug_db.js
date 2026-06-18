const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, 'backend/.env') });
const db = require('./backend/config/db');

async function debug() {
    try {
        const [tables] = await db.execute('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log('Tables:', tableNames.join(', '));

        const [usersList] = await db.execute('SELECT id, full_name, email, role FROM users');
        console.log('--- Users in Database ---');
        usersList.forEach(u => console.log(`- ${u.full_name} (${u.email}) Role: ${u.role}`));

        const [realCustomers] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "customer"');
        console.log(`Total Users with role="customer": ${realCustomers[0].count}`);

        const [orderCustomers] = await db.execute('SELECT COUNT(DISTINCT COALESCE(user_id, customer_email)) as count FROM orders');
        console.log(`Unique Customers in Orders (COALESCE): ${orderCustomers[0].count}`);

    } catch (error) {
        console.error('Debug failed:', error.message);
    } finally {
        process.exit();
    }
}

debug();
