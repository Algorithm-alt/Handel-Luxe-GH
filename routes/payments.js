const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/db');
const paystack = require('../config/paystack');

const auth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Login required' });
  next();
};

router.get('/config', auth, (req, res) => {
  res.json({ publicKey: paystack.publicKey });
});

router.post('/initialize', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { shipping_address, phone } = req.body;
    const [cartItems] = await conn.query(
      `SELECT c.*, p.price, p.stock, p.name FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`,
      [req.session.user.id]
    );
    if (cartItems.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cart is empty' });
    }

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await conn.rollback();
        return res.status(400).json({ error: `Insufficient stock for ${item.name}` });
      }
    }

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const reference = 'HLX_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex');

    const [orderResult] = await conn.query(
      'INSERT INTO orders (user_id, total, shipping_address, phone, status, payment_method, payment_ref, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.session.user.id, total, shipping_address, phone, 'pending', 'paystack', reference, 'pending']
    );
    const orderId = orderResult.insertId;

    for (const item of cartItems) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    await conn.commit();

    try {
      const response = await axios.post(
        `${paystack.baseUrl}/transaction/initialize`,
        {
          email: req.session.user.email,
          amount: Math.round(total * 100),
          reference,
          callback_url: `${req.protocol}://${req.get('host')}/payment/verify`,
          metadata: {
            order_id: orderId,
            user_id: req.session.user.id,
            custom_fields: [
              { display_name: 'Order ID', variable_name: 'order_id', value: orderId }
            ]
          }
        },
        { headers: { Authorization: `Bearer ${paystack.secretKey}`, 'Content-Type': 'application/json' } }
      );

      await conn.query('DELETE FROM cart WHERE user_id = ?', [req.session.user.id]);
      res.json({
        success: true,
        order_id: orderId,
        reference,
        access_code: response.data.data.access_code,
        total
      });
    } catch (paystackErr) {
      await conn.query('DELETE FROM orders WHERE id = ?', [orderId]);
      for (const item of cartItems) {
        await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
      res.status(500).json({ error: 'Payment initialization failed. Please try again.' });
    }
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.get('/verify', auth, async (req, res) => {
  const { reference } = req.query;
  if (!reference) return res.status(400).json({ error: 'No reference provided' });

  try {
    const response = await axios.get(
      `${paystack.baseUrl}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${paystack.secretKey}` } }
    );

    const { data } = response.data;
    if (data.status === 'success') {
      const [existing] = await db.query('SELECT payment_status FROM orders WHERE payment_ref = ?', [reference]);
      if (existing.length > 0 && existing[0].payment_status !== 'success') {
        await db.query('UPDATE orders SET payment_status = ? WHERE payment_ref = ?', ['success', reference]);
      }
      return res.json({ success: true, status: 'success', order_id: data.metadata?.order_id });
    } else {
      const [existing] = await db.query('SELECT payment_status, id FROM orders WHERE payment_ref = ?', [reference]);
      if (existing.length > 0 && existing[0].payment_status !== 'failed') {
        await db.query('UPDATE orders SET payment_status = ? WHERE payment_ref = ?', ['failed', reference]);
        const [items] = await db.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [existing[0].id]);
        for (const item of items) {
          await db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }
      return res.json({ success: false, status: data.status });
    }
  } catch (err) {
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

router.get('/status/:orderId', auth, async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT payment_status, payment_ref FROM orders WHERE id = ? AND user_id = ?',
      [req.params.orderId, req.session.user.id]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(orders[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
