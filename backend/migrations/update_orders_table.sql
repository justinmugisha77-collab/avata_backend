-- Update orders table to include payment verification fields
-- Run this SQL in your MySQL database

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS items TEXT,
ADD COLUMN IF NOT EXISTS payment_status ENUM('pending', 'awaiting_verification', 'verified') DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_proof TEXT,
ADD COLUMN IF NOT EXISTS payment_receipt TEXT,
ADD COLUMN IF NOT EXISTS verified_at DATETIME;

-- Update existing status enum to include new statuses
ALTER TABLE orders 
MODIFY COLUMN status ENUM('pending', 'confirmed', 'processing', 'shipped', 'sent', 'submitted', 'completed', 'cancelled') DEFAULT 'pending';

-- Add index for faster queries
CREATE INDEX idx_payment_status ON orders(payment_status);
CREATE INDEX idx_customer_email ON orders(customer_email);
CREATE INDEX idx_payment_number ON orders(payment_number);
