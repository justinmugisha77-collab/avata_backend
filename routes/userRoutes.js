const express = require('express');
const router = express.Router();
const { getAllUsers, getProfile, updateProfile, createUser, updateUser, resetUserPassword, deleteUser } = require('../controllers/userController');
const { protect, ownerOnly } = require('../middleware/authMiddleware');

// Self-service profile (any authenticated user)
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

// Admin/Owner only
router.get('/', protect, ownerOnly, getAllUsers);
router.post('/', protect, ownerOnly, createUser);
router.put('/:id', protect, ownerOnly, updateUser);
router.post('/:id/reset-password', protect, ownerOnly, resetUserPassword);
router.delete('/:id', protect, ownerOnly, deleteUser);

// Maintenance
const { exportDatabase } = require('../controllers/userController');
router.get('/backup/export', protect, ownerOnly, exportDatabase);

module.exports = router;
