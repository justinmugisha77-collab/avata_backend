-- Create products table in 'trade' database
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  price DECIMAL(10,2),
  description TEXT,
  image VARCHAR(500),
  stock INT DEFAULT 0
);

-- Insert 12 sample products with images
INSERT INTO products (name, category, subcategory, price, description, image, stock) VALUES
('Workwear Coverall', 'WORK WEAR', 'Coveralls', 120.00, 'Durable workwear coverall for industrial use.', 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=400&q=80', 50),
('Safety Shoes', 'FOOT PROTECTION', 'Shoes', 95.00, 'Steel toe safety shoes for construction.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80', 100),
('Hard Hat', 'HEAD PROTECTION', 'Helmets', 35.00, 'Impact-resistant hard hat for head safety.', 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80', 200),
('Dust Mask', 'DUSTMASK', 'Masks', 10.00, 'Certified dust mask for respiratory protection.', 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80', 300),
('Safety Glasses', 'EYE PROTECTION', 'Glasses', 18.00, 'Anti-fog safety glasses for eye protection.', 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=400&q=80', 150),
('Ear Muffs', 'EAR PROTECTION', 'Muffs', 22.00, 'Noise-cancelling ear muffs for hearing safety.', 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=400&q=80', 120),
('Nitrile Gloves', 'GLOVES', 'Nitrile', 15.00, 'Chemical-resistant nitrile gloves.', 'https://images.unsplash.com/photo-1465101178521-c1a9136a3b99?auto=format&fit=crop&w=400&q=80', 250),
('Fall Harness', 'FALL PROTECTION', 'Harnesses', 180.00, 'Full body fall protection harness.', 'https://images.unsplash.com/photo-1519985176271-adb1088fa94c?auto=format&fit=crop&w=400&q=80', 60),
('Fire Blanket', 'FIRE PROTECTION', 'Blankets', 45.00, 'Fire-resistant safety blanket.', 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80', 80),
('Hand Truck', 'HAND TRUCKS', 'Trucks', 210.00, 'Heavy-duty hand truck for material transport.', 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=400&q=80', 30),
('Traffic Cone', 'ROAD SAFETY', 'Cones', 25.00, 'High-visibility traffic cone.', 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80', 90),
('Spill Kit', 'SPILL KIT', 'Kits', 75.00, 'Complete spill response kit.', 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=400&q=80', 40);
