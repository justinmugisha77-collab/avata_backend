-- Migration: Add new statuses and verified_by column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS verified_by INT DEFAULT NULL AFTER user_id;

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
    'Not_Delivered',
    'Payment_Under_Review',
    'Waiting_Proof'
) DEFAULT 'pending';

-- Map existing pending situations if necessary
UPDATE orders SET status = 'Waiting_Proof' WHERE status = 'pending' AND payment_status = 'pending';
UPDATE orders SET status = 'Payment_Under_Review' WHERE payment_status = 'awaiting_verification';
