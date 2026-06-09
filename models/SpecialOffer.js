const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'specialOffers.json');

function ensureDataFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

class SpecialOffer {
    static all() {
        ensureDataFile();
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        try { return JSON.parse(raw) } catch (e) { return []; }
    }

    static saveAll(arr) {
        ensureDataFile();
        fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2));
    }

    static findAll() {
        return this.all();
    }

    static create(offer) {
        const list = this.all();
        const newOffer = { id: Date.now(), ...offer };
        list.push(newOffer);
        this.saveAll(list);
        return newOffer;
    }

    static update(id, updates) {
        const list = this.all();
        const index = list.findIndex(o => String(o.id) === String(id));
        if (index === -1) return null;
        list[index] = { ...list[index], ...updates, id: list[index].id };
        this.saveAll(list);
        return list[index];
    }

    static findById(id) {
        return this.all().find(o => String(o.id) === String(id)) || null;
    }

    static remove(id) {
        let list = this.all();
        list = list.filter(o => String(o.id) !== String(id));
        this.saveAll(list);
        return true;
    }
}

module.exports = SpecialOffer;
