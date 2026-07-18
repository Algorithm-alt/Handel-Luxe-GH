require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setup() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  console.log('Creating database...');
  await conn.query('DROP DATABASE IF EXISTS ecommerce_db');
  await conn.query('CREATE DATABASE ecommerce_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await conn.query('USE ecommerce_db');

  console.log('Creating tables...');
  await conn.query(`
    CREATE TABLE users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('customer','admin') DEFAULT 'customer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      category_id INT,
      stock INT DEFAULT 0,
      image VARCHAR(500) DEFAULT '/images/placeholder.png',
      featured TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE cart (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT DEFAULT 1,
      UNIQUE KEY unique_cart_item (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      shipping_address TEXT NOT NULL,
      phone VARCHAR(20),
      status ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log('Seeding data...');
  const adminHash = await bcrypt.hash('admin123', 10);
  const userHash = await bcrypt.hash('password123', 10);

  await conn.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Admin', 'admin@handelluxe.com', adminHash, 'admin']);
  await conn.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Kwame Mensah', 'kwame@test.com', userHash, 'customer']);
  await conn.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Akosua Owusu', 'akosua@test.com', userHash, 'customer']);

  await conn.query('INSERT INTO categories (name, description) VALUES (?, ?), (?, ?), (?, ?), (?, ?), (?, ?)',
    ['Electronics', 'Phones, laptops, gadgets', 'Fashion', 'Clothing, shoes, accessories', 'Home & Kitchen', 'Furniture, appliances, decor', 'Books', 'Textbooks, novels, magazines', 'Sports', 'Fitness gear, equipment']);

  const placeholder = '/images/placeholder.png';
  const products = [
    ['Samsung Galaxy S24', 'Latest Samsung flagship smartphone with S Pen', 4500.00, 1, 25, placeholder, 1],
    ['iPhone 15 Pro', 'Apple iPhone 15 Pro with A17 chip', 5200.00, 1, 18, placeholder, 1],
    ['HP Laptop 15', '15.6 inch Intel Core i5 laptop', 3800.00, 1, 12, placeholder, 1],
    ['AirPods Pro 2', 'Apple wireless earbuds with ANC', 950.00, 1, 30, placeholder, 1],
    ['Nike Air Max', 'Comfortable running shoes', 650.00, 2, 40, placeholder, 1],
    ['Adidas T-Shirt', 'Cotton casual t-shirt', 180.00, 2, 60, placeholder, 0],
    ['Levi\'s Jeans', 'Classic blue denim jeans', 450.00, 2, 35, placeholder, 0],
    ['Blender Pro', 'High-speed kitchen blender', 350.00, 3, 20, placeholder, 0],
    ['Rice Cooker 5L', 'Digital rice cooker with timer', 280.00, 3, 15, placeholder, 1],
    ['Study Lamp', 'LED desk lamp with adjustable brightness', 120.00, 3, 45, placeholder, 0],
    ['Database Systems Textbook', 'Complete guide to database management', 250.00, 4, 50, placeholder, 0],
    ['Python Programming', 'Learn Python from scratch', 180.00, 4, 40, placeholder, 0],
    ['Introduction to AI', 'Artificial Intelligence fundamentals', 300.00, 4, 25, placeholder, 1],
    ['Football (Size 5)', 'FIFA-approved football', 150.00, 5, 30, placeholder, 0],
    ['Yoga Mat', 'Non-slip exercise yoga mat', 120.00, 5, 35, placeholder, 0],
    ['Dumbbells Set', 'Adjustable dumbbell set 5-20kg', 480.00, 5, 15, placeholder, 1],
    ['Wireless Mouse', 'Ergonomic wireless mouse', 95.00, 1, 50, placeholder, 0],
    ['Mechanical Keyboard', 'RGB backlit mechanical keyboard', 320.00, 1, 22, placeholder, 0],
    ['Casio Watch', 'Digital sports watch', 280.00, 2, 28, placeholder, 0],
    ['Desk Fan', 'Portable USB desk fan', 85.00, 3, 40, placeholder, 0],
  ];
  for (const p of products) {
    await conn.query('INSERT INTO products (name, description, price, category_id, stock, image, featured) VALUES (?, ?, ?, ?, ?, ?, ?)', p);
  }

  console.log('Setup complete!');
  console.log('Admin login: admin@handelluxe.com / admin123');
  console.log('Customer login: kwame@test.com / password123');
  await conn.end();
}

setup().catch(err => { console.error('Setup failed:', err); process.exit(1); });
