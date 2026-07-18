const express = require('express');
const router = express.Router();
const db = require('../config/db');

const auth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Login required' });
  next();
};

router.post('/place', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { shipping_address, phone, payment_method } = req.body;
    const method = payment_method === 'delivery' ? 'delivery' : 'paystack';
    const [cartItems] = await conn.query(
      `SELECT c.*, p.price, p.stock, p.name FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`,
      [req.session.user.id]
    );
    if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await conn.rollback();
        return res.status(400).json({ error: `Insufficient stock for ${item.name}` });
      }
    }

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const payment_status = method === 'delivery' ? 'pending' : 'pending';
    const [orderResult] = await conn.query(
      'INSERT INTO orders (user_id, total, shipping_address, phone, status, payment_method, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.session.user.id, total, shipping_address, phone, 'pending', method, payment_status]
    );
    const orderId = orderResult.insertId;

    for (const item of cartItems) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    await conn.query('DELETE FROM cart WHERE user_id = ?', [req.session.user.id]);
    await conn.commit();
    res.json({ success: true, order_id: orderId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.user.id]
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
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
