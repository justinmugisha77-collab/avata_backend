const express = require('express');
const router = express.Router();
const {
	getAdvertisement,
	addAdvertisementItem,
	removeAdvertisementItem,
	updateAdvertisementItem,
	reorderAdvertisementItems,
	deleteAdvertisement,
	uploadMiddleware,
	handleUploadError
} = require('../controllers/advertisementController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', getAdvertisement);
router.post('/items', protect, adminOnly, uploadMiddleware, handleUploadError, addAdvertisementItem);
router.patch('/items/:id', protect, adminOnly, express.json(), updateAdvertisementItem);
router.delete('/items/:id', protect, adminOnly, removeAdvertisementItem);
router.put('/items/reorder', protect, adminOnly, express.json(), reorderAdvertisementItems);
router.delete('/', protect, adminOnly, deleteAdvertisement);

module.exports = router;