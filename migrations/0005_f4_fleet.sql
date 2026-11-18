-- F4: frota relacional (drivers / sessions / reports). fleet_state JSONB permanece SoT.

CREATE TABLE IF NOT EXISTS drivers (
  fleet_id TEXT PRIMARY KEY,
  application_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  city TEXT,
  online BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  last_offer_at BIGINT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS drivers_online_idx ON drivers (online);
CREATE INDEX IF NOT EXISTS drivers_city_idx ON drivers (city);

CREATE TABLE IF NOT EXISTS driver_sessions (
  fleet_id TEXT PRIMARY KEY REFERENCES drivers (fleet_id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_reports (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
