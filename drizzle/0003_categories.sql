-- Songa Logistics migration 0003: consolidate shop categories into the four verticals
-- (food delivery, groceries & shopping, medical courier). E-commerce parcels is a
-- service, not a shop category. Idempotent: safe to re-run.
UPDATE merchants SET category = 'medical' WHERE category = 'care';
UPDATE merchants SET category = 'grocery' WHERE category IN ('retail', 'flowers');

-- Rebrand demo shops seeded before the rename.
UPDATE merchants SET name = 'Zawadi Corner',
  description = 'Curated shopping finds — notebooks, candles, kitenge totes and little gifts, delivered with your groceries.'
  WHERE name = 'Mtaa Finds';
UPDATE merchants SET
  description = 'Songa medical courier — pharmacy essentials sealed and rushed to your door. Non-prescription medicines, first aid, vitamins; prescription orders are verified with our pharmacists by phone.'
  WHERE name = 'DawaPlus Essentials';
UPDATE merchants SET
  description = 'Fresh-cut flowers from Limuru growers, wrapped in-store. Groceries & shopping delivery — add a handwritten note at checkout.'
  WHERE name = 'Maua Yetu';

-- Medical-courier coverage for Mombasa + Kisumu (fresh DBs get these from the seed instead).
INSERT INTO merchants (name, description, city, areas, category, delivery_fee, min_order, prep_minutes, rating, ratings_count, image_hint)
SELECT 'Dawa Bora Pharmacy', 'Songa medical courier in Mombasa — sealed pharmacy essentials and first-aid supplies, rushed to your door.',
  'mombasa', 'Nyali, CBD, Bamburi', 'medical', 100, 0, 10, 45, 63, 'care'
WHERE NOT EXISTS (SELECT 1 FROM merchants WHERE name = 'Dawa Bora Pharmacy');
INSERT INTO merchants (name, description, city, areas, category, delivery_fee, min_order, prep_minutes, rating, ratings_count, image_hint)
SELECT 'Oginga Dawa Pharmacy', 'Songa medical courier in Kisumu — pharmacy essentials and first-aid supplies, sealed and delivered fast.',
  'kisumu', 'Milimani, CBD, Kondele', 'medical', 90, 0, 10, 44, 41, 'care'
WHERE NOT EXISTS (SELECT 1 FROM merchants WHERE name = 'Oginga Dawa Pharmacy');

-- Starter shelves for the two migrated-in pharmacies (only when they have no products yet).
INSERT INTO products (merchant_id, name, description, price, section, stock, image_hint)
SELECT id, 'Paracetamol 500mg (20 tabs)', 'General pain & fever relief. Follow the pack leaflet.', 150, 'Essentials', 90, 'care'
FROM merchants WHERE name = 'Dawa Bora Pharmacy'
AND NOT EXISTS (SELECT 1 FROM products p JOIN merchants m ON m.id = p.merchant_id WHERE m.name = 'Dawa Bora Pharmacy');
INSERT INTO products (merchant_id, name, description, price, section, stock, image_hint)
SELECT id, 'ORS Sachets (6 pack)', 'Oral rehydration salts for dehydration recovery.', 180, 'Essentials', 70, 'care'
FROM merchants WHERE name = 'Dawa Bora Pharmacy'
AND NOT EXISTS (SELECT 1 FROM products p JOIN merchants m ON m.id = p.merchant_id WHERE m.name = 'Dawa Bora Pharmacy' AND p.name = 'ORS Sachets (6 pack)');
INSERT INTO products (merchant_id, name, description, price, section, stock, image_hint)
SELECT id, 'Digital Thermometer', 'Fast-read digital thermometer with storage case.', 650, 'Devices', 25, 'care'
FROM merchants WHERE name = 'Dawa Bora Pharmacy'
AND NOT EXISTS (SELECT 1 FROM products p JOIN merchants m ON m.id = p.merchant_id WHERE m.name = 'Dawa Bora Pharmacy' AND p.name = 'Digital Thermometer');
INSERT INTO products (merchant_id, name, description, price, section, stock, image_hint)
SELECT id, 'Paracetamol 500mg (20 tabs)', 'General pain & fever relief. Follow the pack leaflet.', 150, 'Essentials', 80, 'care'
FROM merchants WHERE name = 'Oginga Dawa Pharmacy'
AND NOT EXISTS (SELECT 1 FROM products p JOIN merchants m ON m.id = p.merchant_id WHERE m.name = 'Oginga Dawa Pharmacy');
INSERT INTO products (merchant_id, name, description, price, section, stock, image_hint)
SELECT id, 'Antiseptic Liquid (250ml)', 'First-aid antiseptic for cuts and grazes.', 220, 'First aid', 55, 'care'
FROM merchants WHERE name = 'Oginga Dawa Pharmacy'
AND NOT EXISTS (SELECT 1 FROM products p JOIN merchants m ON m.id = p.merchant_id WHERE m.name = 'Oginga Dawa Pharmacy' AND p.name = 'Antiseptic Liquid (250ml)');
INSERT INTO products (merchant_id, name, description, price, section, stock, image_hint)
SELECT id, 'Multivitamins (30 tabs)', 'Daily multivitamin food supplement.', 550, 'Vitamins', 40, 'care'
FROM merchants WHERE name = 'Oginga Dawa Pharmacy'
AND NOT EXISTS (SELECT 1 FROM products p JOIN merchants m ON m.id = p.merchant_id WHERE m.name = 'Oginga Dawa Pharmacy' AND p.name = 'Multivitamins (30 tabs)');
