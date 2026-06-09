const db = require('./config/db');

const sampleProducts = [
  {
    name: 'Workwear Coverall',
    category: 'WORK WEAR',
    subcategory: 'Coveralls',
    price: 120.00,
    description: 'Durable workwear coverall for industrial use.',
    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=400&q=80',
    stock: 50
  },
  {
    name: 'Safety Shoes',
    category: 'FOOT PROTECTION',
    subcategory: 'Shoes',
    price: 95.00,
    description: 'Steel toe safety shoes for construction.',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
    stock: 100
  },
  {
    name: 'Hard Hat',
    category: 'HEAD PROTECTION',
    subcategory: 'Helmets',
    price: 35.00,
    description: 'Impact-resistant hard hat for head safety.',
    image: 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80',
    stock: 200
  },
  {
    name: 'Dust Mask',
    category: 'DUSTMASK',
    subcategory: 'Masks',
    price: 10.00,
    description: 'Certified dust mask for respiratory protection.',
    image: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80',
    stock: 300
  },
  {
    name: 'Safety Glasses',
    category: 'EYE PROTECTION',
    subcategory: 'Glasses',
    price: 18.00,
    description: 'Anti-fog safety glasses for eye protection.',
    image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=400&q=80',
    stock: 150
  },
  {
    name: 'Ear Muffs',
    category: 'EAR PROTECTION',
    subcategory: 'Muffs',
    price: 22.00,
    description: 'Noise-cancelling ear muffs for hearing safety.',
    image: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=400&q=80',
    stock: 120
  },
  {
    name: 'Nitrile Gloves',
    category: 'GLOVES',
    subcategory: 'Nitrile',
    price: 15.00,
    description: 'Chemical-resistant nitrile gloves.',
    image: 'https://images.unsplash.com/photo-1465101178521-c1a9136a3b99?auto=format&fit=crop&w=400&q=80',
    stock: 250
  },
  {
    name: 'Fall Harness',
    category: 'FALL PROTECTION',
    subcategory: 'Harnesses',
    price: 180.00,
    description: 'Full body fall protection harness.',
    image: 'https://images.unsplash.com/photo-1519985176271-adb1088fa94c?auto=format&fit=crop&w=400&q=80',
    stock: 60
  },
  {
    name: 'Fire Blanket',
    category: 'FIRE PROTECTION',
    subcategory: 'Blankets',
    price: 45.00,
    description: 'Fire-resistant safety blanket.',
    image: 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80',
    stock: 80
  },
  {
    name: 'Hand Truck',
    category: 'HAND TRUCKS',
    subcategory: 'Trucks',
    price: 210.00,
    description: 'Heavy-duty hand truck for material transport.',
    image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=400&q=80',
    stock: 30
  },
  {
    name: 'Traffic Cone',
    category: 'ROAD SAFETY',
    subcategory: 'Cones',
    price: 25.00,
    description: 'High-visibility traffic cone.',
    image: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80',
    stock: 90
  },
  {
    name: 'Spill Kit',
    category: 'SPILL KIT',
    subcategory: 'Kits',
    price: 75.00,
    description: 'Complete spill response kit.',
    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=400&q=80',
    stock: 40
  }
];

async function loadSampleData() {
  try {
    // First, create table if not exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        subcategory VARCHAR(100),
        price DECIMAL(10,2),
        description TEXT,
        image VARCHAR(500),
        stock INT DEFAULT 0
      )
    `);

    // Clear existing data
    await db.execute('DELETE FROM products');

    // Insert sample data
    for (const product of sampleProducts) {
      await db.execute(
        'INSERT INTO products (name, category, subcategory, price, description, image, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [product.name, product.category, product.subcategory, product.price, product.description, product.image, product.stock]
      );
    }

    console.log('Sample products loaded successfully!');
  } catch (error) {
    console.error('Error loading sample data:', error);
  } finally {
    process.exit();
  }
}

loadSampleData();
