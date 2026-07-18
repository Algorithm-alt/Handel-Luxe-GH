const express = require('express');
const router = express.Router();
const db = require('../config/db');

const auth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Login required' });
  next();
};

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image
       FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`,
      [req.session.user.id]
    );
    const total = rows.reduce((sum, item) => sum + item.price * item.quantity, 0);
    res.json({ items: rows, total, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/add', auth, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const qty = quantity || 1;
    const [existing] = await db.query(
      'SELECT * FROM cart WHERE user_id = ? AND product_id = ?',
      [req.session.user.id, product_id]
    );
    if (existing.length > 0) {
      await db.query('UPDATE cart SET quantity = quantity + ? WHERE id = ?', [qty, existing[0].id]);
    } else {
      await db.query('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [req.session.user.id, product_id, qty]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/update/:id', auth, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity <= 0) {
      await db.query('DELETE FROM cart WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
    } else {
      await db.query('UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?',
        [quantity, req.params.id, req.session.user.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/remove/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM cart WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clear', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM cart WHERE user_id = ?', [req.session.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
