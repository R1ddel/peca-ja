/**
 * Persistência da plataforma: Postgres (prod) ou .data/platform (dev/LAN).
 * Se o Neon falhar (cota/rede), cai automaticamente para arquivo local.
 */
import fs from 'fs';
import path from 'path';
import { createPostgres } from '@/services/postgresClient';
import type { PlatformState } from '@/services/platformTypes';
import {
  loadStateRow,
  pingStateTable,
  saveStateRow,
  supabaseRestEnabled,
} from '@/services/supabaseRest';

type Sql = Awaited<ReturnType<typeof createPostgres>>;

let sqlPromise: Promise<Sql> | null = null;
let schemaReady = false;
/** Evita dezenas de CREATE TABLE em paralelo (estoura pool Supabase). */
let schemaLock: Promise<void> | null = null;
function localFileModeRequested(): boolean {
  return (
    process.env.PLATFORM_FORCE_FS === '1' ||
    process.env.PLATFORM_FORCE_FS === 'true' ||
    process.env.PLATFORM_HQ_PROJECTION === '1' ||
    process.env.PLATFORM_HQ_PROJECTION === 'true'
  );
}

/** No site publicado o banco manda. Arquivo local só no computador. */
function startInFileMode(): boolean {
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL?.trim()) return false;
  return localFileModeRequested();
}

/** true = Postgres indisponível → usa .data/platform */
let forceFilesystem = startInFileMode();

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
  if (supabaseRestEnabled()) return 'postgres';
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
    payoutProfiles: [],
    tickets: [],
    chats: {},
    auditLogs: [],
    applications: [],
    planPayments: [],
    cities: [],
    coupons: [],
    campaigns: [],
    featureFlags: [],
    systemLogs: [],
    incidents: [],
    reviews: [],
    problemCases: [],
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
    payoutProfiles: Array.isArray(p.payoutProfiles) ? p.payoutProfiles : [],
    tickets: Array.isArray(p.tickets) ? p.tickets : [],
    chats:
      p.chats && typeof p.chats === 'object' && !Array.isArray(p.chats)
        ? (p.chats as Record<string, unknown[]>)
        : {},
    auditLogs: Array.isArray(p.auditLogs) ? p.auditLogs : [],
    applications: Array.isArray(p.applications) ? p.applications : [],
    planPayments: Array.isArray((p as any).planPayments) ? (p as any).planPayments : [],
    cities: Array.isArray(p.cities) ? p.cities : [],
    coupons: Array.isArray(p.coupons) ? p.coupons : [],
    campaigns: Array.isArray(p.campaigns) ? p.campaigns : [],
    featureFlags: Array.isArray(p.featureFlags) ? p.featureFlags : [],
    systemLogs: Array.isArray(p.systemLogs) ? p.systemLogs : [],
    incidents: Array.isArray(p.incidents) ? p.incidents : [],
    reviews: Array.isArray(p.reviews) ? p.reviews : [],
    problemCases: Array.isArray((p as any).problemCases) ? (p as any).problemCases : [],
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

/** Fila local: evita dois writes FS ao mesmo tempo (EPERM no Windows). */
let fsWriteChain: Promise<void> = Promise.resolve();

/**
 * Gravação atômica cross-platform.
 * No Windows, `rename(tmp → state.json)` falha com EPERM se o destino
 * existir/estiver aberto — usamos replace via copyFile + unlink.
 */
async function saveFs(state: PlatformState): Promise<void> {
  const run = async () => {
    await fs.promises.mkdir(dataDir(), { recursive: true });
    const dest = stateFile();
    const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
    const payload = JSON.stringify(state, null, 2);
    await fs.promises.writeFile(tmp, payload, 'utf8');
    try {
      // Unix: rename substitui. Windows: pode EPERM se dest estiver aberto.
      await fs.promises.rename(tmp, dest);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'EPERM' || code === 'EEXIST' || process.platform === 'win32') {
        try {
          await fs.promises.copyFile(tmp, dest);
        } finally {
          await fs.promises.unlink(tmp).catch(() => undefined);
        }
        return;
      }
      await fs.promises.unlink(tmp).catch(() => undefined);
      throw err;
    }
  };
  const next = fsWriteChain.then(run, run);
  fsWriteChain = next.then(
    () => undefined,
    () => undefined
  );
  await next;
}

async function getSql() {
  const url = getPlatformDatabaseUrl();
  if (!url) throw new Error('DATABASE_URL ausente');
  if (!sqlPromise) {
    sqlPromise = createPostgres(url, {
      max: 2,
      idle_timeout: 10,
      max_lifetime: 60 * 5,
      connect_timeout: 15,
      prepare: false,
    });
  }
  return sqlPromise;
}

export async function pingPlatformDb(): Promise<void> {
  if (supabaseRestEnabled()) {
    await pingStateTable('platform_state');
    return;
  }
  const db = await getSql();
  await db`SELECT 1`;
}

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  if (!schemaLock) {
    schemaLock = (async () => {
      const db = await getSql();
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
  if (supabaseRestEnabled()) {
    const row = await loadStateRow('platform_state');
    return normalize(row?.payload);
  }
  await ensureSchema();
  const db = await getSql();
  const rows = await db`SELECT payload FROM platform_state WHERE id = 1`;
  return normalize(rows[0]?.payload);
}

async function savePg(state: PlatformState): Promise<void> {
  if (supabaseRestEnabled()) {
    await saveStateRow('platform_state', state.revision, state.updatedAt, state);
    return;
  }
  await ensureSchema();
  const db = await getSql();
  await db`
    UPDATE platform_state
    SET revision = ${state.revision},
        updated_at = NOW(),
        payload = ${db.json(state as never)}
    WHERE id = 1
  `;
}

export async function loadPlatformState(): Promise<PlatformState> {
  if (!getPlatformDatabaseUrl() && !supabaseRestEnabled()) return loadFs();
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
  if (!getPlatformDatabaseUrl() && !supabaseRestEnabled()) {
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
 * Fila única de leitura+gravação.
 * Sem isso, o login grava a sessão e um `me` antigo (ou o seed da projeção)
 * salva o estado anterior por cima — o PIN do HQ passa a dizer que não há login.
 */
let platformWriteChain: Promise<void> = Promise.resolve();

export function withPlatformLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = platformWriteChain.then(fn, fn);
  platformWriteChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Mutação atômica (leitura → mutate → escrita).
 * Em Postgres ainda é read-modify-write simples; suficiente pro piloto.
 */
export async function mutatePlatformState(
  fn: (state: PlatformState) => { state: PlatformState; result: any }
): Promise<any> {
  return withPlatformLock(async () => {
    const current = await loadPlatformState();
    const { state, result } = fn(current);
    await savePlatformState(state);
    return result;
  });
}
