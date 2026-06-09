const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'heroMedia.json');

function ensureDataFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ type: 'image', video: '', updatedAt: null }, null, 2));
    }
}

class HeroMedia {
    static get() {
        ensureDataFile();
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        try {
            return JSON.parse(raw);
        } catch (error) {
            return { type: 'image', video: '', updatedAt: null };
        }
    }

    static save(data) {
        ensureDataFile();
        const nextData = {
            type: data?.type || 'image',
            video: data?.video || '',
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(nextData, null, 2));
        return nextData;
    }

    static clear() {
        return this.save({ type: 'image', video: '' });
    }
}

module.exports = HeroMedia;