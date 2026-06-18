const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Justin:Justin123!!@cluster0.njato5s.mongodb.net/?appName=Cluster0';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB successfully!');
        return mongoose.connection;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
};

module.exports = {
    connectDB,
    mongoose,
    Schema: mongoose.Schema,
    model: mongoose.model
};
