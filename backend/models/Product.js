const { mongoose, Schema } = require('../config/db');

const productSchema = new Schema({
    owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    subcategory_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        default: 0
    },
    stock: {
        type: Number,
        default: 0
    },
    description: String,
    image: String,
    images: [String],
    media: [{
        type: {
            type: String,
            enum: ['image', 'video'],
            default: 'image'
        },
        url: String
    }],
    size_type: {
        type: String,
        default: 'none'
    },
    size_options: [String],
    color_type: {
        type: String,
        default: 'none'
    },
    color_options: [String],
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;

            : (typeof size_options === 'string' && size_options.trim() ? size_options : null);
        const safeColorType = String(color_type || 'none').trim().toLowerCase() || 'none';
        const safeColorOptions = Array.isArray(color_options)
            ? JSON.stringify(color_options)
            : (typeof color_options === 'string' && color_options.trim() ? color_options : null);
        
        // Handle images - could be a comma-separated string or an array
        let safeImages = null;
        if (images) {
            if (typeof images === 'string') {
                // It's a comma-separated string from frontend
                const imageArray = images.split(',').filter(img => img.trim());
                safeImages = imageArray.length > 0 ? JSON.stringify(imageArray) : null;
            } else if (Array.isArray(images)) {
                safeImages = images.length > 0 ? JSON.stringify(images) : null;
            }
        }

        let safeMedia = null;
        if (media) {
            if (typeof media === 'string') {
                const mediaArray = this.parseJsonField(media, []);
                safeMedia = Array.isArray(mediaArray) && mediaArray.length > 0 ? JSON.stringify(mediaArray) : null;
            } else if (Array.isArray(media)) {
                safeMedia = media.length > 0 ? JSON.stringify(media) : null;
            }
        }
        
        const [result] = await db.execute(
            `INSERT INTO products
            (owner_id, category_id, subcategory_id, name, price, stock, description, image, images, media, size_type, size_options, color_type, color_options)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [safeOwnerId, safeCategoryId, safeSubcategoryId, safeName, safePrice, safeStock, safeDescription, safeImage, safeImages, safeMedia, safeSizeType, safeSizeOptions, safeColorType, safeColorOptions]
        );
        return result.insertId;
    }

    static async findAll() {
        await this.ensureSchema();
        const [rows] = await db.execute(`
            SELECT
                p.*,
                c.name as category_name,
                c.description as category_description,
                sc.name as subcategory_name,
                COALESCE(pl.likes_count, 0) AS likes_count
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories sc ON p.subcategory_id = sc.id
            LEFT JOIN (
                SELECT product_id, COUNT(*) AS likes_count
                FROM product_likes
                GROUP BY product_id
            ) pl ON pl.product_id = p.id
        `);
        return rows.map((product) => this.mapProductRow(product));
    }

    static async findById(id) {
        await this.ensureSchema();
        const [rows] = await db.execute(`
            SELECT
                p.*,
                c.name as category_name,
                c.description as category_description,
                sc.name as subcategory_name,
                COALESCE(pl.likes_count, 0) AS likes_count
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories sc ON p.subcategory_id = sc.id
            LEFT JOIN (
                SELECT product_id, COUNT(*) AS likes_count
                FROM product_likes
                GROUP BY product_id
            ) pl ON pl.product_id = p.id
            WHERE p.id = ?
        `, [id]);
        if (rows.length > 0) {
            return this.mapProductRow(rows[0]);
        }
        return null;
    }

    static async findByNameNormalized(name, excludeId = null) {
        await this.ensureSchema();
        const normalizedName = String(name || '').trim();
        if (!normalizedName) return null;

        let query = 'SELECT id, name FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))';
        const params = [normalizedName];

        if (excludeId !== null && typeof excludeId !== 'undefined') {
            query += ' AND id <> ?';
            params.push(Number(excludeId));
        }

        query += ' LIMIT 1';
        const [rows] = await db.execute(query, params);
        return rows[0] || null;
    }

    static async getLikeStats(productId, visitorKey = null) {
        await this.ensureSchema();
        const [countRows] = await db.execute(
            'SELECT COUNT(*) AS likes_count FROM product_likes WHERE product_id = ?',
            [productId]
        );
        const likesCount = Number(countRows?.[0]?.likes_count || 0);
        if (!visitorKey) {
            return { likes_count: likesCount, liked: false };
        }

        const [likedRows] = await db.execute(
            'SELECT id FROM product_likes WHERE product_id = ? AND visitor_key = ? LIMIT 1',
            [productId, String(visitorKey)]
        );
        return { likes_count: likesCount, liked: likedRows.length > 0 };
    }

    static async toggleLike(productId, visitorKey) {
        await this.ensureSchema();
        const safeVisitorKey = String(visitorKey || '').trim();
        if (!safeVisitorKey) {
            throw new Error('visitor_key is required');
        }

        const [existing] = await db.execute(
            'SELECT id FROM product_likes WHERE product_id = ? AND visitor_key = ? LIMIT 1',
            [productId, safeVisitorKey]
        );

        let liked = false;
        if (existing.length > 0) {
            await db.execute(
                'DELETE FROM product_likes WHERE product_id = ? AND visitor_key = ?',
                [productId, safeVisitorKey]
            );
            liked = false;
        } else {
            await db.execute(
                'INSERT INTO product_likes (product_id, visitor_key) VALUES (?, ?)',
                [productId, safeVisitorKey]
            );
            liked = true;
        }

        const stats = await this.getLikeStats(productId, safeVisitorKey);
        return { liked, likes_count: stats.likes_count };
    }

    static async update(id, product) {
        await this.ensureSchema();
        const { category_id, subcategory_id, name, price, stock, description, image, images, media, size_type, size_options, color_type, color_options } = product;
        
        // Ensure all values are properly defined (convert undefined to null)
        const safeCategoryId = category_id || null;
        const safeSubcategoryId = subcategory_id || null;
        const safeName = name || '';
        const safePrice = price || 0;
        const safeStock = stock || 0;
        const safeDescription = description || '';
        const safeImage = image || '';
        const safeSizeType = String(size_type || 'none').trim().toLowerCase() || 'none';
        const safeSizeOptions = Array.isArray(size_options)
            ? JSON.stringify(size_options)
            : (typeof size_options === 'string' && size_options.trim() ? size_options : null);
        const safeColorType = String(color_type || 'none').trim().toLowerCase() || 'none';
        const safeColorOptions = Array.isArray(color_options)
            ? JSON.stringify(color_options)
            : (typeof color_options === 'string' && color_options.trim() ? color_options : null);
        
        // Handle images - could be a comma-separated string or an array
        let safeImages = null;
        if (images) {
            if (typeof images === 'string') {
                const imageArray = images.split(',').filter(img => img.trim());
                safeImages = imageArray.length > 0 ? JSON.stringify(imageArray) : null;
            } else if (Array.isArray(images)) {
                safeImages = images.length > 0 ? JSON.stringify(images) : null;
            }
        }

        let safeMedia = null;
        if (media) {
            if (typeof media === 'string') {
                const mediaArray = this.parseJsonField(media, []);
                safeMedia = Array.isArray(mediaArray) && mediaArray.length > 0 ? JSON.stringify(mediaArray) : null;
            } else if (Array.isArray(media)) {
                safeMedia = media.length > 0 ? JSON.stringify(media) : null;
            }
        }
        
        await db.execute(
            `UPDATE products
            SET category_id = ?, subcategory_id = ?, name = ?, price = ?, stock = ?, description = ?, image = ?, images = ?, media = ?, size_type = ?, size_options = ?, color_type = ?, color_options = ?
            WHERE id = ?`,
            [safeCategoryId, safeSubcategoryId, safeName, safePrice, safeStock, safeDescription, safeImage, safeImages, safeMedia, safeSizeType, safeSizeOptions, safeColorType, safeColorOptions, id]
        );
        return this.findById(id);
    }

    static async delete(id) {
        await this.ensureSchema();
        await db.execute('DELETE FROM products WHERE id = ?', [id]);
        return true;
    }
}

module.exports = Product;
