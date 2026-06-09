const db = require('../config/db');

class Category {
    static schemaEnsured = false;

    static normalizeName(name) {
        return String(name || '').trim().toLowerCase();
    }

    static async ensureSchema() {
        if (this.schemaEnsured) return;
        await db.execute('ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INT NULL');
        await db.execute('ALTER TABLE categories ADD COLUMN IF NOT EXISTS image VARCHAR(500) NULL');
        this.schemaEnsured = true;
    }

    static async create(category) {
        await this.ensureSchema();
        const { name, description, parent_id, image } = category;
        const normalizedName = this.normalizeName(name);
        const existing = await this.findByNormalizedName(normalizedName);
        if (existing) {
            const err = new Error('Category already exists');
            err.code = 'DUPLICATE_CATEGORY';
            throw err;
        }
        const [result] = await db.execute(
            'INSERT INTO categories (name, description, parent_id, image) VALUES (?, ?, ?, ?)',
            [String(name || '').trim(), description || null, parent_id || null, image || null]
        );
        return result.insertId;
    }

    static async findAll() {
        await this.ensureSchema();
        const [rows] = await db.execute('SELECT * FROM categories ORDER BY COALESCE(parent_id, 0) ASC, name ASC');
        return rows;
    }

    static async findById(id) {
        await this.ensureSchema();
        const [rows] = await db.execute('SELECT * FROM categories WHERE id = ?', [id]);
        return rows[0];
    }

    static async update(id, category) {
        await this.ensureSchema();
        const { name, description, parent_id, image } = category;
        const normalizedName = this.normalizeName(name);
        const existing = await this.findByNormalizedName(normalizedName);
        if (existing && Number(existing.id) !== Number(id)) {
            const err = new Error('Category already exists');
            err.code = 'DUPLICATE_CATEGORY';
            throw err;
        }
        await db.execute(
            'UPDATE categories SET name = ?, description = ?, parent_id = ?, image = ? WHERE id = ?',
            [String(name || '').trim(), description, parent_id || null, image || null, id]
        );
        return this.findById(id);
    }

    static async findByNormalizedName(normalizedName) {
        await this.ensureSchema();
        const [rows] = await db.execute(
            'SELECT * FROM categories WHERE LOWER(TRIM(name)) = ? LIMIT 1',
            [normalizedName]
        );
        return rows[0] || null;
    }

    static async delete(id) {
        await this.ensureSchema();
        // Move subcategories to root before deletion.
        await db.execute('UPDATE categories SET parent_id = NULL WHERE parent_id = ?', [id]);
        await db.execute('DELETE FROM categories WHERE id = ?', [id]);
        return true;
    }

    static async getProductCount(id) {
        await this.ensureSchema();
        const [rows] = await db.execute(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ? OR subcategory_id = ?',
            [id, id]
        );
        return rows[0].count;
    }
}

module.exports = Category;
