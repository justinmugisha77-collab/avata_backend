const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public route - create message (contact form)
router.post('/', messageController.createMessage);

// Admin routes - view and manage messages
router.get('/', protect, adminOnly, messageController.getAllMessages);
router.get('/:id', protect, adminOnly, messageController.getMessageById);
router.delete('/:id', protect, adminOnly, messageController.deleteMessage);

module.exports = router;
