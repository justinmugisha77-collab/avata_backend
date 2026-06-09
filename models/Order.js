const db = require('../config/db');

class Order {
    static schemaEnsured = false;

    static async ensureSchema() {
        if (this.schemaEnsured) return;
        try {
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL");
        } catch (e) {
            // Some MySQL versions don't support IF NOT EXISTS for ALTER TABLE; ignore failures
        }
        try {
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_transport DECIMAL(12,2) NOT NULL DEFAULT 0");
        } catch (e) {
            // Some MySQL versions don't support IF NOT EXISTS for ALTER TABLE; ignore failures
        }
        try {
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_updated_at DATETIME NULL");
        } catch (e) {
            // Some MySQL versions don't support IF NOT EXISTS for ALTER TABLE; ignore failures
        }
        try {
            await db.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_updated_by BIGINT NULL");
        } catch (e) {
            // Some MySQL versions don't support IF NOT EXISTS for ALTER TABLE; ignore failures
        }
        this.schemaEnsured = true;
    }
    static async create(order) {
        await this.ensureSchema();
        const { user_id, total_amount, status, order_source, customer_name, customer_email, customer_phone, items, payment_number, delivery_address } = order;
        const [result] = await db.execute(
            `INSERT INTO orders (user_id, total_amount, status, order_source, customer_name, customer_email, customer_phone, items, payment_status, verification_status, payment_number, delivery_address) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)`,
            [
                user_id || null,
                total_amount,
                status || 'Waiting_Proof',
                order_source || 'website',
                customer_name,
                customer_email,
                customer_phone,
                JSON.stringify(items || []),
                payment_number || `PAY-${Date.now()}`,
                delivery_address || null
            ]
        );
        return result.insertId;
    }

    static async createWithConnection(order, connection) {
        await this.ensureSchema();
        const { user_id, total_amount, status, order_source, customer_name, customer_email, customer_phone, items, payment_number, delivery_address } = order;
        const [result] = await connection.execute(
            `INSERT INTO orders (user_id, total_amount, status, order_source, customer_name, customer_email, customer_phone, items, payment_status, verification_status, payment_number, delivery_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)`,
            [
                user_id || null,
                total_amount,
                status || 'Waiting_Proof',
                order_source || 'website',
                customer_name,
                customer_email,
                customer_phone,
                JSON.stringify(items || []),
                payment_number || `PAY-${Date.now()}`,
                delivery_address || null
            ]
        );
        return result.insertId;
    }

    static async findById(id) {
        await this.ensureSchema();
        const [rows] = await db.execute('SELECT * FROM orders WHERE id = ?', [id]);
        if (rows[0] && rows[0].items) {
            rows[0].items = JSON.parse(rows[0].items);
        }
        return rows[0];
    }

    static async findAll() {
        await this.ensureSchema();
        const [rows] = await db.execute(
            `SELECT o.*, u.full_name as user_full_name, u.email as user_email 
             FROM orders o 
             LEFT JOIN users u ON o.user_id = u.id 
             ORDER BY o.created_at DESC`
        );
        return rows.map(row => {
            if (row.items) {
                try { row.items = JSON.parse(row.items); } catch (e) { row.items = []; }
            }
            return row;
        });
    }

    static async findByUserId(userId) {
        await this.ensureSchema();
        const [rows] = await db.execute(
            'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return rows.map(row => {
            if (row.items) {
                try { row.items = JSON.parse(row.items); } catch (e) { row.items = []; }
            }
            return row;
        });
    }

    static async findByUserIdentifier({ userId = null, email = null }) {
        await this.ensureSchema();
        if (userId) return this.findByUserId(userId);
        if (email) {
            const [rows] = await db.execute(
                'SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC',
                [email]
            );
            return rows.map(row => {
                if (row.items) {
                    try { row.items = JSON.parse(row.items); } catch (e) { row.items = []; }
                }
                return row;
            });
        }
        return [];
    }

    static async update(id, updates) {
        const fields = [];
        const values = [];
        Object.keys(updates).forEach(key => {
            if (key === 'items') {
                fields.push(`${key} = ?`);
                values.push(JSON.stringify(updates[key]));
            } else {
                fields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        });
        values.push(id);
        const query = `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.execute(query, values);
        return result.affectedRows;
    }

    static async updatePaymentStatus(id, status, receiptUrl = null) {
        const updates = { payment_status: status };
        if (receiptUrl) updates.payment_receipt = receiptUrl;
        if (status === 'verified' || status === 'Paid') updates.verified_at = new Date();
        return this.update(id, updates);
    }

    static async updateVerificationStatus(id, verification_status) {
        return this.update(id, { verification_status });
    }

    static async updateStatus(id, status) {
        const updates = { status };
        if (status === 'delivered') updates.delivered_at = new Date();
        return this.update(id, updates);
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM orders WHERE id = ?', [id]);
        return result.affectedRows;
    }

    // --- ORDER COMMENTS ---
    static async addComment(orderId, userId, comment) {
        const [result] = await db.execute(
            'INSERT INTO order_comments (order_id, user_id, comment) VALUES (?, ?, ?)',
            [orderId, userId, comment]
        );
        return result.insertId;
    }

    static async getComments(orderId) {
        const [rows] = await db.execute(
            `SELECT oc.*, u.full_name as author_name, u.role as author_role
             FROM order_comments oc
             LEFT JOIN users u ON oc.user_id = u.id
             WHERE oc.order_id = ?
             ORDER BY oc.created_at ASC`,
            [orderId]
        );
        return rows;
    }

    // --- ANALYTICS ---
    static async getMonthlyRevenue() {
        const [rows] = await db.execute(
            `SELECT 
                YEAR(created_at) as year,
                MONTH(created_at) as month,
                SUM(total_amount) as revenue,
                COUNT(*) as order_count,
                SUM(CASE WHEN payment_status = 'verified' THEN total_amount ELSE 0 END) as verified_revenue
             FROM orders
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
             GROUP BY YEAR(created_at), MONTH(created_at)
             ORDER BY year ASC, month ASC`
        );
        return rows;
    }

    static async getWeeklyRevenue() {
        const [rows] = await db.execute(
            `SELECT 
                DATE(created_at) as date,
                DAYNAME(created_at) as day_name,
                SUM(total_amount) as revenue,
                COUNT(*) as order_count,
                SUM(CASE WHEN payment_status = 'verified' THEN total_amount ELSE 0 END) as verified_revenue
             FROM orders
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY DATE(created_at), DAYNAME(created_at)
             ORDER BY DATE(created_at) ASC`
        );
        return rows;
    }

    static async getYearlyRevenue() {
        const [rows] = await db.execute(
            `SELECT 
                YEAR(created_at) as year,
                MONTHNAME(created_at) as month_name,
                SUM(total_amount) as revenue,
                COUNT(*) as order_count,
                SUM(CASE WHEN payment_status = 'verified' THEN total_amount ELSE 0 END) as verified_revenue
             FROM orders
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
             GROUP BY YEAR(created_at), MONTH(created_at), MONTHNAME(created_at)
             ORDER BY year ASC, MONTH(created_at) ASC`
        );
        return rows;
    }

    static async getTopProducts() {
        const [rows] = await db.execute(
            `SELECT 
                JSON_UNQUOTE(JSON_EXTRACT(items_expanded.item, '$.name')) as product_name,
                SUM(JSON_EXTRACT(items_expanded.item, '$.quantity')) as total_quantity,
                SUM(JSON_EXTRACT(items_expanded.item, '$.price') * JSON_EXTRACT(items_expanded.item, '$.quantity')) as total_revenue,
                COUNT(DISTINCT o.id) as order_count
             FROM orders o
             JOIN JSON_TABLE(
                COALESCE(o.items, '[]'),
                '$[*]' COLUMNS (item JSON PATH '$')
             ) items_expanded
             WHERE o.payment_status = 'verified'
             GROUP BY product_name
             ORDER BY total_revenue DESC
             LIMIT 10`
        );
        return rows;
    }

    static async getStatusCounts() {
        const [rows] = await db.execute(
            `SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_payment,
                SUM(CASE WHEN payment_status = 'awaiting_verification' THEN 1 ELSE 0 END) as awaiting_verification,
                SUM(CASE WHEN payment_status = 'verified' THEN 1 ELSE 0 END) as verified,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN order_source = 'whatsapp' THEN 1 ELSE 0 END) as whatsapp_orders,
                SUM(CASE WHEN order_source = 'website' THEN 1 ELSE 0 END) as website_orders,
                SUM(COALESCE(total_amount, 0)) as total_revenue,
                SUM(CASE WHEN payment_status = 'verified' THEN COALESCE(total_amount, 0) ELSE 0 END) as verified_revenue,
                COUNT(DISTINCT COALESCE(user_id, customer_email)) as total_customers
             FROM orders`
        );
        return rows[0];
    }
}

module.exports = Order;
