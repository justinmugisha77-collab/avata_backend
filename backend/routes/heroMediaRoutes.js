const express = require('express');
const router = express.Router();
const { getHeroMedia, updateHeroMedia, deleteHeroMedia, uploadMiddleware } = require('../controllers/heroMediaController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', getHeroMedia);
router.put('/', protect, adminOnly, uploadMiddleware, updateHeroMedia);
router.delete('/', protect, adminOnly, deleteHeroMedia);

module.exports = router;