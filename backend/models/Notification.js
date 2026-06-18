const { mongoose, Schema } = require('../config/db');

const notificationSchema = new Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    message: String,
    type: {
        type: String,
        default: 'info'
    },
    is_read: {
        type: Boolean,
        default: false
    },
    link: String,
    created_at: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Index for efficient user queries
notificationSchema.index({ user_id: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;


class Notification {
    static _schemaReady = null;

    static async ensureSchema() {
        if (!this._schemaReady) {
            this._schemaReady = this.initTable().catch((err) => {
                this._schemaReady = null;
                throw err;
            });
        }
        await this._schemaReady;
    }

    static async initTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                link VARCHAR(255),
                INDEX idx_user_id (user_id),
                INDEX idx_created_at (created_at)
            )
        `;
        try {
            await db.execute(query);
            // Backward-compatible schema upgrades for existing databases.
            await db.execute('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id INT NULL');
            await db.execute('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL');
            await db.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'info'");
            await db.execute('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE');
            await db.execute('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
            await db.execute('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(255) NULL');
            await db.execute('ALTER TABLE notifications MODIFY COLUMN user_id INT NULL');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_user_id ON notifications (user_id)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON notifications (created_at)');
            console.log('✓ Notifications table initialized');
        } catch (err) {
            console.error('Error initializing notifications table:', err);
        }
    }

    static async create(data) {
        await this.ensureSchema();
        const { user_id, message, type, link } = data;
        const [result] = await db.execute(
            'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
            [user_id || null, message, type || 'info', link || null]
        );
        return result.insertId;
    }

    static async findAllForUser(userId) {
        await this.ensureSchema();
        // userId can be null for system-wide/owner notifications
        if (userId) {
            const [rows] = await db.execute(
                'SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50',
                [userId]
            );
            return rows;
        } else {
            const [rows] = await db.execute(
                'SELECT * FROM notifications WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50'
            );
            return rows;
        }
    }

    static async markAsRead(id) {
        await this.ensureSchema();
        await db.execute('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
    }

    static async delete(id) {
        await this.ensureSchema();
        await db.execute('DELETE FROM notifications WHERE id = ?', [id]);
    }
}

// Auto-init table
Notification.initTable().catch(console.error);

module.exports = Notification;
