const fs = require('fs');
const path = require('path');
const multer = require('multer');
const HeroMedia = require('../models/HeroMedia');

const uploadDir = path.join(__dirname, '..', 'uploads', 'hero_media');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `hero-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const mime = String(file?.mimetype || '').toLowerCase();
  const ext = String(path.extname(file?.originalname || '') || '').toLowerCase();
  if (VIDEO_MIME_TYPES.has(mime) || VIDEO_EXTENSIONS.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error('Only MP4, WEBM, MOV, AVI, and MKV video files are allowed for hero media.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
});

function toPublicUrl(req, media) {
  const current = media || HeroMedia.get();
  const base = `${req.protocol}://${req.get('host')}`;
  return {
    ...current,
    videoUrl: current.video && current.video.startsWith('/uploads') ? `${base}${current.video}` : current.video
  };
}

function removeLocalUpload(uploadPath) {
  if (!uploadPath || typeof uploadPath !== 'string' || !uploadPath.startsWith('/uploads/hero_media/')) return;
  const absolutePath = path.join(__dirname, '..', uploadPath.replace(/^\//, ''));
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

exports.uploadMiddleware = upload.single('hero_video');

exports.getHeroMedia = (req, res) => {
  try {
    const media = HeroMedia.get();
    res.json({ success: true, media: toPublicUrl(req, media) });
  } catch (error) {
    console.error('Failed to load hero media:', error);
    res.status(500).json({ success: false, message: 'Failed to load hero media' });
  }
};

exports.updateHeroMedia = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Hero video file is required' });
    }

    const current = HeroMedia.get();
    if (current.video) {
      removeLocalUpload(current.video);
    }

    const media = HeroMedia.save({
      type: 'video',
      video: `/uploads/hero_media/${req.file.filename}`
    });

    res.json({ success: true, media: toPublicUrl(req, media) });
  } catch (error) {
    console.error('Failed to update hero media:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update hero media' });
  }
};

exports.deleteHeroMedia = (req, res) => {
  try {
    const current = HeroMedia.get();
    if (current.video) {
      removeLocalUpload(current.video);
    }
    const media = HeroMedia.clear();
    res.json({ success: true, media: toPublicUrl(req, media) });
  } catch (error) {
    console.error('Failed to delete hero media:', error);
    res.status(500).json({ success: false, message: 'Failed to delete hero media' });
  }
};