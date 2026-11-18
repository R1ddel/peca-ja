-- F2: shops, menu_items, cities (JSONB platform_state permanece SoT)

CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  service_radius_km DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shops (
  business_id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  owner_user_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  image TEXT,
  cover_image TEXT,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  hours TEXT,
  weekly_hours JSONB,
  delivery_time TEXT,
  delivery_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
  min_order DOUBLE PRECISION NOT NULL DEFAULT 0,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  plan TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  city TEXT,
  state TEXT,
  service_radius_km DOUBLE PRECISION,
  plan_paid_until TIMESTAMPTZ,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  accepted_payments JSONB,
  delivery_by TEXT,
  mp_collector_id TEXT,
  mp_seller_access_token TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shops_owner_user_id_idx ON shops (owner_user_id);
CREATE INDEX IF NOT EXISTS shops_city_idx ON shops (city);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT NOT NULL,
  shop_id TEXT NOT NULL REFERENCES shops (business_id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  details TEXT,
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  image TEXT,
  images JSONB,
  category TEXT NOT NULL DEFAULT '',
  popular BOOLEAN,
  promo DOUBLE PRECISION,
  addon_groups JSONB,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  convenience BOOLEAN,
  PRIMARY KEY (shop_id, id)
);

CREATE INDEX IF NOT EXISTS menu_items_shop_id_idx ON menu_items (shop_id);
