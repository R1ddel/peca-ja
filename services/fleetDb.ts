/**
 * Persistência da frota em Postgres (Neon / Supabase / Railway).
 * Uma linha JSONB + SELECT FOR UPDATE = claim atômico entre vários servidores.
 */
import postgres from 'postgres';
import type { FleetState } from '@/services/fleetTypes';

let sql: ReturnType<typeof postgres> | null = null;
let schemaReady = false;
let schemaLock: Promise<void> | null = null;
let activeTxSave: ((state: FleetState) => Promise<FleetState>) | null = null;
/** Neon/Postgres indisponível → frota em arquivo local */
let forceFilesystem = false;

export function getFleetDatabaseUrl(): string | null {
  if (forceFilesystem) return null;
  const url =
    process.env.FLEET_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    '';
  return url || null;
}

export function isFleetPostgresEnabled(): boolean {
  return !!getFleetDatabaseUrl();
}

function isDbUnavailableError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || '').toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('econnreset') ||
    msg.includes('connection_closed') ||
    msg.includes('enotfound') ||
    msg.includes('connect_timeout') ||
    msg.includes('connection terminated') ||
    msg.includes('too many connections') ||
    msg.includes('max clients') ||
    msg.includes('emaxconnsession') ||
    msg.includes('emaxconn')
  );
}

export function markFleetFilesystemFallback(err?: unknown) {
  if (process.env.NODE_ENV === 'production') {
    const msg = String((err as { message?: string })?.message || err || 'db_unavailable');
    console.error('[fleet] Postgres indisponível em production — sem fallback FS:', msg);
    throw Object.assign(new Error(`Postgres indisponível: ${msg}`), {
      code: 'NO_POSTGRES',
    });
  }
  if (!forceFilesystem) {
    forceFilesystem = true;
    schemaReady = false;
    console.warn(
      '[fleet] Postgres indisponível — usando .data/fleet. Motivo:',
      String((err as { message?: string })?.message || err || 'fallback')
    );
  }
}

function getSql() {
  const url = getFleetDatabaseUrl();
  if (!url) throw new Error('FLEET_DATABASE_URL / DATABASE_URL ausente.');
  if (!sql) {
    sql = postgres(url, {
      max: 2,
      idle_timeout: 10,
      max_lifetime: 60 * 5,
      connect_timeout: 15,
      prepare: false,
    });
  }
  return sql;
}

function emptyState(): FleetState {
  return {
    revision: 0,
    updatedAt: new Date().toISOString(),
    orders: [],
    drivers: {},
    reports: [],
  };
}

function normalize(raw: unknown): FleetState {
  const parsed = (raw || {}) as Partial<FleetState>;
  return {
    revision: parsed.revision || 0,
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    drivers:
      parsed.drivers && typeof parsed.drivers === 'object' ? parsed.drivers : {},
    reports: Array.isArray(parsed.reports) ? parsed.reports : [],
  };
}

export async function ensureFleetSchema(): Promise<void> {
  if (schemaReady) return;
  if (!schemaLock) {
    schemaLock = (async () => {
      const db = getSql();
      await db`
        CREATE TABLE IF NOT EXISTS fleet_state (
          id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          revision INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          payload JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `;
      await db`
        INSERT INTO fleet_state (id, revision, updated_at, payload)
        VALUES (1, 0, NOW(), ${db.json(emptyState() as never)})
        ON CONFLICT (id) DO NOTHING
      `;
      schemaReady = true;
    })().finally(() => {
      schemaLock = null;
    });
  }
  await schemaLock;
}

export async function loadFleetStatePg(): Promise<FleetState> {
  await ensureFleetSchema();
  const db = getSql();
  const rows = await db`
    SELECT revision, updated_at, payload
    FROM fleet_state
    WHERE id = 1
    LIMIT 1
  `;
  if (!rows.length) return emptyState();
  const row = rows[0] as {
    revision: number;
    updated_at: string | Date;
    payload: unknown;
  };
  const state = normalize(row.payload);
  state.revision = Number(row.revision) || state.revision;
  state.updatedAt =
    typeof row.updated_at === 'string'
      ? row.updated_at
      : new Date(row.updated_at).toISOString();
  return state;
}

export async function saveFleetStatePg(state: FleetState): Promise<FleetState> {
  const next: FleetState = {
    ...state,
    revision: (state.revision || 0) + 1,
    updatedAt: new Date().toISOString(),
  };

  if (activeTxSave) {
    return activeTxSave(next);
  }

  await ensureFleetSchema();
  const db = getSql();
  await db`
    UPDATE fleet_state
    SET
      revision = ${next.revision},
      updated_at = ${next.updatedAt},
      payload = ${db.json(next as never)}
    WHERE id = 1
  `;
  return next;
}

/**
 * Lock de linha + save no mesmo transaction (claim atômico multi-worker).
 */
export async function withFleetTransactionPg<T>(
  fn: (ctx: {
    state: FleetState;
    save: (state: FleetState) => Promise<FleetState>;
  }) => Promise<T> | T
): Promise<T> {
  await ensureFleetSchema();
  const db = getSql();
  return db.begin(async (tx) => {
    const rows = await tx`
      SELECT revision, updated_at, payload
      FROM fleet_state
      WHERE id = 1
      FOR UPDATE
    `;
    const row = rows[0] as
      | { revision: number; updated_at: string | Date; payload: unknown }
      | undefined;
    let current = row ? normalize(row.payload) : emptyState();
    if (row) {
      current.revision = Number(row.revision) || current.revision;
      current.updatedAt =
        typeof row.updated_at === 'string'
          ? row.updated_at
          : new Date(row.updated_at).toISOString();
    }

    const save = async (state: FleetState): Promise<FleetState> => {
      const next: FleetState = {
        ...state,
        revision: (state.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      await tx`
        UPDATE fleet_state
        SET
          revision = ${next.revision},
          updated_at = ${next.updatedAt},
          payload = ${tx.json(next as never)}
        WHERE id = 1
      `;
      current = next;
      return next;
    };

    activeTxSave = save;
    try {
      return await fn({ state: current, save });
    } finally {
      activeTxSave = null;
    }
  });
}
