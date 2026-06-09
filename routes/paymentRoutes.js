const express = require('express');
const router = express.Router();
const { confirmPayment, getPaymentOptions, updatePaymentOptions } = require('../controllers/paymentController');
const { protect, ownerOnly } = require('../middleware/authMiddleware');

router.post('/confirm', confirmPayment);
router.get('/options', protect, getPaymentOptions);
router.put('/options', protect, ownerOnly, updatePaymentOptions);

module.exports = router;
