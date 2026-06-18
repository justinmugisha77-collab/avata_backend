CREATE TABLE IF NOT EXISTS payment_options (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bank_bk_account VARCHAR(120) DEFAULT '',
    bank_equity_account VARCHAR(120) DEFAULT '',
    mobile_mtn_number VARCHAR(60) DEFAULT '',
    mobile_airtel_number VARCHAR(60) DEFAULT '',
    reference_prefix VARCHAR(20) DEFAULT 'PAY',
    notes TEXT,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
