const Payment = require('../models/Payment');
const PaymentOption = require('../models/PaymentOption');

exports.confirmPayment = async (req, res) => {
    // TODO: Implement payment confirmation logic
    res.status(200).json({ message: 'Payment confirmed' });
};

exports.getPaymentOptions = async (req, res) => {
    try {
        const options = await PaymentOption.getCurrent();
        res.json({ success: true, options });
    } catch (error) {
        console.error('Error loading payment options:', error);
        res.status(500).json({ success: false, message: 'Failed to load payment options' });
    }
};

exports.updatePaymentOptions = async (req, res) => {
    try {
        const updated = await PaymentOption.upsert(req.body || {}, req.user?.id || null);
        res.json({ success: true, message: 'Payment options updated successfully', options: updated });
    } catch (error) {
        console.error('Error updating payment options:', error);
        res.status(500).json({ success: false, message: 'Failed to update payment options' });
    }
};
