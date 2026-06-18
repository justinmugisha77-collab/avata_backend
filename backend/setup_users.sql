-- Create users table with role field
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  reset_password_token VARCHAR(255) NULL,
  reset_password_expires DATETIME NULL,
  role ENUM('customer', 'admin', 'owner') DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert admin user
-- Email: admin@avatatrading.com
-- Password: Admin@123
INSERT INTO users (full_name, phone, email, password, role) VALUES
('Admin User', '+250788000001', 'admin@avatatrading.com', 'Admin@123', 'admin')
ON DUPLICATE KEY UPDATE role = 'admin';

-- Insert owner user  
-- Email: owner@avatatrading.com
-- Password: Owner@123
INSERT INTO users (full_name, phone, email, password, role) VALUES
('Owner User', '+250788000002', 'owner@avatatrading.com', 'Owner@123', 'owner')
ON DUPLICATE KEY UPDATE role = 'owner';

-- Insert a regular customer for testing
INSERT INTO users (full_name, phone, email, password, role) VALUES
('Test Customer', '+250788000003', 'customer@test.com', 'Customer@123', 'customer')
ON DUPLICATE KEY UPDATE role = 'customer';

-- Display created users
SELECT id, full_name, email, role FROM users WHERE role IN ('admin', 'owner', 'customer');
