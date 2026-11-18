-- F6: tickets, applications, audit_logs (+ extras HQ leves)

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT,
  category TEXT,
  assignee_user_id TEXT,
  order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status);
CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON tickets (user_id);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL,
  from_role TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ticket_messages_ticket_id_idx ON ticket_messages (ticket_id);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  pipeline_stage TEXT,
  city TEXT,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  business_name TEXT,
  document TEXT,
  notes TEXT,
  owner_user_id TEXT,
  assignee_user_id TEXT,
  follow_up_at TIMESTAMPTZ,
  tags JSONB,
  timeline JSONB,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS applications_role_status_idx ON applications (role, status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  reason TEXT,
  ip TEXT,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  service TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  meta JSONB,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  scope TEXT NOT NULL DEFAULT 'global',
  city_id TEXT,
  percent DOUBLE PRECISION,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT
);
