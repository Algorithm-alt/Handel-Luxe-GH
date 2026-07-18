require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
