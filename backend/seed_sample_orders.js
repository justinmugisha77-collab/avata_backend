const db = require('./config/db');
require('dotenv').config();

async function seedSampleOrders() {
  try {
    console.log('🔧 Creating sample orders with different statuses...');

    // Get users
    const [users] = await db.execute('SELECT id FROM users WHERE role = "customer" LIMIT 1');
    const [products] = await db.execute('SELECT id FROM products LIMIT 3');

    if (users.length === 0) {
      console.log('❌ No customer users found. Please run seed_users.js first.');
      return;
    }

    if (products.length === 0) {
      console.log('❌ No products found. Please add products first.');
      return;
    }

    const customerId = users[0].id;
    const productId = products[0].id;

    // Sample orders with different statuses
    const orderStatuses = [
      { status: 'Waiting_Proof', payment_status: 'pending' },
      { status: 'Payment_Under_Review', payment_status: 'pending' },
      { status: 'Paid', payment_status: 'verified' },
      { status: 'Shipped', payment_status: 'verified' },
      { status: 'Delivered', payment_status: 'verified' },
      { status: 'Completed', payment_status: 'verified' },
      { status: 'Not_Delivered', payment_status: 'verified' },
      { status: 'Cancelled', payment_status: 'cancelled' }
    ];

    for (const orderInfo of orderStatuses) {
      // Create order with items as JSON
      const items = [
        {
          id: productId,
          product_id: productId,
          quantity: 1,
          price: 5000
        }
      ];

      // Create order
      const [result] = await db.execute(
        `INSERT INTO orders (
          user_id, 
          total_amount, 
          status, 
          payment_status,
          order_source,
          customer_name,
          customer_email,
          customer_phone,
          items,
          verification_status,
          payment_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerId,
          5000,
          orderInfo.status,
          orderInfo.payment_status,
          'website',
          'Sample Customer',
          'customer@example.com',
          '+250788123456',
          JSON.stringify(items),
          orderInfo.status === 'Payment_Under_Review' ? 'pending' : 'completed',
          `PAY-${Date.now()}-${orderInfo.status}`
        ]
      );

      const orderId = result.insertId;

      // Add payment proof for orders that need it
      if (['Payment_Under_Review', 'Paid', 'Shipped', 'Delivered', 'Completed', 'Not_Delivered'].includes(orderInfo.status)) {
        await db.execute(
          `UPDATE orders SET payment_proof = ? WHERE id = ?`,
          ['sample_proof.jpg', orderId]
        );
      }

      console.log(`✅ Created order #${orderId} with status: ${orderInfo.status}`);
    }

    console.log('\n🎉 Sample orders created successfully!');
    console.log('\n📊 Order Status Summary:');
    console.log('   - Waiting_Proof: Order created, waiting for customer to upload payment proof');
    console.log('   - Payment_Under_Review: Payment proof uploaded, admin can APPROVE or REJECT');
    console.log('   - Paid: Payment approved, admin can mark as SHIPPED');
    console.log('   - Shipped: Order shipped, admin can mark as DELIVERED');
    console.log('   - Delivered: Order delivered, waiting for customer confirmation');
    console.log('   - Completed: Customer confirmed delivery');
    console.log('   - Not_Delivered: Customer reported not received, admin can RESEND or CANCEL');
    console.log('   - Cancelled: Order cancelled');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding sample orders:', error);
    process.exit(1);
  }
}

seedSampleOrders();
