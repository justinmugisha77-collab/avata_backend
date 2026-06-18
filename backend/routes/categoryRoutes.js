const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect, ownerOnly } = require('../middleware/authMiddleware');

// Get all categories (public)
router.get('/', categoryController.getAllCategories);

// Get single category (public)
router.get('/:id', categoryController.getCategory);

// Create category (admin only)
router.post('/', protect, ownerOnly, categoryController.uploadImage, categoryController.createCategory);

// Update category (admin only)
router.put('/:id', protect, ownerOnly, categoryController.uploadImage, categoryController.updateCategory);

// Delete category (admin only)
router.delete('/:id', protect, ownerOnly, categoryController.deleteCategory);

module.exports = router;

