-- Add images column to products table for multiple image support
-- This migration adds a JSON field to store multiple product images

ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSON COMMENT 'Array of image URLs for the product';

-- Optional: Add owner_id if it doesn't exist (for proper product ownership)
ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_id INT COMMENT 'User ID of the product owner';

-- Optional: Add category_id as foreign key if it doesn't exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INT COMMENT 'Category ID reference';
