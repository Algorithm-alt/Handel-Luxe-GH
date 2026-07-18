const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, 'customer']);
    req.session.user = { id: result.insertId, name, email, role: 'customer' };
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(400).json({ error: 'No account found with that email' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
      [rows[0].id, token, expiresAt]);

    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Password Reset - Handel Luxe GH',
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#8B6914;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${resetUrl}" style="background:#8B6914;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;">Reset Password</a>
        </div>
        <p style="color:#666;font-size:13px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
        <p style="color:#666;font-size:13px;">- Handel Luxe GH Team</p>
      </div>`
    });

    res.json({ success: true, message: 'Reset link sent to your email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });

    const [rows] = await db.query(
      'SELECT id, user_id, expires_at, used FROM password_resets WHERE token = ?', [token]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid reset token' });

    const reset = rows[0];
    if (reset.used) return res.status(400).json({ error: 'Reset token has already been used' });
    if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ error: 'Reset token has expired' });

    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, reset.user_id]);
    await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
