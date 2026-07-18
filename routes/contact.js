const express = require('express');
const router = express.Router();
const db = require('../config/db');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    await db.query(
      'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name, email, subject, message]
    );

    const mailResult = await transporter.sendMail({
      from: `"Handel Luxe GH Website" <drdehandel@gmail.com>`,
      to: 'drdehandel@gmail.com',
      replyTo: email,
      subject: `New Contact Message: ${subject}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#2563eb;border-bottom:2px solid #2563eb;padding-bottom:10px;">New Message from Contact Form</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr style="border-color:#e2e8f0;">
          <p style="line-height:1.8;">${message}</p>
          <hr style="border-color:#e2e8f0;">
          <p style="color:#64748b;font-size:0.85rem;">Sent from Handel Luxe GH website contact form</p>
        </div>
      `
    });
    console.log('Email sent:', mailResult.messageId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
