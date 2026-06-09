const express = require('express');
const router = express.Router();
const { uploadMiddleware, list, getById, create, update, remove } = require('../controllers/specialOfferController');
const { protect, ownerOnly } = require('../middleware/authMiddleware');

// Public: list offers
router.get('/', list);
router.get('/:id', getById);

// Protected: create/remove (owner/admin)
router.post('/', protect, ownerOnly, uploadMiddleware, create);
router.put('/:id', protect, ownerOnly, uploadMiddleware, update);
router.delete('/:id', protect, ownerOnly, remove);

module.exports = router;
