INSERT INTO categories (name, description) VALUES
("Men's Perfumes", "Signature fragrances crafted for the modern gentleman"),
("Women's Perfumes", "Elegant scents that define femininity and grace"),
("Unisex Fragrances", "Bold scents that transcend gender boundaries"),
("Body Mists", "Light and refreshing everyday fragrances"),
("Gift Sets", "Curated collections for that perfect gift"),
("Perfume Accessories", "Travel cases, atomizers and care kits");

INSERT INTO products (name, description, price, category_id, stock, image, featured) VALUES
("Bleu de Chanel", "Woody aromatic fragrance with citrus and mint notes", 850.00, 1, 20, "/images/placeholder.png", 1),
("Dior Sauvage", "Fresh spicy fragrance with bergamot and pepper", 780.00, 1, 25, "/images/placeholder.png", 1),
("Yves Saint Laurent Y", "Aromatic fougere with apple and ginger", 720.00, 1, 18, "/images/placeholder.png", 0),
("Versace Eros", "Fresh mint and green apple with vanilla", 690.00, 1, 22, "/images/placeholder.png", 1),
("Chanel No. 5", "The iconic floral aldehyde fragrance for women", 950.00, 2, 15, "/images/placeholder.png", 1),
("Miss Dior Blooming Bouquet", "Peony and rose with white musk", 780.00, 2, 20, "/images/placeholder.png", 1),
("Lancome La Vie Est Belle", "Iris and praline with vanilla", 720.00, 2, 18, "/images/placeholder.png", 0),
("Gucci Bloom", "Tuberose and jasmine with natural cotton", 680.00, 2, 22, "/images/placeholder.png", 0),
("CK One", "Fresh citrus and green tea unisex classic", 350.00, 3, 30, "/images/placeholder.png", 0),
("Jo Malone Wood Sage", "Ambrette and sea salt for a natural feel", 580.00, 3, 15, "/images/placeholder.png", 1),
("Tom Ford Ombré Leather", "Rich leather with jasmine and patchouli", 890.00, 3, 12, "/images/placeholder.png", 0),
("Nike Body Mist for Him", "Cool and refreshing everyday body mist", 85.00, 4, 45, "/images/placeholder.png", 0),
("Bath & Body Works Mist", "Sweet vanilla and sandalwood body mist", 95.00, 4, 40, "/images/placeholder.png", 0),
("Adidas Active Bodies", "Sporty fresh body spray for active lifestyles", 65.00, 4, 50, "/images/placeholder.png", 0),
("Dior Gift Set (3pc)", "Mini Sauvage, Eros & Bleu de Chanel", 1200.00, 5, 10, "/images/placeholder.png", 1),
("Chanel Discovery Set", "5 x 1.5ml samples of iconic Chanel scents", 450.00, 5, 20, "/images/placeholder.png", 0),
("YSL Gift Collection", "Y Eau de Parfum 50ml + Body Lotion", 980.00, 5, 12, "/images/placeholder.png", 1),
("Travel Atomizer 10ml", "Refillable glass perfume atomizer for travel", 45.00, 6, 60, "/images/placeholder.png", 0),
("Perfume Travel Case", "Protective leather case fits 2 bottles", 120.00, 6, 30, "/images/placeholder.png", 0),
("Fragrance Sampler Pack", "Mix and match 10 sample vials of your choice", 150.00, 6, 25, "/images/placeholder.png", 1);
