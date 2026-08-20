-- Peça Já — schema Postgres (Neon / Supabase / Railway)
-- O servidor também cria as tabelas no 1º request; este arquivo é referência / migrate manual.

-- Frota compartilhada
CREATE TABLE IF NOT EXISTS fleet_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO fleet_state (id, revision, updated_at, payload)
VALUES (1, 0, NOW(), '{"revision":0,"orders":[],"drivers":{},"reports":[]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Plataforma (auth, pedidos, lojas, ledger, tickets)
CREATE TABLE IF NOT EXISTS platform_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO platform_state (id, revision, updated_at, payload)
VALUES (
  1,
  0,
  NOW(),
  '{"revision":0,"users":[],"sessions":[],"orders":[],"shops":[],"ledger":[],"tickets":[]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
