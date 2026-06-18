-- Create categories table if not exists
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT IGNORE INTO categories (name, description) VALUES
('Dust Masks', 'Various types of dust protection masks'),
('Respirators', 'Advanced respiratory protection equipment'),
('Eye Protection', 'Safety glasses and goggles'),
('Head Protection', 'Helmets and hard hats'),
('Workwear', 'Professional safety clothing and uniforms'),
('Gloves', 'Protective gloves for various applications'),
('Hearing Protection', 'Ear plugs and ear muffs'),
('Fall Protection', 'Safety harnesses and lanyards'),
('First Aid', 'Medical supplies and first aid kits');

-- Update products table to ensure category_id exists
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_id INT AFTER owner_id,
ADD FOREIGN KEY IF NOT EXISTS (category_id) REFERENCES categories(id) ON DELETE SET NULL;
