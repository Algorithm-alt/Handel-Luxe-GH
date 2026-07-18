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
    const [tables] = await db.query("SHOW TABLES LIKE 'products'");
    if (tables.length > 0) {
      const [count] = await db.query('SELECT COUNT(*) as cnt FROM products');
      if (count[0].cnt > 0) return;
    }

    console.log('Dropping old tables...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.query('DROP TABLE IF EXISTS password_resets, order_items, orders, cart, products, categories, messages, users');
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Creating tables...');
    await db.query(`CREATE TABLE users (
      id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL, role ENUM('customer','admin') DEFAULT 'customer', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.query(`CREATE TABLE categories (
      id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, description TEXT
    )`);
    await db.query(`CREATE TABLE products (
      id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(200) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL,
      category_id INT, stock INT DEFAULT 0, image VARCHAR(500) DEFAULT '/images/placeholder.png',
      featured TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`);
    await db.query(`CREATE TABLE cart (
      id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, product_id INT NOT NULL, quantity INT DEFAULT 1,
      UNIQUE KEY unique_cart_item (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);
    await db.query(`CREATE TABLE orders (
      id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, total DECIMAL(10,2) NOT NULL, shipping_address TEXT NOT NULL,
      phone VARCHAR(20), status ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
      payment_method ENUM('delivery','paystack') DEFAULT 'delivery', payment_ref VARCHAR(100),
      payment_status ENUM('pending','success','failed') DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await db.query(`CREATE TABLE order_items (
      id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL, product_id INT NOT NULL,
      quantity INT NOT NULL, price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);
    await db.query(`CREATE TABLE messages (
      id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) NOT NULL,
      subject VARCHAR(200) NOT NULL, message TEXT NOT NULL, is_read TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.query(`CREATE TABLE password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL, used TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    console.log('Seeding data...');
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('password123', 10);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Admin', 'admin@handelluxe.com', adminHash, 'admin']);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Kwame Mensah', 'kwame@test.com', userHash, 'customer']);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Akosua Owusu', 'akosua@test.com', userHash, 'customer']);

    await db.query(`INSERT INTO categories (id, name, description) VALUES
      (1, 'Men''s Fragrances', 'Signature fragrances crafted for the modern gentleman'),
      (2, 'Women''s Fragrances', 'Elegant scents that define femininity and grace'),
      (3, 'Unisex Fragrances', 'Bold scents that transcend gender boundaries'),
      (4, 'Body Mists & Sprays', 'Light and refreshing everyday fragrances'),
      (5, 'Gift Sets', 'Curated collections for that perfect gift'),
      (6, 'Deodorants & Roll-Ons', 'Reliable all-day freshness and protection')`);

    const products = [
      ['Premium Inspired 50ml Eau De Parfum Collection', 'An expansive array of premium, designer-inspired 50ml Eau De Parfums (GHc40 each) presenting a versatile spectrum of scent families ranging from rich fruity-sweet gourmands and elegant pink florals to commanding dark ouds and fresh marine aromatics.', 40.00, 3, 25, '/images/products/set1.png', 1],
      ['Premium Inspired Eau De Parfum Collection', 'An expansive collection of designer-inspired 100ml Eau De Parfums (GHc40 each) featuring a broad spectrum of premium fragrance families ranging from icy fresh aquatics and crisp citruses to warm exotic ouds and cozy coffee gourmands.', 40.00, 3, 25, '/images/products/set.png', 1],
      ['Touch by Gandour Concentrated Fragrance Series', 'The pocket-sized Gandour Touch Series features the Yellow Edition, Pink Edition, and Red Edition - a collection of concentrated, alcohol-free perfumes offering an array of crisp, sweet floral, and warm spicy profiles.', 10.00, 3, 30, '/images/products/touch.jpg', 0],
      ['Lattafa Pride Luxury Discovery Gift Set', 'An opulent Lattafa Pride Discovery Gift Set featuring five premium, travel-friendly Eau De Parfum bottles that showcase a versatile spectrum of rich gourmands, fresh aquatics, luxurious florals, dark leathers, and smooth woody notes.', 320.00, 5, 10, '/images/products/gift.jpg', 1],
      ['Zara Man Eau De Parfum', 'A powerful Zara Man Eau De Parfum (100ml) offering an intense, long-lasting fragrance profile of crisp citrus, warm spices, and deep woody amber for ultimate masculine confidence and alluring charm.', 140.00, 1, 20, '/images/products/zara.jpg', 1],
      ['Oniro Eau De Parfum', 'An invigorating Oniro Eau De Parfum (100ml) offering a fresh, long-lasting fragrance profile of crisp marine notes, vibrant citrus, and deep woody amber for ultimate daily confidence and energetic charm.', 140.00, 1, 20, '/images/products/oniro.jpg', 1],
      ['Extremely Unique Pista Eau De Parfum', 'A delightfully indulgent Extremely Unique Pista Eau De Parfum offering a rich, long-lasting gourmand fragrance profile of creamy roasted pistachio, sweet vanilla, and smooth almond.', 140.00, 3, 15, '/images/products/uniqu1.jpg', 1],
      ['Fragrance Avenue Suger Fragrance Series', 'The vibrant Fragrance Avenue Suger Series brings together Suger Candy, Suger Pink Intense, Suger Blend, and Suger White - a chic, color-coded collection of custom-made designer perfumes.', 160.00, 3, 20, '/images/products/sugar.jpg', 1],
      ['Lattafa Badee Al Oud Prestige Series', 'The majestic Lattafa Badee Al Oud Series (100ml Eau De Parfum) brings together Oud For Glory (Matte Black) and Amethyst (Matte Purple) - two high-performance, long-lasting unisex fragrances.', 280.00, 3, 15, '/images/products/badee.png', 1],
      ['La Maison Du Parfum Rococo Eau De Parfum', 'An opulent La Maison Du Parfum Rococo Eau De Parfum offering a rich, long-lasting unisex fragrance profile of warm exotic spices, deep precious woods, and luxurious gold-standard amber.', 140.00, 3, 18, '/images/products/rococo.jpg', 1],
      ['Perfumers Choice by Milton-Lloyd Luxury Fragrance Series', 'An opulent array of Perfumers Choice Eau De Parfums (83ml each) delivering high-concentration, long-lasting luxury fragrance profiles across a premium spectrum of fresh florals, rich spices, smoky woods, and exotic oud.', 130.00, 3, 20, '/images/products/perfumers-choice.jpg', 1],
      ['Savage Elixir Series (Prince Dior)', 'Savage Elixir Pure Red: A bold, fiery blend featuring cinnamon, nutmeg, cardamom, lavender, and smoky vetiver. Savage Elixir Green: An ultra-modern, crisp interpretation with wild mint, grapefruit, and cedarwood.', 140.00, 1, 18, '/images/products/savage.jpg', 1],
      ['Proud Of You Tobacco Eau De Parfum', 'An indulgent Proud Of You Tobacco Eau De Parfum offering a rich, long-lasting fragrance profile of warm spices, premium tobacco accords, and sweet amber vanilla.', 140.00, 1, 15, '/images/products/proud.jpg', 0],
      ['Bodycology Fragrance Mist Assortment', 'A vibrant array of Bodycology Fragrance Mists (237ml each) offering sweet gourmand, rich fruit, and fresh floral scents including Pure White Gardenia, Whipped Vanilla, Beach Berries, and Strawberry Cheesecake.', 70.00, 2, 25, '/images/products/splash.jpg', 0],
      ['Lattafa Khamrah Qahwa Eau De Parfum', 'An indulgent Lattafa Khamrah Qahwa Eau De Parfum offering a rich, long-lasting gourmand fragrance profile of warm cinnamon, roasted Arabic coffee, and sweet praline.', 450.00, 1, 8, '/images/products/khamrah-lattafa.jpg', 1],
      ['Fragrance World Lush Cherry Eau De Parfum', 'A seductive Fragrance World Lush Cherry Eau De Parfum (50ml) offering a rich, long-lasting sweet profile of dark cherry liqueur, bitter almond, and warm tonka bean.', 40.00, 2, 20, '/images/products/cherry.jpg', 0],
      ['Fragrance World Fiero Bleu Man Eau De Parfum', 'A magnetic Fragrance World Fiero Bleu Man Eau De Parfum (50ml) offering a fresh, long-lasting masculine fragrance profile of crisp citrus, aromatic lavender, and rich woody amber.', 40.00, 1, 22, '/images/products/fiero.jpg', 0],
      ['Smart Collection 15ml Pocket Perfume Series', 'This collection features sleek 15ml tear-drop shaped glass bottles with unique numbered labeling, each recreating a high-end designer scent profile. Perfect for travelers and fragrance enthusiasts.', 20.00, 2, 30, '/images/products/smart-collection.jpg', 0],
      ['Fragrance World Berry Weekend Perfumed Body Spray', 'An enchanting Fragrance World Berry Weekend Perfumed Body Spray (200ml) offering a fresh, long-lasting profile of sweet wild berries, soft florals, and clean musk.', 35.00, 2, 25, '/images/products/berry-weekend-body-spray.jpg', 0],
      ['Fragrance World Kaly Oudh Eau De Parfum', 'An opulent Fragrance World Kaly Oudh Eau De Parfum (50ml) offering a rich, long-lasting unisex fragrance profile of exotic saffron, dark agarwood (oud), and warm resinous amber.', 140.00, 3, 15, '/images/products/kaly.jpg', 1],
      ['Fragrance World Pegasus Pour Homme Eau De Parfum', 'An opulent Fragrance World Pegasus Pour Homme Eau De Parfum (50ml) offering a rich, long-lasting masculine fragrance profile of unique bitter almond, elegant lavender, and warm, creamy vanilla.', 40.00, 1, 20, '/images/products/pegasus.jpg', 0],
      ['Fragrance World Just Azraq Eau De Parfum', 'An exquisite Fragrance World Just Azraq Eau De Parfum (50ml) offering a fresh, long-lasting unisex fragrance profile of crisp marine notes, aromatic lavender, and smooth cedar-amber.', 40.00, 3, 20, '/images/products/just.jpg', 0],
      ['Fragrance World Toomford Pour Homme Eau De Parfum', 'An opulent Fragrance World Toomford Pour Homme Eau De Parfum (50ml) offering a rich, long-lasting masculine fragrance profile of exotic cardamon, precious agarwood (oud), and warm amber-vanilla.', 40.00, 1, 20, '/images/products/toomford.jpg', 0],
      ['Fragrance World Cocktail Intense Eau De Parfum', 'An opulent Fragrance World Cocktail Intense Eau De Parfum (50ml) offering a rich, long-lasting unisex fragrance profile of warm cognac, sweet cinnamon-tonka, and decadent praline-vanilla.', 40.00, 3, 18, '/images/products/cocktail.jpg', 0],
      ['Fragrance World Barakkat Rouge 540 Extrait De Parfum', 'An opulent Fragrance World Barakkat Rouge 540 Extrait De Parfum (50ml) offering an intense, long-lasting unisex fragrance profile of rich saffron, bitter almond, and precious ambergris-woods.', 40.00, 3, 20, '/images/products/barakkat2.jpg', 1],
      ['Fragrance World Barakkat Satin Oud Eau De Parfum', 'An opulent Fragrance World Barakkat Satin Oud Eau De Parfum (50ml) offering a rich, long-lasting unisex fragrance profile of romantic roses, powdery violet, dark agarwood, and warm vanilla.', 40.00, 3, 20, '/images/products/barakkat1.jpg', 1],
      ['Fragrance World La Vida Es Bella Eau De Parfum', 'An enchanting Fragrance World La Vida Es Bella Eau De Parfum (50ml) offering a rich, long-lasting feminine fragrance profile of sweet pear, precious iris, and warm praline-vanilla.', 40.00, 2, 18, '/images/products/la-vida.jpg', 0],
      ['Fragrance World Bad Lad Pour Homme Eau De Parfum', 'An exceptional Fragrance World Bad Lad Pour Homme Eau De Parfum (50ml) offering an intense, long-lasting masculine fragrance profile of sharp peppers, dark cacao, and warm tonka bean.', 40.00, 1, 20, '/images/products/bad-lad.jpg', 0],
      ['Fragrance World Rose Seduction Secret Eau De Parfum', 'An enchanting Fragrance World Rose Seduction Secret Eau De Parfum (50ml) offering a sweet, long-lasting feminine fragrance profile of fresh passion fruit, romantic peony, and soft vanilla orchid.', 40.00, 2, 18, '/images/products/rose-seduction.jpg', 0],
      ['Fragrance World Black Leather Men Eau De Parfum', 'An exquisite Fragrance World Black Leather Men Eau De Parfum (50ml) offering a rich, long-lasting masculine fragrance profile of smoky birch, fresh pineapple, and deep oakmoss.', 40.00, 1, 20, '/images/products/black-leather.jpg', 0],
      ['Fragrance World Intense Peach Eau De Parfum', 'An exquisite Fragrance World Intense Peach Eau De Parfum (50ml) offering a rich, long-lasting unisex fragrance profile of velvety peach, warm boozy notes, and deep patchouli-woods.', 40.00, 3, 18, '/images/products/intense-peach.jpg', 0],
      ['Belle Celine Scandant Women Le Parfum', 'An exquisite Belle Celine Scandant Women Le Parfum (50ml) offering a rich, long-lasting feminine fragrance profile of vibrant citruses, creamy honey, and warm caramel.', 40.00, 2, 18, '/images/products/scandant.jpg', 0],
      ['Yara Tous Eau De Parfum (35ml Mini Spray) Collection', 'An exquisite Yara Tous Eau De Parfum (35ml Mini Spray) offering a luscious, long-lasting tropical fragrance profile of sweet mango, coconut, and smooth vanilla.', 10.00, 2, 30, '/images/products/mini.jpg', 0],
      ['Efolia Oud For Nights Eau De Parfum', 'An opulent Efolia Oud For Nights Eau De Parfum (100ml) offering a rich, long-lasting oriental fragrance profile of precious agarwood, warm spices, and deep amber.', 220.00, 3, 12, '/images/products/oud-for-night.jpg', 1],
      ['Efolia After 12 Pour Homme Eau De Parfum', 'An exquisite Efolia After 12 Pour Homme Eau De Parfum (100ml) offering a rich, long-lasting masculine fragrance profile of fresh spices, warm aromatics, and deep woods.', 160.00, 1, 15, '/images/products/after-12.jpg', 1],
      ['Ramz Lattafa (Silver/Black Edition) Eau De Parfum', 'An exquisite Ramz Lattafa Eau De Parfum (100ml) offering a rich, long-lasting masculine fragrance profile of fresh fruits, aromatic lavender, and warm vanilla.', 230.00, 1, 12, '/images/products/ramz-lattafa1.jpg', 1],
      ['Ramz Lattafa (Gold/Red Edition) Eau De Parfum', 'An exquisite Ramz Lattafa Eau De Parfum (100ml) offering a rich, long-lasting fragrance profile of sweet fruits, warm vanilla, and smooth amber.', 230.00, 3, 12, '/images/products/ramz-lattafa.jpg', 1],
      ['Invicto Victorious Elixir Eau De Parfum', 'An opulent Invicto Victorious Elixir Eau De Parfum (100ml) offering an intense, long-lasting masculine fragrance profile of aromatics, rich spices, and smooth amber-woods.', 140.00, 1, 18, '/images/products/invicto.jpg', 1],
      ['Suave Eau De Parfum (100ml)', 'An exquisite Suave Eau De Parfum (100ml) offering a rich, long-lasting masculine fragrance profile of fresh citrus, sharp spices, and deep woody notes, featuring a bonus free deodorant spray.', 140.00, 1, 18, '/images/products/suave.jpg', 0],
      ['Aventos Blue For Him Eau De Parfum (100ml)', 'An exquisite Aventos Blue For Him Eau De Parfum (100ml) offering a refreshing, long-lasting masculine fragrance profile of crisp citrus, marine accords, and subtle woods.', 140.00, 1, 20, '/images/products/aventos.jpg', 1],
      ['Aventos Advance Eau De Parfum Collection', 'A magnificent collection of four distinct Aventos Advance Eau De Parfums (50ml each) offering an elite range of long-lasting, luxurious fragrances for ultimate daily sophistication.', 60.00, 3, 15, '/images/products/aventos-for-all.jpg', 0],
      ['Aventos Blue For Him Eau De Parfum (50ml)', 'An exquisite Aventos Blue For Him Eau De Parfum (50ml) offering a refreshing, long-lasting masculine fragrance profile of crisp citrus, marine accords, and subtle woods.', 40.00, 1, 20, '/images/products/aventos1.jpg', 0],
      ['Lattafa Hayaati Eau De Parfum', 'A high-energy, sweet, and clean fragrance that smells like an upscale fruity shower gel. It hits you with a juicy burst of fresh apples and citrus, smoothly warming into cinnamon and vanilla.', 160.00, 3, 15, '/images/products/hayaati.jpg', 1],
      ['Matelot Eau De Parfum', 'An evocative Matelot Eau De Parfum offering a refreshing, long-lasting maritime fragrance profile of citrus, ocean spray, and subtle musk, presented with a signature nautical pouch.', 140.00, 3, 15, '/images/products/matelot.jpg', 0],
      ['Lattafa Badee Al Oud Amethyst Eau De Parfum', 'An opulent Lattafa Badee Al Oud Amethyst Eau De Parfum offering a rich, prestigious, and deeply luxurious fragrance profile for an all-day aura of elite elegance and confidence.', 280.00, 3, 10, '/images/products/amethyst.jpg', 1],
      ['Mousuf Eau De Parfum', 'A stunning collection of Mousuf Eau De Parfums featuring three distinct, long-lasting fragrances presented with custom, elegant woven gift pouches.', 180.00, 3, 12, '/images/products/mousuf.jpg', 1],
      ['Extremely Unique Eau De Parfum', 'An exquisite Extremely Unique Eau De Parfum (100ml) offering a rich, captivating, and deeply luxurious fragrance profile for an all-day aura of distinctive elegance.', 140.00, 3, 18, '/images/products/unique.jpg', 0],
      ['Maison Barakkat Rouge 540 Extrait De Parfum', 'An opulent and intensely mesmerizing Maison Barakkat Rouge 540 Extrait De Parfum offering an ultra-premium, long-lasting, and deeply luxurious fragrance profile.', 140.00, 3, 18, '/images/products/barakkat.jpg', 1],
      ['Berries Weekend Pink Edition Eau De Parfum', 'An exquisite Berries Weekend Pink Edition Eau De Parfum (100ml) offering a sweet, vibrant, and deeply luxurious fragrance profile for an all-day aura of playful elegance.', 140.00, 2, 15, '/images/products/berry-weekend.jpg', 0],
      ['Ophylia Eau De Parfum', 'An exquisite Ophylia Eau De Parfum featuring a premium, long-lasting feminine fragrance with green mandarin, water jasmine, creamy vanilla, sea salt, and cashmere wood. Includes bonus free deodorant spray.', 140.00, 2, 15, '/images/products/ophylia.jpg', 0],
      ['Montera Rouge Tobacco Eau De Parfum', 'An opulent and intensely captivating Montera Rouge Tobacco Eau De Parfum (100ml) offering a rich, warm, and deeply luxurious fragrance profile for ultimate daily confidence.', 140.00, 3, 15, '/images/products/tobacco.jpg', 0],
      ['BCC Country Road Roll-On', 'A classic BCC Country Road roll-on deodorant delivering up to 48 hours of reliable anti-perspirant protection and crisp freshness.', 16.00, 6, 40, '/images/products/roll-on2.jpeg', 0],
      ['Power House Tungsten Strength Roll-On', 'An athletic-grade Power House Tungsten Strength roll-on deodorant providing up to 48 hours of targeted odor control and high-endurance sweat protection.', 23.00, 6, 35, '/images/products/roll-on3.jpeg', 0],
      ['My Dollar Roll-On', 'A uniquely styled My Dollar roll-on deodorant providing up to 48 hours of reliable anti-perspirant protection and long-lasting freshness.', 16.00, 6, 40, '/images/products/roll-on.jpeg', 0],
      ['Rexona Roll-On', 'A high-performance collection of Rexona roll-on deodorants offering up to 72 hours of advanced sweat and odor protection.', 25.00, 6, 40, '/images/products/rexona-roll-on.jpg', 0],
      ['Dove Roll-On', 'A nourishing collection of Dove roll-on deodorants offering up to 48-hour sweat and odor protection, infused with moisturizing care.', 25.00, 6, 40, '/images/products/roll-on1.jpeg', 0],
      ['Sure Men Deodorant Spray', 'A powerful collection of Sure Men body sprays delivering up to 48 hours of heavy-duty, quick-drying anti-perspirant protection for active men.', 40.00, 6, 25, '/images/products/rexona.jpeg', 0],
      ['Nivea Deodorant Spray', 'An essential collection of Nivea body sprays delivering up to 48 hours of reliable, quick-drying anti-perspirant protection tailored for long-lasting daily freshness.', 55.00, 6, 30, '/images/products/nivea.jpeg', 0],
      ['Nivea Roll-On', 'A versatile collection of Nivea roll-on deodorants offering up to 48-hour sweat and odor protection, tailored to deliver specialized skin care.', 25.00, 6, 35, '/images/products/nivea-roll-on.jpg', 0],
      ['Rexona Deodorant', 'A premium collection of high-performance Rexona body sprays providing up to 72 hours of advanced motion-activated sweat and odor protection.', 35.00, 6, 30, '/images/products/rexona.jpeg', 0],
      ['Dove Deodorant Spray', 'The ultimate clean aesthetic in a bottle. It smells like pure, velvety lotion, crisp white soap, and freshly laundered linens - comforting, subtle, and universally pleasant.', 37.00, 6, 30, '/images/products/dove.jpeg', 0],
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
