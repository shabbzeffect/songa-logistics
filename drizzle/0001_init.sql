-- Songa Logistics initial schema (0001). Postgres / PGlite compatible.
-- NOTE: gen_random_uuid() is built into Postgres 13+; no extension needed.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  merchant_id UUID,
  rider_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  areas TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  delivery_fee INTEGER NOT NULL DEFAULT 150,
  free_over INTEGER,
  min_order INTEGER NOT NULL DEFAULT 0,
  prep_minutes INTEGER NOT NULL DEFAULT 20,
  rating INTEGER NOT NULL DEFAULT 45,
  ratings_count INTEGER NOT NULL DEFAULT 0,
  open BOOLEAN NOT NULL DEFAULT true,
  approved BOOLEAN NOT NULL DEFAULT true,
  image_hint TEXT NOT NULL DEFAULT 'meal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS merchants_city_idx ON merchants (city);
CREATE INDEX IF NOT EXISTS merchants_category_idx ON merchants (category);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  section TEXT NOT NULL DEFAULT 'Main',
  dietary TEXT NOT NULL DEFAULT '',
  allergens TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  available BOOLEAN NOT NULL DEFAULT true,
  image_hint TEXT NOT NULL DEFAULT 'meal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_merchant_idx ON products (merchant_id);

CREATE TABLE IF NOT EXISTS modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  multi BOOLEAN NOT NULL DEFAULT false,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  available BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  percent INTEGER,
  amount_off INTEGER,
  cap INTEGER,
  min_subtotal INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  verified BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref TEXT NOT NULL UNIQUE,
  tracking_token TEXT NOT NULL UNIQUE,
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  rider_id UUID REFERENCES riders(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  address_line TEXT NOT NULL,
  landmark TEXT NOT NULL DEFAULT '',
  delivery_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'placed',
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  service_fee INTEGER NOT NULL DEFAULT 0,
  tip INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  promo_code TEXT NOT NULL DEFAULT '',
  scheduled_for TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE,
  proof_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_merchant_idx ON orders (merchant_id);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  modifier_delta INTEGER NOT NULL DEFAULT 0,
  modifiers JSONB NOT NULL DEFAULT '[]',
  qty INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id);

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  parcel_id UUID,
  method TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_ref TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref TEXT NOT NULL UNIQUE,
  tracking_token TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  pickup_area TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  dropoff_area TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  contents TEXT NOT NULL,
  size TEXT NOT NULL,
  weight_kg INTEGER NOT NULL,
  quote INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  rider_id UUID REFERENCES riders(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parcels_status_idx ON parcels (status);

CREATE TABLE IF NOT EXISTS parcel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  handled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}',
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events (entity_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
