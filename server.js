require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

async function autoSetup() {
  try {
    const [tables] = await db.query("SHOW TABLES LIKE 'users'");
    if (tables.length > 0) return;

    console.log('Setting up database...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL, role ENUM('customer','admin') DEFAULT 'customer', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, description TEXT
      );
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(200) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL,
        category_id INT, stock INT DEFAULT 0, image VARCHAR(500) DEFAULT '/images/placeholder.png',
        featured TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS cart (
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, product_id INT NOT NULL, quantity INT DEFAULT 1,
        UNIQUE KEY unique_cart_item (user_id, product_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, total DECIMAL(10,2) NOT NULL, shipping_address TEXT NOT NULL,
        phone VARCHAR(20), status ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
        payment_method ENUM('delivery','paystack') DEFAULT 'delivery', payment_ref VARCHAR(100),
        payment_status ENUM('pending','success','failed') DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL, product_id INT NOT NULL,
        quantity INT NOT NULL, price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) NOT NULL,
        subject VARCHAR(200) NOT NULL, message TEXT NOT NULL, is_read TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL, used TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    console.log('Seeding data...');
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('password123', 10);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Admin', 'admin@handelluxe.com', adminHash, 'admin']);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Kwame Mensah', 'kwame@test.com', userHash, 'customer']);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Akosua Owusu', 'akosua@test.com', userHash, 'customer']);

    await db.query('INSERT INTO categories (name, description) VALUES (?, ?), (?, ?), (?, ?), (?, ?), (?, ?)',
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
      await db.query('INSERT INTO products (name, description, price, category_id, stock, image, featured) VALUES (?, ?, ?, ?, ?, ?, ?)', p);
    }
    console.log('Database seeded!');
  } catch (err) {
    console.error('Auto-setup error:', err.message);
  }
}

app.post('/api/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const crypto = require('crypto');
    const paystackConfig = require('./config/paystack');
    const hash = crypto.createHmac('sha512', paystackConfig.secretKey).update(req.body).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) return res.sendStatus(400);
    const event = JSON.parse(req.body);
    const reference = event.data?.reference;
    if (!reference) return res.sendStatus(200);

    if (event.event === 'charge.success') {
      const [existing] = await db.query('SELECT payment_status FROM orders WHERE payment_ref = ?', [reference]);
      if (existing.length > 0 && existing[0].payment_status !== 'success') {
        await db.query('UPDATE orders SET payment_status = ? WHERE payment_ref = ?', ['success', reference]);
      }
    } else if (event.event === 'charge.failed' || event.event === 'charge.abandoned') {
      const [existing] = await db.query('SELECT payment_status, id FROM orders WHERE payment_ref = ?', [reference]);
      if (existing.length > 0 && existing[0].payment_status === 'pending') {
        await db.query('UPDATE orders SET payment_status = ? WHERE payment_ref = ?', ['failed', reference]);
        const [items] = await db.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [existing[0].id]);
        for (const item of items) {
          await db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }
    }
    res.sendStatus(200);
  } catch (err) { res.sendStatus(200); }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'ecommerce-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/payments', require('./routes/payments'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views/index.html')));
app.get('/products', (req, res) => res.sendFile(path.join(__dirname, 'views/products.html')));
app.get('/product/:id', (req, res) => res.sendFile(path.join(__dirname, 'views/product-detail.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'views/cart.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'views/checkout.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views/register.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'views/forgot-password.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'views/reset-password.html')));
app.get('/orders', (req, res) => res.sendFile(path.join(__dirname, 'views/orders.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'views/admin.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'views/about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'views/contact.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'views/privacy.html')));
app.get('/payment/verify', (req, res) => res.sendFile(path.join(__dirname, 'views/payment-verify.html')));

app.get('/api/setup', async (req, res) => {
  try {
    await autoSetup();
    res.json({ success: true, message: 'Setup complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  autoSetup();
});
