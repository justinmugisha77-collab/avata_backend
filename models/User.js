const db = require('../config/db');

class User {
    static async create(user) {
        const { full_name, phone, email, password, role } = user;
        const [result] = await db.execute(
            'INSERT INTO users (full_name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [full_name, phone, email, password, role]
        );
        return result.insertId;
    }

    static async findByEmail(email) {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
        return rows[0];
    }

    static async findByResetToken(resetToken) {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()',
            [resetToken]
        );
        return rows[0];
    }

    static async findAll() {
        const [rows] = await db.execute(
            'SELECT id, full_name, email, phone, role, created_at FROM users ORDER BY created_at DESC'
        );
        return rows;
    }

    static async update(id, user) {
        const { full_name, phone, email, password, role } = user;
        
        // Build dynamic update query based on provided fields
        const updates = [];
        const values = [];
        
        if (full_name !== undefined) {
            updates.push('full_name = ?');
            values.push(full_name);
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            values.push(phone);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (password !== undefined) {
            updates.push('password = ?');
            values.push(password);
        }
        if (role !== undefined) {
            updates.push('role = ?');
            values.push(role);
        }
        
        if (updates.length === 0) {
            throw new Error('No fields to update');
        }
        
        values.push(id);
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        
        const [result] = await db.execute(query, values);
        return result.affectedRows;
    }

    static async setPasswordResetToken(id, token, expiresAt) {
        const [result] = await db.execute(
            'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
            [token, expiresAt, id]
        );
        return result.affectedRows;
    }

    static async clearPasswordResetToken(id) {
        const [result] = await db.execute(
            'UPDATE users SET reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?',
            [id]
        );
        return result.affectedRows;
    }

    static async updatePasswordById(id, password) {
        const [result] = await db.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [password, id]
        );
        return result.affectedRows;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
        return result.affectedRows;
    }
}

module.exports = User;

