-- Create messages table for contact/support messages
CREATE TABLE IF NOT EXISTS messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  subject VARCHAR(500),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on created_at for faster sorting
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

