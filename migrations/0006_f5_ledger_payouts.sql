-- F5: ledger_entries, payout_profiles, plan_payments

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  order_id TEXT,
  kind TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  actor_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ledger_owner_created_idx
  ON ledger_entries (owner_type, owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_order_id_idx ON ledger_entries (order_id);

CREATE TABLE IF NOT EXISTS payout_profiles (
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  pix_key TEXT NOT NULL,
  pix_key_type TEXT NOT NULL,
  holder_name TEXT NOT NULL DEFAULT '',
  document TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (owner_type, owner_id)
);

CREATE TABLE IF NOT EXISTS plan_payments (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  external_reference TEXT,
  owner_user_id TEXT,
  business_name TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS plan_payments_application_id_idx ON plan_payments (application_id);
