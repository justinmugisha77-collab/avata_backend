const express = require('express');
const router = express.Router();
const {
    createOrder,
    getUserOrders,
    getAllOrders,
    getReceipt,
    updateReceiptSettings,
    updateOrderStatus,
    verifyPayment,
    rejectPayment,
    markAsShipped,
    markAsDelivered,
    confirmDelivery,
    submitPaymentProof,
    submitPaymentProofFile,
    removePaymentProof,
    uploadProofMiddleware,
    getOrderComments,
    addOrderComment,
    getAnalytics,
    resendOrder,
    cancelOrder,
    cancelOwnOrder,
    deleteOrder
} = require('../controllers/orderController');
const { protect, ownerOnly, adminOnly } = require('../middleware/authMiddleware');

// Public routes
router.post('/', createOrder);

// Receipt (protected)
router.get('/:id/receipt', protect, getReceipt);
router.put('/:id/receipt', protect, adminOnly, updateReceiptSettings);

// Protected routes (customer & above)
router.get('/myorders', protect, getUserOrders);
router.post('/:id/payment-proof', protect, submitPaymentProof);
router.post('/:id/payment-proof-upload', protect, uploadProofMiddleware, submitPaymentProofFile);
router.delete('/:id/payment-proof', protect, removePaymentProof);
router.put('/:id/cancel-my-order', protect, cancelOwnOrder);
router.get('/:id/comments', protect, getOrderComments);
router.post('/:id/comments', protect, addOrderComment);

// Analytics (owner/admin only)
router.get('/analytics', protect, ownerOnly, getAnalytics);

// Owner/Admin only routes
router.get('/', protect, ownerOnly, getAllOrders);
router.put('/:id/status', protect, ownerOnly, updateOrderStatus);
router.post('/:id/verify-payment', protect, ownerOnly, verifyPayment);
router.post('/:id/reject-payment', protect, ownerOnly, rejectPayment);
router.put('/:id/ship', protect, ownerOnly, markAsShipped);
router.put('/:id/deliver', protect, ownerOnly, markAsDelivered);
router.post('/:id/confirm-delivery', protect, confirmDelivery);
router.put('/:id/resend', protect, ownerOnly, resendOrder);
router.put('/:id/cancel', protect, ownerOnly, cancelOrder);
router.delete('/:id', protect, ownerOnly, deleteOrder);

module.exports = router;
