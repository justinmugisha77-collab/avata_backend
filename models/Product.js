const db = require('../config/db');

class Product {
    static schemaEnsured = false;

    static async ensureSchema() {
        if (this.schemaEnsured) return;
        await db.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id INT NULL');
        await db.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS size_type VARCHAR(20) DEFAULT 'none'");
        await db.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS size_options JSON NULL');
        await db.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS color_type VARCHAR(20) DEFAULT 'none'");
        await db.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS color_options JSON NULL');
        await db.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS media JSON NULL');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS product_likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                visitor_key VARCHAR(120) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_product_visitor_like (product_id, visitor_key),
                INDEX idx_product_likes_product (product_id),
                CONSTRAINT fk_product_likes_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS color_size_variants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                color VARCHAR(100) NOT NULL,
                size VARCHAR(100),
                price DECIMAL(12,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_product_color_size (product_id, color, size),
                INDEX idx_product_id (product_id),
                CONSTRAINT fk_color_size_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `);
        this.schemaEnsured = true;
    }

    static parseJsonField(value, fallback) {
        if (!value) return fallback;
        if (Array.isArray(value) || typeof value === 'object') return value;
        try {
            return JSON.parse(value);
        } catch (_error) {
            return fallback;
        }
    }

    static normalizeMedia(media, images, image) {
        let parsedMedia = [];
        if (Array.isArray(media)) {
            parsedMedia = media;
        } else if (typeof media === 'string') {
            const parsed = this.parseJsonField(media, []);
            parsedMedia = Array.isArray(parsed) ? parsed : [];
        }

        const mappedMedia = parsedMedia
            .map((item) => {
                if (!item) return null;
                if (typeof item === 'string') {
                    const lower = item.toLowerCase();
                    const isVideo = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.avi') || lower.endsWith('.mkv');
                    return { type: isVideo ? 'video' : 'image', url: item };
                }
                if (typeof item === 'object' && item.url) {
                    return { type: item.type === 'video' ? 'video' : 'image', url: item.url };
                }
                return null;
            })
            .filter(Boolean);

        if (mappedMedia.length > 0) return mappedMedia;

        const parsedImages = Array.isArray(images)
            ? images
            : (typeof images === 'string'
                ? (() => {
                    const parsed = this.parseJsonField(images, null);
                    if (Array.isArray(parsed)) return parsed;
                    return images.split(',').map((item) => item.trim()).filter(Boolean);
                })()
                : []);
        const imageUrls = Array.isArray(parsedImages) ? parsedImages : [];

        if (imageUrls.length > 0) {
            return imageUrls.map((url) => ({ type: 'image', url }));
        }

        if (image) {
            return [{ type: 'image', url: image }];
        }

        return [];
    }

    static mapProductRow(product) {
        const media = this.normalizeMedia(product.media, product.images, product.image);
        const images = media.filter((m) => m.type === 'image').map((m) => m.url);
        const mainImage = product.image || images[0] || media[0]?.url || '';

        return {
            ...product,
            category: product.category_name,
            subcategory: product.subcategory_name || null,
            image: mainImage,
            images,
            media,
            likes_count: Number(product.likes_count || 0),
            size_options: this.parseJsonField(product.size_options, []),
            size_type: product.size_type || 'none',
            color_options: this.parseJsonField(product.color_options, []),
            color_type: product.color_type || 'none'
        };
    }

    static async create(product) {
        await this.ensureSchema();
        const {
            owner_id,
            category_id,
            subcategory_id,
            name,
            price,
            stock,
            description,
            image,
            images,
            media,
            size_type,
            size_options,
            color_type,
            color_options
        } = product;
        
        // Ensure all values are properly defined (convert undefined to null)
        const safeOwnerId = owner_id || null;
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
