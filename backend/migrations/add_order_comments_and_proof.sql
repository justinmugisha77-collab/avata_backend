-- Migration: Add order_comments table and enhance orders table
-- Run this SQL in your MySQL database

-- Add payment_proof_file column (stores actual uploaded file path)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_proof_file VARCHAR(500) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivered_at DATETIME DEFAULT NULL;

-- Update status enum to include 'delivered'
ALTER TABLE orders 
MODIFY COLUMN status ENUM('pending', 'confirmed', 'processing', 'shipped', 'sent', 'submitted', 'completed', 'cancelled', 'delivered') DEFAULT 'pending';

-- Create order_comments table
CREATE TABLE IF NOT EXISTS order_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id)
);
