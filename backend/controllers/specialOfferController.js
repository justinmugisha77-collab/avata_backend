const path = require('path');
const fs = require('fs');
const multer = require('multer');
const SpecialOffer = require('../models/SpecialOffer');

// ensure upload dir
const uploadDir = path.join(__dirname, '..', 'uploads', 'special_offers');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `offer-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.heic', '.heif'];
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowed.includes(ext));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

exports.uploadMiddleware = upload.single('image_file');

function normalizeOffer(offer) {
  const parsedStock = Number(offer?.stock ?? 100);
  return {
    ...offer,
    stock: Number.isFinite(parsedStock) ? Math.max(0, Math.trunc(parsedStock)) : 100
  };
}

exports.list = async (req, res) => {
  try {
    const offers = SpecialOffer.findAll();
    // convert local file paths to public URLs
    const base = `${req.protocol}://${req.get('host')}`;
    const normalized = offers.map(o => normalizeOffer({
      ...o,
      image: o.image && o.image.startsWith('/uploads') ? `${base}${o.image}` : o.image
    }));
    res.json({ success: true, offers: normalized });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to load special offers' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = SpecialOffer.findById(id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Special offer not found' });
    }
    const base = `${req.protocol}://${req.get('host')}`;
    const normalized = normalizeOffer({
      ...offer,
      image: offer.image && offer.image.startsWith('/uploads') ? `${base}${offer.image}` : offer.image
    });
    res.json({ success: true, offer: normalized });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to load special offer' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, category, originalPrice, currentPrice, stock, image_url, linkedProductId, linked_product_id } = req.body;
    let image = image_url || '';
    if (req.file) {
      // store public path
      image = `/uploads/special_offers/${req.file.filename}`;
    }
    const parsedLinkedProductId = Number(linkedProductId || linked_product_id || 0);
    const offer = SpecialOffer.create({
      name,
      category,
      originalPrice: Number(originalPrice || 0),
      currentPrice: Number(currentPrice || 0),
      stock: Number.isFinite(Number(stock)) ? Math.max(0, Math.trunc(Number(stock))) : 100,
      image,
      linkedProductId: Number.isFinite(parsedLinkedProductId) && parsedLinkedProductId > 0 ? parsedLinkedProductId : null
    });
    res.status(201).json({ success: true, offer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to create special offer' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = SpecialOffer.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Special offer not found' });
    }

    const { name, category, originalPrice, currentPrice, stock, image_url, linkedProductId, linked_product_id } = req.body;
    let image = typeof image_url === 'string' ? image_url : existing.image;
    if (req.file) {
      image = `/uploads/special_offers/${req.file.filename}`;
      if (existing.image && existing.image.startsWith('/uploads/special_offers/')) {
        const oldImagePath = path.join(__dirname, '..', existing.image.replace(/^\//, ''));
        if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      }
    }

    const parsedLinkedProductId = Number(linkedProductId || linked_product_id || 0);
    const parsedStock = Number(stock);
    const resolvedStock = Number.isFinite(parsedStock)
      ? Math.max(0, Math.trunc(parsedStock))
      : Math.max(0, Math.trunc(Number(existing.stock ?? 100)));
    const offer = SpecialOffer.update(id, {
      name,
      category,
      originalPrice: Number(originalPrice || 0),
      currentPrice: Number(currentPrice || 0),
      stock: resolvedStock,
      image,
      linkedProductId: Number.isFinite(parsedLinkedProductId) && parsedLinkedProductId > 0 ? parsedLinkedProductId : null
    });
    res.json({ success: true, offer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to update special offer' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = SpecialOffer.findById(id);
    if (existing?.image && existing.image.startsWith('/uploads/special_offers/')) {
      const oldImagePath = path.join(__dirname, '..', existing.image.replace(/^\//, ''));
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
    }
    SpecialOffer.remove(id);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to remove special offer' });
  }
};
