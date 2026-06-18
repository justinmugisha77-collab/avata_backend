const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables first
dotenv.config({ path: path.join(__dirname, '.env') });

const db = require('./config/db');

// Auto-initialize database on startup
const initializeDatabase = async () => {
    try {
        console.log('🔍 Checking database tables...');
        const sqlFile = path.join(__dirname, './migrations/sqlite_init.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        const statements = sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
        
        for (const statement of statements) {
            await new Promise((resolve, reject) => {
                db.run(statement, (err) => {
                    if (err && !err.message.includes('already exists')) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        console.log('✅ Database initialized successfully!');
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
    }
};

// Initialize database before starting server
initializeDatabase().then(() => {
    console.log('✅ Database ready!');
}).catch(err => {
    console.error('⚠️ Database init warning:', err.message);
    // Continue anyway - tables might already exist
});

const app = express();

// Create uploads directory structure
const uploadDirs = [
    path.join(__dirname, 'uploads', 'products'),
    path.join(__dirname, 'uploads', 'payment_proofs'),
    path.join(__dirname, 'uploads', 'advertisements'),
    path.join(__dirname, 'uploads', 'categories')
];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const messageRoutes = require('./routes/messageRoutes');
const specialOfferRoutes = require('./routes/specialOfferRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const heroMediaRoutes = require('./routes/heroMediaRoutes');
const advertisementRoutes = require('./routes/advertisementRoutes');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory (both products and payment proofs)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/special-offers', specialOfferRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/hero-media', heroMediaRoutes);
app.use('/api/advertisement', advertisementRoutes);

app.get('/', (req, res) => {
    res.send('AVATA Trading API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
