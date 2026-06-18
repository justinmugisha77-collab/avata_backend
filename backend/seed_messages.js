const db = require('./config/db');

async function seedMessages() {
  try {
    console.log('Seeding sample messages...');

    const sampleMessages = [
      {
        name: 'John Smith',
        email: 'john.smith@example.com',
        phone: '+1234567890',
        subject: 'Product Inquiry',
        message: 'Hi, I am interested in your safety gloves. Do you have bulk pricing available for orders of 100+ units?'
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.j@company.com',
        phone: '+1987654321',
        subject: 'Order Status',
        message: 'I placed an order last week (Order #1234) and haven\'t received any shipping updates. Can you please check the status?'
      },
      {
        name: 'Michael Brown',
        email: 'mbrown@construction.com',
        phone: '+1555123456',
        subject: 'Custom Order Request',
        message: 'We need custom branded safety equipment for our construction company. Do you offer customization services? Please contact me to discuss requirements.'
      },
      {
        name: 'Emily Davis',
        email: 'emily.davis@gmail.com',
        phone: null,
        subject: 'Product Quality Question',
        message: 'Are your safety helmets certified for construction work? I need to know the specific safety standards they meet.'
      },
      {
        name: 'Robert Wilson',
        email: 'r.wilson@factory.com',
        phone: '+1444555666',
        subject: 'Partnership Opportunity',
        message: 'I represent a manufacturing facility interested in becoming a regular customer. Can we schedule a meeting to discuss wholesale pricing and supply agreements?'
      }
    ];

    for (const msg of sampleMessages) {
      await db.execute(
        'INSERT INTO messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
        [msg.name, msg.email, msg.phone, msg.subject, msg.message]
      );
      console.log(`Added message from ${msg.name}`);
    }

    console.log('Sample messages seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding messages:', error);
    process.exit(1);
  }
}

seedMessages();
