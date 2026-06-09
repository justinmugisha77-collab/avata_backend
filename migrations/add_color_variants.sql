-- Add color support to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_type VARCHAR(20) DEFAULT 'none' AFTER size_type;
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_options JSON NULL AFTER size_options;

-- Create color_size_variants table for storing combinations of colors, sizes, and prices
CREATE TABLE IF NOT EXISTS color_size_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    color VARCHAR(100) NOT NULL,
    size VARCHAR(100),
    price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_product_color_size (product_id, color, size),
    INDEX idx_product_id (product_id),
    CONSTRAINT fk_color_size_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
