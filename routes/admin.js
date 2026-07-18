const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'));
  }
});

const adminAuth = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [users] = await db.query('SELECT COUNT(*) as count FROM users');
    const [products] = await db.query('SELECT COUNT(*) as count FROM products');
    const [orders] = await db.query('SELECT COUNT(*) as count FROM orders');
    const [revenue] = await db.query('SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status != "cancelled"');
    const [pendingPayments] = await db.query('SELECT COUNT(*) as count FROM orders WHERE payment_method = "paystack" AND payment_status = "pending"');
    const [totalStock] = await db.query('SELECT COALESCE(SUM(stock), 0) as total FROM products');
    res.json({
      users: users[0].count,
      products: products[0].count,
      orders: orders[0].count,
      revenue: revenue[0].total,
      pending_payments: pendingPayments[0].count,
      total_stock: totalStock[0].total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/orders/:id/payment', adminAuth, async (req, res) => {
  try {
    const { payment_status } = req.body;
    await db.query('UPDATE orders SET payment_status = ? WHERE id = ?', [payment_status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category_id, stock, featured } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : (req.body.image_url || '/images/placeholder.png');
    const [result] = await db.query(
      'INSERT INTO products (name, description, price, category_id, stock, image, featured) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description, price, category_id || null, stock || 0, image, featured ? 1 : 0]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category_id, stock, image_url, featured } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : (image_url || req.body.image);
    await db.query(
      'UPDATE products SET name=?, description=?, price=?, category_id=?, stock=?, image=?, featured=? WHERE id=?',
      [name, description, price, category_id || null, stock, image, featured ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id/stock', adminAuth, async (req, res) => {
  try {
    const { stock } = req.body;
    const qty = parseInt(stock, 10);
    if (isNaN(qty) || qty < 0) return res.status(400).json({ error: 'Invalid stock value' });
    await db.query('UPDATE products SET stock = ? WHERE id = ?', [qty, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/products/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all-products', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/profile', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.session.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', adminAuth, async (req, res) => {
  try {
    const { name, email, current_password, new_password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    if (new_password) {
      if (!current_password) return res.status(400).json({ error: 'Current password required to set new password' });
      const bcrypt = require('bcryptjs');
      const valid = await bcrypt.compare(current_password, rows[0].password);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      const hash = await bcrypt.hash(new_password, 10);
      await db.query('UPDATE users SET name=?, email=?, password=? WHERE id=?', [name, email, hash, req.session.user.id]);
    } else {
      await db.query('UPDATE users SET name=?, email=? WHERE id=?', [name, email, req.session.user.id]);
    }

    req.session.user.name = name;
    req.session.user.email = email;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/messages', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM messages ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/messages/:id/read', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE messages SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/messages/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM messages WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count FROM categories c ORDER BY c.name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', adminAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const [result] = await db.query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || null]);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Category name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/categories/:id', adminAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    await db.query('UPDATE categories SET name=?, description=? WHERE id=?', [name, description || null, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Category name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/categories/:id', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE products SET category_id = NULL WHERE category_id = ?', [req.params.id]);
    await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['customer', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.session.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders/:id', adminAuth, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?`,
      [req.params.id]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const [items] = await db.query(
      `SELECT oi.*, p.name, p.image FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
      [req.params.id]
    );
    res.json({ ...orders[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
