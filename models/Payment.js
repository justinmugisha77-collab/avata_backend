const db = require('../config/db');

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
