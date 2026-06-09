const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Simple file-backed reviews store
const reviewsFile = path.join(__dirname, '..', 'data', 'reviews.json');

function readReviewsFile() {
    try {
        const raw = fs.readFileSync(reviewsFile, 'utf8');
        return JSON.parse(raw || '{}');
    } catch (err) {
        return {};
    }
}

function writeReviewsFile(data) {
    fs.writeFileSync(reviewsFile, JSON.stringify(data, null, 2), 'utf8');
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/products/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

function isVideoMime(mime = '') {
    return String(mime).startsWith('video/');
}

// File filter to accept image and video formats
const fileFilter = (req, file, cb) => {
    const imageTypes = /jpeg|jpg|jfif|png|gif|webp|bmp|svg|tiff|heic|heif/;
    const videoTypes = /mp4|webm|mov|avi|mkv|m4v/;
    const extname = path.extname(file.originalname).toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const isImage = imageTypes.test(extname) || mime.startsWith('image/');
    const isVideo = videoTypes.test(extname) || isVideoMime(mime);
    
    if (isImage || isVideo) {
        return cb(null, true);
    } else {
        cb(new Error('Only image or video files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 60 * 1024 * 1024 }, // 60MB limit
    fileFilter: fileFilter
});

// Middleware to handle multiple images
exports.uploadImages = upload.array('images', 10); // Max 10 images per product

function normalizeSizeType(value) {
    return String(value || 'none').trim().toLowerCase() || 'none';
}

function normalizeColorType(value) {
    return String(value || 'none').trim().toLowerCase() || 'none';
}

function parseAndValidateSizeOptions(sizeOptionsInput, sizeType) {
    if (sizeType === 'none') return { ok: true, value: [] };

    const parsed = (() => {
        if (!sizeOptionsInput) return [];
        if (Array.isArray(sizeOptionsInput)) return sizeOptionsInput;
        try {
            const json = JSON.parse(sizeOptionsInput);
            return Array.isArray(json) ? json : [];
        } catch (_e) {
            return [];
        }
    })();

    for (const opt of parsed) {
        const label = String(opt?.value || opt?.label || '').trim();
        if (!label) {
            return { ok: false, message: 'Each size option must have a value.' };
        }

        if (typeof opt?.price !== 'undefined' && opt?.price !== null && String(opt.price).trim() !== '') {
            const p = Number(opt.price);
            if (!Number.isFinite(p) || p <= 0) {
                return { ok: false, message: `Invalid price for size "${label}". Price must be greater than 0.` };
            }

            const labelAsNumber = Number(label);
            if (Number.isFinite(labelAsNumber) && labelAsNumber === p) {
                return { ok: false, message: `Size value and price cannot be the same for "${label}".` };
            }
        }
    }

    return { ok: true, value: parsed };
}

function parseAndValidateColorOptions(colorOptionsInput, colorType) {
    if (colorType === 'none') return { ok: true, value: [] };

    const parsed = (() => {
        if (!colorOptionsInput) return [];
        if (Array.isArray(colorOptionsInput)) return colorOptionsInput;
        try {
            const json = JSON.parse(colorOptionsInput);
            return Array.isArray(json) ? json : [];
        } catch (_e) {
            return [];
        }
    })();

    for (const opt of parsed) {
        const label = String(opt?.value || opt?.label || '').trim();
        if (!label) {
            return { ok: false, message: 'Each color option must have a value.' };
        }

        if (typeof opt?.price !== 'undefined' && opt?.price !== null && String(opt.price).trim() !== '') {
            const p = Number(opt.price);
            if (!Number.isFinite(p) || p <= 0) {
                return { ok: false, message: `Invalid price for color "${label}". Price must be greater than 0.` };
            }

            const labelAsNumber = Number(label);
            if (Number.isFinite(labelAsNumber) && labelAsNumber === p) {
                return { ok: false, message: `Color value and price cannot be the same for "${label}".` };
            }
        }
    }

    return { ok: true, value: parsed };
}

// Get all products
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.findAll();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get single product
exports.getProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get like stats for a product
exports.getProductLikes = async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (!Number.isFinite(productId) || productId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid product id' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const visitorKey = String(req.headers['x-visitor-key'] || req.query.visitor_key || '').trim();
        const stats = await Product.getLikeStats(productId, visitorKey || null);
        res.json({ success: true, likes_count: stats.likes_count, liked: stats.liked });
    } catch (error) {
        console.error('Error fetching product likes:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to fetch likes' });
    }
};

// Toggle like for a product
exports.toggleProductLike = async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (!Number.isFinite(productId) || productId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid product id' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const visitorKey = String(req.body?.visitor_key || req.headers['x-visitor-key'] || '').trim();
        if (!visitorKey) {
            return res.status(400).json({ success: false, message: 'visitor_key is required' });
        }

        const result = await Product.toggleLike(productId, visitorKey);
        res.json({ success: true, liked: result.liked, likes_count: result.likes_count });
    } catch (error) {
        console.error('Error toggling product like:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to toggle like' });
    }
};

// Create product with images
exports.createProduct = async (req, res) => {
    try {
        const {
            name,
            category_id,
            subcategory_id,
            price,
            stock,
            description,
            size_type,
            size_options,
            color_type,
            color_options
        } = req.body;
        const owner_id = req.user?.id || req.body.owner_id;

        const trimmedName = String(name || '').trim();
        const numericPrice = Number(price);
        const numericStock = Math.trunc(Number(stock));

        if (!trimmedName) {
            return res.status(400).json({ message: 'Product name is required' });
        }

        const existingWithSameName = await Product.findByNameNormalized(trimmedName);
        if (existingWithSameName) {
            return res.status(409).json({ message: 'A product with this name already exists' });
        }

        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).json({ message: 'Price must be greater than 0' });
        }

        if (!Number.isFinite(numericStock) || numericStock < 0) {
            return res.status(400).json({ message: 'Stock must be 0 or greater' });
        }

        // Process uploaded images
        let images = [];
        let media = [];
        let mainImage = '';
        
        if (req.files && req.files.length > 0) {
            media = req.files.map((file) => ({
                type: isVideoMime(file.mimetype) ? 'video' : 'image',
                url: `/uploads/products/${file.filename}`
            }));
            images = media.filter((item) => item.type === 'image').map((item) => item.url);
            mainImage = images[0]; // First image is the main image
        }

        const normalizedSizeType = normalizeSizeType(size_type);
        const sizeValidation = parseAndValidateSizeOptions(size_options, normalizedSizeType);
        if (!sizeValidation.ok) {
            return res.status(400).json({ message: sizeValidation.message });
        }
        const normalizedSizeOptions = sizeValidation.value;

        const normalizedColorType = normalizeColorType(color_type);
        const colorValidation = parseAndValidateColorOptions(color_options, normalizedColorType);
        if (!colorValidation.ok) {
            return res.status(400).json({ message: colorValidation.message });
        }
        const normalizedColorOptions = colorValidation.value;

        if (!owner_id) {
            return res.status(401).json({ message: 'Not authorized: owner not authenticated' });
        }

        const productData = {
            owner_id,
            category_id: category_id || null,
            subcategory_id: subcategory_id || null,
            name: trimmedName,
            price: numericPrice,
            stock: numericStock,
            description: description || '',
            image: mainImage,
            images: images.length > 0 ? images : null,
            media: media.length > 0 ? media : null,
            size_type: normalizedSizeType,
            size_options: normalizedSizeOptions,
            color_type: normalizedColorType,
            color_options: normalizedColorOptions
        };

        const productId = await Product.create(productData);
        const product = await Product.findById(productId);
        
        res.status(201).json({ 
            success: true,
            message: 'Product created successfully',
            product 
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update product
exports.updateProduct = async (req, res) => {
    try {
        const {
            name,
            category_id,
            subcategory_id,
            price,
            stock,
            description,
            size_type,
            size_options,
            color_type,
            color_options
        } = req.body;
        
        // Get existing product
        const existingProduct = await Product.findById(req.params.id);
        if (!existingProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Process uploaded images
        let images = existingProduct.images || [];
        let media = Array.isArray(existingProduct.media)
            ? existingProduct.media
            : (images || []).map((url) => ({ type: 'image', url }));
        let mainImage = existingProduct.image;
        
        if (req.files && req.files.length > 0) {
            const newMedia = req.files.map((file) => ({
                type: isVideoMime(file.mimetype) ? 'video' : 'image',
                url: `/uploads/products/${file.filename}`
            }));
            media = [...media, ...newMedia];
            images = media.filter((item) => item.type === 'image').map((item) => item.url);
            if (!mainImage) {
                mainImage = images[0];
            }
        }

        const normalizedSizeType = typeof size_type === 'undefined'
            ? normalizeSizeType(existingProduct.size_type)
            : normalizeSizeType(size_type);

        const sizeOptionsInput = typeof size_options === 'undefined'
            ? (existingProduct.size_options || [])
            : size_options;

        const sizeValidation = parseAndValidateSizeOptions(sizeOptionsInput, normalizedSizeType);
        if (!sizeValidation.ok) {
            return res.status(400).json({ message: sizeValidation.message });
        }
        const normalizedSizeOptions = sizeValidation.value;

        const normalizedColorType = typeof color_type === 'undefined'
            ? normalizeColorType(existingProduct.color_type)
            : normalizeColorType(color_type);

        const colorOptionsInput = typeof color_options === 'undefined'
            ? (existingProduct.color_options || [])
            : color_options;

        const colorValidation = parseAndValidateColorOptions(colorOptionsInput, normalizedColorType);
        if (!colorValidation.ok) {
            return res.status(400).json({ message: colorValidation.message });
        }
        const normalizedColorOptions = colorValidation.value;

        const nextName = typeof name === 'undefined' ? existingProduct.name : String(name || '').trim();
        if (!nextName) {
            return res.status(400).json({ message: 'Product name is required' });
        }

        const existingWithSameName = await Product.findByNameNormalized(nextName, req.params.id);
        if (existingWithSameName) {
            return res.status(409).json({ message: 'A product with this name already exists' });
        }

        const nextPrice = typeof price === 'undefined' ? Number(existingProduct.price) : Number(price);
        if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
            return res.status(400).json({ message: 'Price must be greater than 0' });
        }

        const nextStock = typeof stock === 'undefined' ? Number(existingProduct.stock) : Math.trunc(Number(stock));
        if (!Number.isFinite(nextStock) || nextStock < 0) {
            return res.status(400).json({ message: 'Stock must be 0 or greater' });
        }

        const productData = {
            category_id: typeof category_id === 'undefined' ? existingProduct.category_id : (category_id || null),
            subcategory_id: typeof subcategory_id === 'undefined' ? existingProduct.subcategory_id : (subcategory_id || null),
            name: nextName,
            price: nextPrice,
            stock: nextStock,
            description: typeof description === 'undefined' ? (existingProduct.description || '') : description,
            image: mainImage,
            images: images.length > 0 ? images : null,
            media: media.length > 0 ? media : null,
            size_type: normalizedSizeType,
            size_options: normalizedSizeOptions,
            color_type: normalizedColorType,
            color_options: normalizedColorOptions
        };

        const product = await Product.update(req.params.id, productData);
        
        res.json({ 
            success: true,
            message: 'Product updated successfully',
            product 
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: error.message });
    }
};

// Remove an image from a product
exports.removeProductImage = async (req, res) => {
    try {
        const productId = req.params.id;
        const { imageUrl } = req.body;
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) return res.status(404).json({ message: 'Product not found' });

        let media = Array.isArray(existingProduct.media)
            ? existingProduct.media
            : (existingProduct.images || []).map((url) => ({ type: 'image', url }));
        const targetUrl = req.body.mediaUrl || imageUrl;
        if (!targetUrl || !media.some((m) => m.url === targetUrl)) {
            return res.status(400).json({ message: 'Media not found in product' });
        }

        media = media.filter((m) => m.url !== targetUrl);
        const images = media.filter((m) => m.type === 'image').map((m) => m.url);
        let mainImage = existingProduct.image;
        if (mainImage === targetUrl) {
            mainImage = images.length > 0 ? images[0] : null;
        }

        // If file is local, delete it
        try {
            if (targetUrl.startsWith('/uploads/products/')) {
                const filePath = path.join(__dirname, '..', targetUrl.replace(/^\//, ''));
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
        } catch (e) { console.warn('Failed to delete product image file', e); }

        const productData = { media: media.length > 0 ? media : null, images: images.length > 0 ? images : null, image: mainImage };
        await Product.update(productId, productData);
        const updated = await Product.findById(productId);
        res.json({ success: true, message: 'Media removed', product: updated });
    } catch (err) {
        console.error('Error removing product image:', err);
        res.status(500).json({ message: err.message });
    }
};

// Set a main image for a product (must be an existing image)
exports.setMainImage = async (req, res) => {
    try {
        const productId = req.params.id;
        const imageUrl = req.body.imageUrl || req.body.mediaUrl;
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) return res.status(404).json({ message: 'Product not found' });

        const media = Array.isArray(existingProduct.media)
            ? existingProduct.media
            : (existingProduct.images || []).map((url) => ({ type: 'image', url }));
        const urls = media.map((m) => m.url);
        if (!imageUrl || (!urls.includes(imageUrl) && !(imageUrl.startsWith('/uploads/products/')))) {
            return res.status(400).json({ message: 'Media must be one of the product media URLs or a valid upload URL' });
        }

        await Product.update(productId, { image: imageUrl });
        const updated = await Product.findById(productId);
        res.json({ success: true, message: 'Main image updated', product: updated });
    } catch (err) {
        console.error('Error setting main image:', err);
        res.status(500).json({ message: err.message });
    }
};

// Delete product
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        await Product.delete(req.params.id);
        
        res.json({ 
            success: true,
            message: 'Product deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get reviews for a product
exports.getReviews = async (req, res) => {
    try {
        const productId = req.params.id;
        const allReviews = readReviewsFile();
        const reviews = allReviews[productId] || [];
        res.json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get all reviews for owner/admin dashboards
exports.getAllReviews = async (req, res) => {
    try {
        const allReviews = readReviewsFile();
        const products = await Product.findAll();
        const productNameById = new Map((products || []).map(p => [String(p.id), p.name || `Product ${p.id}`]));

        const flattened = Object.entries(allReviews).flatMap(([productId, list]) => {
            const safeList = Array.isArray(list) ? list : [];
            return safeList.map((review, idx) => ({
                id: review.id || `${productId}-${idx}-${review.date || Date.now()}`,
                productId: Number(productId),
                productName: productNameById.get(String(productId)) || `Product ${productId}`,
                userName: review.userName || review.customer_name || 'Customer',
                userEmail: review.userEmail || '',
                rating: Number(review.rating || 0),
                comment: review.comment || '',
                helpful: Number(review.helpful || 0),
                date: review.date || new Date().toISOString()
            }));
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ success: true, reviews: flattened });
    } catch (error) {
        console.error('Error fetching all reviews:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Post a review for a product
exports.postReview = async (req, res) => {
    try {
        const productId = req.params.id;
        const review = req.body;
        if (!review || !review.rating || !review.comment) {
            return res.status(400).json({ message: 'Rating and comment are required' });
        }

        const allReviews = readReviewsFile();
        if (!allReviews[productId]) allReviews[productId] = [];

        // Add timestamp if not present
        review.date = review.date || new Date().toISOString();
        allReviews[productId].unshift(review);
        writeReviewsFile(allReviews);

        res.status(201).json(review);
    } catch (error) {
        console.error('Error saving review:', error);
        res.status(500).json({ message: error.message });
    }
};
