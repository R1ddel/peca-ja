/**
 * Persistência da plataforma: Postgres (prod) ou .data/platform (dev/LAN).
 * Se o Neon falhar (cota/rede), cai automaticamente para arquivo local.
 */
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import type { PlatformState } from '@/services/platformTypes';

let sql: ReturnType<typeof postgres> | null = null;
let schemaReady = false;
/** Evita dezenas de CREATE TABLE em paralelo (estoura pool Supabase). */
let schemaLock: Promise<void> | null = null;
/** true = Neon/Postgres indisponível → usa .data/platform */
let forceFilesystem = false;

export function getPlatformDatabaseUrl(): string | null {
  if (forceFilesystem) return null;
  const url =
    process.env.PLATFORM_DATABASE_URL?.trim() ||
    process.env.FLEET_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    '';
  return url || null;
}

export function platformPersistenceMode(): 'postgres' | 'filesystem' {
  return getPlatformDatabaseUrl() ? 'postgres' : 'filesystem';
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

function markFilesystemFallback(err: unknown) {
  if (process.env.NODE_ENV === 'production') {
    const msg = String((err as { message?: string })?.message || err || 'db_unavailable');
    console.error('[platform] Postgres indisponível em production — sem fallback FS:', msg);
    throw Object.assign(new Error(`Postgres indisponível: ${msg}`), {
      code: 'NO_POSTGRES',
    });
  }
  if (!forceFilesystem) {
    forceFilesystem = true;
    schemaReady = false;
    console.warn(
      '[platform] Postgres indisponível — usando .data/platform. Motivo:',
      String((err as { message?: string })?.message || err)
    );
  }
}

function emptyState(): PlatformState {
  return {
    revision: 0,
    updatedAt: new Date().toISOString(),
    users: [],
    sessions: [],
    passwordResets: [],
    orders: [],
    shops: [],
    ledger: [],
    tickets: [],
    chats: {},
  };
}

function normalize(raw: unknown): PlatformState {
  const p = (raw || {}) as Partial<PlatformState>;
  return {
    revision: p.revision || 0,
    updatedAt: p.updatedAt || new Date().toISOString(),
    users: Array.isArray(p.users) ? p.users : [],
    sessions: Array.isArray(p.sessions) ? p.sessions : [],
    passwordResets: Array.isArray(p.passwordResets) ? p.passwordResets : [],
    orders: Array.isArray(p.orders) ? p.orders : [],
    shops: Array.isArray(p.shops) ? p.shops : [],
    ledger: Array.isArray(p.ledger) ? p.ledger : [],
    tickets: Array.isArray(p.tickets) ? p.tickets : [],
    chats:
      p.chats && typeof p.chats === 'object' && !Array.isArray(p.chats)
        ? (p.chats as Record<string, unknown[]>)
        : {},
  };
}

function dataDir() {
  return path.join(process.cwd(), '.data', 'platform');
}

function stateFile() {
  return path.join(dataDir(), 'state.json');
}

async function loadFs(): Promise<PlatformState> {
  try {
    const raw = await fs.promises.readFile(stateFile(), 'utf8');
    return normalize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

async function saveFs(state: PlatformState): Promise<void> {
  await fs.promises.mkdir(dataDir(), { recursive: true });
  const tmp = `${stateFile()}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.promises.rename(tmp, stateFile());
}

function getSql() {
  const url = getPlatformDatabaseUrl();
  if (!url) throw new Error('DATABASE_URL ausente');
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

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  if (!schemaLock) {
    schemaLock = (async () => {
      const db = getSql();
      await db`
        CREATE TABLE IF NOT EXISTS platform_state (
          id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          revision INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          payload JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `;
      await db`
        INSERT INTO platform_state (id, revision, updated_at, payload)
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

async function loadPg(): Promise<PlatformState> {
  await ensureSchema();
  const db = getSql();
  const rows = await db`SELECT payload FROM platform_state WHERE id = 1`;
  return normalize(rows[0]?.payload);
}

async function savePg(state: PlatformState): Promise<void> {
  await ensureSchema();
  const db = getSql();
  await db`
    UPDATE platform_state
    SET revision = ${state.revision},
        updated_at = NOW(),
        payload = ${db.json(state as never)}
    WHERE id = 1
  `;
}

export async function loadPlatformState(): Promise<PlatformState> {
  if (!getPlatformDatabaseUrl()) return loadFs();
  try {
    return await loadPg();
  } catch (err) {
    if (isDbUnavailableError(err)) {
      markFilesystemFallback(err);
      return loadFs();
    }
    throw err;
  }
}

export async function savePlatformState(state: PlatformState): Promise<void> {
  const next: PlatformState = {
    ...state,
    revision: (state.revision || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  if (!getPlatformDatabaseUrl()) {
    await saveFs(next);
    return;
  }
  try {
    await savePg(next);
  } catch (err) {
    if (isDbUnavailableError(err)) {
      markFilesystemFallback(err);
      await saveFs(next);
      return;
    }
    throw err;
  }
}

/**
 * Mutação atômica (leitura → mutate → escrita).
 * Em Postgres ainda é read-modify-write simples; suficiente pro piloto.
 */
export async function mutatePlatformState<T>(
  fn: (state: PlatformState) => { state: PlatformState; result: T }
): Promise<T> {
  const current = await loadPlatformState();
  const { state, result } = fn(current);
  await savePlatformState(state);
  return result;
}
