const { mongoose, Schema } = require('../config/db');

const paymentOptionSchema = new Schema({
    bank_bk_account: String,
    bank_equity_account: String,
    mobile_mtn_number: String,
    mobile_airtel_number: String,
    tin_number: String,
    ebm_number: String,
    reference_prefix: {
        type: String,
        default: 'PAY'
    },
    notes: String,
    updated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updated_at: {
        type: Date,
        default: Date.now
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

const PaymentOption = mongoose.model('PaymentOption', paymentOptionSchema);
module.exports = PaymentOption;


const DEFAULT_OPTIONS = {
    bank_bk_account: '',
    bank_equity_account: '',
    mobile_mtn_number: '',
    mobile_airtel_number: '',
    tin_number: '',
    ebm_number: '',
    reference_prefix: 'PAY',
    notes: ''
};

class PaymentOption {
    static async ensureTable() {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS payment_options (
                id INT PRIMARY KEY AUTO_INCREMENT,
                bank_bk_account VARCHAR(120) DEFAULT '',
                bank_equity_account VARCHAR(120) DEFAULT '',
                mobile_mtn_number VARCHAR(60) DEFAULT '',
                mobile_airtel_number VARCHAR(60) DEFAULT '',
                tin_number VARCHAR(60) DEFAULT '',
                ebm_number VARCHAR(60) DEFAULT '',
                reference_prefix VARCHAR(20) DEFAULT 'PAY',
                notes TEXT,
                updated_by INT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.execute('ALTER TABLE payment_options ADD COLUMN IF NOT EXISTS tin_number VARCHAR(60) DEFAULT \'' + '\'');
        await db.execute('ALTER TABLE payment_options ADD COLUMN IF NOT EXISTS ebm_number VARCHAR(60) DEFAULT \'' + '\'');
    }

    static normalize(input = {}) {
        return {
            bank_bk_account: String(input.bank_bk_account || '').trim(),
            bank_equity_account: String(input.bank_equity_account || '').trim(),
            mobile_mtn_number: String(input.mobile_mtn_number || '').trim(),
            mobile_airtel_number: String(input.mobile_airtel_number || '').trim(),
            tin_number: String(input.tin_number || '').trim(),
            ebm_number: String(input.ebm_number || '').trim(),
            reference_prefix: String(input.reference_prefix || DEFAULT_OPTIONS.reference_prefix).trim().toUpperCase().slice(0, 20) || DEFAULT_OPTIONS.reference_prefix,
            notes: String(input.notes || '').trim()
        };
    }

    static async getCurrent() {
        await this.ensureTable();
        const [rows] = await db.execute('SELECT * FROM payment_options ORDER BY id DESC LIMIT 1');
        if (!rows[0]) {
            return { ...DEFAULT_OPTIONS };
        }

        const row = rows[0];
        return {
            bank_bk_account: row.bank_bk_account || '',
            bank_equity_account: row.bank_equity_account || '',
            mobile_mtn_number: row.mobile_mtn_number || '',
            mobile_airtel_number: row.mobile_airtel_number || '',
            tin_number: row.tin_number || '',
            ebm_number: row.ebm_number || '',
            reference_prefix: row.reference_prefix || DEFAULT_OPTIONS.reference_prefix,
            notes: row.notes || '',
            updated_at: row.updated_at,
            updated_by: row.updated_by || null
        };
    }

    static async upsert(options = {}, updatedBy = null) {
        await this.ensureTable();
        const normalized = this.normalize(options);
        const [rows] = await db.execute('SELECT id FROM payment_options ORDER BY id DESC LIMIT 1');

        if (rows[0]?.id) {
            await db.execute(
                `UPDATE payment_options
                 SET bank_bk_account = ?, bank_equity_account = ?, mobile_mtn_number = ?, mobile_airtel_number = ?,
                     tin_number = ?, ebm_number = ?, reference_prefix = ?, notes = ?, updated_by = ?
                 WHERE id = ?`,
                [
                    normalized.bank_bk_account,
                    normalized.bank_equity_account,
                    normalized.mobile_mtn_number,
                    normalized.mobile_airtel_number,
                    normalized.tin_number,
                    normalized.ebm_number,
                    normalized.reference_prefix,
                    normalized.notes,
                    updatedBy,
                    rows[0].id
                ]
            );
        } else {
            await db.execute(
                `INSERT INTO payment_options
                 (bank_bk_account, bank_equity_account, mobile_mtn_number, mobile_airtel_number, tin_number, ebm_number, reference_prefix, notes, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    normalized.bank_bk_account,
                    normalized.bank_equity_account,
                    normalized.mobile_mtn_number,
                    normalized.mobile_airtel_number,
                    normalized.tin_number,
                    normalized.ebm_number,
                    normalized.reference_prefix,
                    normalized.notes,
                    updatedBy
                ]
            );
        }

        return this.getCurrent();
    }
}

module.exports = PaymentOption;
