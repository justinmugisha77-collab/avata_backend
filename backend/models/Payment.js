const { mongoose, Schema } = require('../config/db');

const paymentSchema = new Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    phone_used: String,
    amount: Number,
    payment_proof: String,
    status: {
        type: String,
        default: 'pending'
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;


class Payment {
    static async create(payment) {
        const { order_id, phone_used, amount, payment_proof, status } = payment;
        const [result] = await db.execute(
            'INSERT INTO payments (order_id, phone_used, amount, payment_proof, status) VALUES (?, ?, ?, ?, ?)',
            [order_id, phone_used, amount, payment_proof, status]
        );
        return result.insertId;
    }
}

module.exports = Payment;
