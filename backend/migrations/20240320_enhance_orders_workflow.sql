-- Migration: Enhance orders workflow with verification and new statuses
-- Run this SQL in your MySQL database

-- 1. Add verification_status column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS verification_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' AFTER payment_status;

-- 2. Update payment_status enum to include 'Paid'
ALTER TABLE orders 
MODIFY COLUMN payment_status ENUM('pending', 'awaiting_verification', 'verified', 'Paid') DEFAULT 'pending';

-- 3. Update status enum to include new workflow steps
ALTER TABLE orders 
MODIFY COLUMN status ENUM(
    'pending', 
    'confirmed', 
    'processing', 
    'shipped', 
    'sent', 
    'submitted', 
    'completed', 
    'cancelled', 
    'delivered',
    'Paid',
    'Shipped',
    'Delivered',
    'Completed',
    'Not_Delivered'
) DEFAULT 'pending';

-- 4. Add index for verification_status
CREATE INDEX idx_verification_status ON orders(verification_status);
