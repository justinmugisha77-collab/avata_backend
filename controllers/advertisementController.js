const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Advertisement = require('../models/Advertisement');

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/jfif', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.heic', '.heif', '.mp4', '.webm', '.mov', '.avi', '.mkv']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.heic', '.heif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv']);

const uploadDir = path.join(__dirname, '..', 'uploads', 'advertisements');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `ad-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const mime = String(file?.mimetype || '').toLowerCase();
  const ext = String(path.extname(file?.originalname || '') || '').toLowerCase();
  const isAllowedMime = IMAGE_MIME_TYPES.has(mime) || VIDEO_MIME_TYPES.has(mime);
  const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);

  if (isAllowedMime || isAllowedExt) {
    cb(null, true);
    return;
  }
  cb(new Error('Unsupported file format. Use JPG, JPEG, JFIF, PNG, WEBP, GIF, HEIC, HEIF, MP4, WEBM, MOV, AVI, or MKV.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 80 * 1024 * 1024 }
});

exports.handleUploadError = (err, req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum allowed size is 80MB.' });
    }
    return res.status(400).json({ success: false, message: err.message || 'Upload failed.' });
  }

  return res.status(400).json({ success: false, message: err.message || 'Invalid upload file.' });
};

function toPublicUrl(req, advertisement) {
  const current = advertisement || Advertisement.get();
  const base = `${req.protocol}://${req.get('host')}`;
  const items = Array.isArray(current.items) ? current.items : [];
  return {
    ...current,
    items,
    itemsWithUrls: items.map((item) => ({
      ...item,
      mediaUrl: item.media && item.media.startsWith('/uploads') ? `${base}${item.media}` : item.media
    }))
  };
}

function removeLocalUpload(uploadPath) {
  if (!uploadPath || typeof uploadPath !== 'string' || !uploadPath.startsWith('/uploads/advertisements/')) return;
  const absolutePath = path.join(__dirname, '..', uploadPath.replace(/^\//, ''));
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

function getMediaType(req, file) {
  const bodyType = String(req.body?.mediaType || req.body?.type || '').toLowerCase();
  if (bodyType === 'image' || bodyType === 'video') return bodyType;
  if (file?.mimetype?.startsWith('video/')) return 'video';
  return 'image';
}

exports.uploadMiddleware = upload.single('ad_media');

exports.getAdvertisement = (req, res) => {
  try {
    const advertisement = Advertisement.get();
    res.json({ success: true, advertisement: toPublicUrl(req, advertisement) });
  } catch (error) {
    console.error('Failed to load advertisement:', error);
    res.status(500).json({ success: false, message: 'Failed to load advertisement' });
  }
};

exports.addAdvertisementItem = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Advertisement media file is required' });
    }

    const mediaType = getMediaType(req, req.file);
    const mime = String(req.file?.mimetype || '').toLowerCase();
    const ext = String(path.extname(req.file?.originalname || '') || '').toLowerCase();
    if (mediaType === 'image' && !IMAGE_MIME_TYPES.has(mime)) {
      if (IMAGE_EXTENSIONS.has(ext)) {
        // Some clients send generic MIME for jfif/heic; extension is a safe fallback.
      } else {
        removeLocalUpload(`/uploads/advertisements/${req.file.filename}`);
        return res.status(400).json({ success: false, message: 'Uploaded file is not a supported image.' });
      }
    }
    if (mediaType === 'video' && !VIDEO_MIME_TYPES.has(mime)) {
      if (VIDEO_EXTENSIONS.has(ext)) {
        // Keep accepted based on extension fallback.
      } else {
        removeLocalUpload(`/uploads/advertisements/${req.file.filename}`);
        return res.status(400).json({ success: false, message: 'Uploaded file is not a supported video.' });
      }
    }

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();

    const advertisement = Advertisement.addItem({
      type: mediaType,
      media: `/uploads/advertisements/${req.file.filename}`,
      title,
      description
    });

    res.json({ success: true, advertisement: toPublicUrl(req, advertisement) });
  } catch (error) {
    console.error('Failed to add advertisement item:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to add advertisement item' });
  }
};

exports.removeAdvertisementItem = (req, res) => {
  try {
    const itemId = String(req.params.id || '').trim();
    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Advertisement item id is required' });
    }

    const current = Advertisement.get();
    const existing = (current.items || []).find((item) => item.id === itemId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Advertisement item not found' });
    }

    if (existing.media) {
      removeLocalUpload(existing.media);
    }

    const advertisement = Advertisement.removeItem(itemId);
    res.json({ success: true, advertisement: toPublicUrl(req, advertisement) });
  } catch (error) {
    console.error('Failed to remove advertisement item:', error);
    res.status(500).json({ success: false, message: 'Failed to remove advertisement item' });
  }
};

exports.updateAdvertisementItem = (req, res) => {
  try {
    const itemId = String(req.params.id || '').trim();
    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Advertisement item id is required' });
    }

    const current = Advertisement.get();
    const existing = (current.items || []).find((item) => item.id === itemId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Advertisement item not found' });
    }

    const updates = {};
    if (typeof req.body?.visible !== 'undefined') {
      updates.visible = Boolean(req.body.visible);
    }
    if (typeof req.body?.title === 'string') {
      updates.title = req.body.title;
    }
    if (typeof req.body?.description === 'string') {
      updates.description = req.body.description;
    }

    const advertisement = Advertisement.updateItem(itemId, updates);
    res.json({ success: true, advertisement: toPublicUrl(req, advertisement) });
  } catch (error) {
    console.error('Failed to update advertisement item:', error);
    res.status(500).json({ success: false, message: 'Failed to update advertisement item' });
  }
};

exports.reorderAdvertisementItems = (req, res) => {
  try {
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map((id) => String(id)) : [];
    if (!itemIds.length) {
      return res.status(400).json({ success: false, message: 'itemIds array is required' });
    }

    const advertisement = Advertisement.reorderItems(itemIds);
    res.json({ success: true, advertisement: toPublicUrl(req, advertisement) });
  } catch (error) {
    console.error('Failed to reorder advertisement items:', error);
    res.status(500).json({ success: false, message: 'Failed to reorder advertisement items' });
  }
};

exports.deleteAdvertisement = (req, res) => {
  try {
    const current = Advertisement.get();
    (current.items || []).forEach((item) => removeLocalUpload(item.media));
    const advertisement = Advertisement.clear();
    res.json({ success: true, advertisement: toPublicUrl(req, advertisement) });
  } catch (error) {
    console.error('Failed to delete advertisement:', error);
    res.status(500).json({ success: false, message: 'Failed to delete advertisement' });
  }
};