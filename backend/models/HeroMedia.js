const { mongoose, Schema } = require('../config/db');

const heroMediaSchema = new Schema({
    type: {
        type: String,
        enum: ['image', 'video'],
        default: 'image'
    },
    image: String,
    video: String,
    title: String,
    description: String,
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const HeroMedia = mongoose.model('HeroMedia', heroMediaSchema);
module.exports = HeroMedia;
