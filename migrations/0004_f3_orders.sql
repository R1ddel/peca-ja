-- F3: orders + order_items (payload JSONB para campos flexíveis do pedido)

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  business_id TEXT,
  business_name TEXT,
  status TEXT,
  city TEXT,
  subtotal DOUBLE PRECISION,
  delivery_fee DOUBLE PRECISION,
  discount DOUBLE PRECISION,
  total DOUBLE PRECISION,
  payment_method TEXT,
  payment_id TEXT,
  payment_provider TEXT,
  payment_confirmed BOOLEAN,
  driver_id TEXT,
  driver_platform_user_id TEXT,
  delivery_by TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS orders_user_id_created_at_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_business_id_status_idx ON orders (business_id, status);
CREATE INDEX IF NOT EXISTS orders_city_status_idx ON orders (city, status);
CREATE INDEX IF NOT EXISTS orders_driver_id_idx ON orders (driver_id);

CREATE TABLE IF NOT EXISTS order_items (
  line_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  item_id TEXT,
  name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DOUBLE PRECISION,
  business_id TEXT,
  note TEXT,
  selected_addons JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (order_id, line_id)
);
