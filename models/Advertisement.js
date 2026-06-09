const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'advertisement.json');

function createEmptyState() {
    return { items: [], updatedAt: null };
}

function normalizeItem(rawItem) {
    if (!rawItem || typeof rawItem !== 'object') return null;
    const type = rawItem.type === 'video' ? 'video' : 'image';
    const media = String(rawItem.media || rawItem.image || '').trim();
    if (!media) return null;
    return {
        id: String(rawItem.id || `ad-${Date.now()}-${Math.round(Math.random() * 1e6)}`),
        type,
        media,
        title: String(rawItem.title || '').trim(),
        description: String(rawItem.description || '').trim(),
        visible: typeof rawItem.visible === 'boolean' ? rawItem.visible : true,
        createdAt: rawItem.createdAt || new Date().toISOString()
    };
}

function normalizeState(rawData) {
    // Legacy format: { type: 'image', image: '/uploads/...' }
    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData) && !Array.isArray(rawData.items)) {
        const legacyImage = String(rawData.image || '').trim();
        if (legacyImage) {
            return {
                items: [
                    {
                        id: String(rawData.id || `ad-${Date.now()}-${Math.round(Math.random() * 1e6)}`),
                        type: rawData.type === 'video' ? 'video' : 'image',
                        media: legacyImage,
                        title: String(rawData.title || '').trim(),
                        description: String(rawData.description || '').trim(),
                        visible: true,
                        createdAt: rawData.createdAt || new Date().toISOString()
                    }
                ],
                updatedAt: rawData.updatedAt || null
            };
        }
    }

    const items = Array.isArray(rawData?.items)
        ? rawData.items.map(normalizeItem).filter(Boolean)
        : [];

    return {
        items,
        updatedAt: rawData?.updatedAt || null
    };
}

function ensureDataFile() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(createEmptyState(), null, 2));
    }
}

class Advertisement {
    static get() {
        ensureDataFile();
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        try {
            return normalizeState(JSON.parse(raw));
        } catch (error) {
            return createEmptyState();
        }
    }

    static save(data) {
        ensureDataFile();
        const normalized = normalizeState(data);
        const nextData = { items: normalized.items, updatedAt: new Date().toISOString() };
        fs.writeFileSync(DATA_FILE, JSON.stringify(nextData, null, 2));
        return nextData;
    }

    static addItem(item) {
        const current = this.get();
        const normalized = normalizeItem(item);
        if (!normalized) {
            throw new Error('Invalid advertisement media item.');
        }
        const next = {
            items: [normalized, ...(current.items || [])],
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
        return next;
    }

    static removeItem(itemId) {
        const current = this.get();
        const items = (current.items || []).filter((item) => item.id !== itemId);
        const next = { items, updatedAt: new Date().toISOString() };
        fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
        return next;
    }

    static updateItem(itemId, updates = {}) {
        const current = this.get();
        const nextItems = (current.items || []).map((item) => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                visible: typeof updates.visible === 'boolean' ? updates.visible : item.visible,
                title: typeof updates.title === 'string' ? updates.title.trim() : item.title,
                description: typeof updates.description === 'string' ? updates.description.trim() : item.description
            };
        });
        const next = { items: nextItems, updatedAt: new Date().toISOString() };
        fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
        return next;
    }

    static reorderItems(orderedIds = []) {
        const current = this.get();
        const existing = current.items || [];
        const byId = new Map(existing.map((item) => [item.id, item]));

        const ordered = [];
        for (const id of orderedIds) {
            const found = byId.get(String(id));
            if (found) ordered.push(found);
        }

        const used = new Set(ordered.map((item) => item.id));
        const remaining = existing.filter((item) => !used.has(item.id));
        const next = { items: [...ordered, ...remaining], updatedAt: new Date().toISOString() };
        fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2));
        return next;
    }

    static clear() {
        return this.save(createEmptyState());
    }
}

module.exports = Advertisement;