/**
 * Persistência relacional de auth (F1).
 * Só usada com PERSISTENCE_MODE=hybrid e REL_USERS=1 (dual-write).
 * Leitura de corte (SoT relacional) ainda NÃO está ligada — JSONB continua default.
 */
import { createPostgres } from '@/services/postgresClient';
import { shouldDualWrite } from '@/services/persistenceMode';
import type { PlatformSession, PlatformUser } from '@/services/platformTypes';

type Sql = Awaited<ReturnType<typeof createPostgres>>;

let sqlPromise: Promise<Sql> | null = null;

function databaseUrl(): string | null {
  return (
    process.env.PLATFORM_DATABASE_URL?.trim() ||
    process.env.FLEET_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    null
  );
}

async function getSql(): Promise<Sql | null> {
  const url = databaseUrl();
  if (!url) return null;
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

function logDualWriteError(op: string, err: unknown) {
  const msg = String((err as { message?: string })?.message || err || 'error').slice(0, 200);
  console.warn(`[rel-auth] dual-write ${op} falhou (JSONB segue SoT):`, msg);
}

export async function upsertUserRel(user: PlatformUser): Promise<void> {
  const db = await getSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO users (
      id, email, phone, name, address, photo_url, cover_url, bio,
      platform_role, password_hash, password_salt, blocked, blocked_reason, blocked_at,
      created_at, updated_at
    ) VALUES (
      ${user.id},
      ${user.email},
      ${user.phone || ''},
      ${user.name || ''},
      ${user.address || ''},
      ${user.photoUrl ?? null},
      ${user.coverUrl ?? null},
      ${user.bio ?? null},
      ${user.platformRole ?? null},
      ${user.passwordHash},
      ${user.passwordSalt},
      ${!!user.blocked},
      ${user.blockedReason ?? null},
      ${user.blockedAt ?? null},
      ${user.createdAt},
      ${new Date().toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      photo_url = EXCLUDED.photo_url,
      cover_url = EXCLUDED.cover_url,
      bio = EXCLUDED.bio,
      platform_role = EXCLUDED.platform_role,
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      blocked = EXCLUDED.blocked,
      blocked_reason = EXCLUDED.blocked_reason,
      blocked_at = EXCLUDED.blocked_at,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function upsertSessionRel(session: PlatformSession): Promise<void> {
  const db = await getSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (
      ${session.token},
      ${session.userId},
      ${session.createdAt},
      ${session.expiresAt}
    )
    ON CONFLICT (token) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      created_at = EXCLUDED.created_at,
      expires_at = EXCLUDED.expires_at
  `;
}

export async function deleteSessionRel(token: string): Promise<void> {
  const db = await getSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`DELETE FROM sessions WHERE token = ${token}`;
}

export async function deleteSessionsForUserRel(userId: string): Promise<void> {
  const db = await getSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`DELETE FROM sessions WHERE user_id = ${userId}`;
}

export async function replaceSessionsForUserRel(
  userId: string,
  session: PlatformSession
): Promise<void> {
  const db = await getSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db.begin(async (tx) => {
    await tx`DELETE FROM sessions WHERE user_id = ${userId}`;
    await tx`
      INSERT INTO sessions (token, user_id, created_at, expires_at)
      VALUES (
        ${session.token},
        ${session.userId},
        ${session.createdAt},
        ${session.expiresAt}
      )
      ON CONFLICT (token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        created_at = EXCLUDED.created_at,
        expires_at = EXCLUDED.expires_at
    `;
  });
}

export type PasswordResetRel = {
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  attempts?: number;
};

export async function upsertPasswordResetRel(row: PasswordResetRel): Promise<void> {
  const db = await getSql();
  if (!db) throw new Error('DATABASE_URL ausente');
  await db`
    INSERT INTO password_resets (email, token_hash, expires_at, used_at, attempts)
    VALUES (
      ${row.email},
      ${row.tokenHash},
      ${row.expiresAt},
      ${row.usedAt ?? null},
      ${row.attempts ?? 0}
    )
    ON CONFLICT (email) DO UPDATE SET
      token_hash = EXCLUDED.token_hash,
      expires_at = EXCLUDED.expires_at,
      used_at = EXCLUDED.used_at,
      attempts = EXCLUDED.attempts
  `;
}

/** Leitura preparada para cutover futuro — não usada como SoT em F1. */
export async function findUserByEmailRel(email: string): Promise<PlatformUser | null> {
  const db = await getSql();
  if (!db) return null;
  const rows = await db`
    SELECT
      id, email, phone, name, address, photo_url, cover_url, bio,
      platform_role, password_hash, password_salt, blocked, blocked_reason, blocked_at, created_at
    FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return rowToUser(r);
}

export async function findUserByIdRel(id: string): Promise<PlatformUser | null> {
  const db = await getSql();
  if (!db) return null;
  const rows = await db`
    SELECT
      id, email, phone, name, address, photo_url, cover_url, bio,
      platform_role, password_hash, password_salt, blocked, blocked_reason, blocked_at, created_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return rowToUser(r);
}

export async function findSessionRel(token: string): Promise<PlatformSession | null> {
  const db = await getSql();
  if (!db) return null;
  const rows = await db`
    SELECT token, user_id, created_at, expires_at
    FROM sessions
    WHERE token = ${token}
    LIMIT 1
  `;
  const r = rows[0] as
    | { token: string; user_id: string; created_at: string | Date; expires_at: string | Date }
    | undefined;
  if (!r) return null;
  const expiresAt =
    typeof r.expires_at === 'string' ? r.expires_at : new Date(r.expires_at).toISOString();
  if (new Date(expiresAt).getTime() < Date.now()) return null;
  return {
    token: r.token,
    userId: r.user_id,
    createdAt:
      typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
    expiresAt,
  };
}

function rowToUser(r: Record<string, unknown>): PlatformUser {
  return {
    id: String(r.id),
    email: String(r.email),
    phone: String(r.phone || ''),
    name: String(r.name || ''),
    address: String(r.address || ''),
    photoUrl: (r.photo_url as string | null) ?? null,
    coverUrl: (r.cover_url as string | null) ?? null,
    bio: (r.bio as string | null) ?? null,
    platformRole: (r.platform_role as PlatformUser['platformRole']) ?? null,
    passwordHash: String(r.password_hash),
    passwordSalt: String(r.password_salt),
    blocked: !!r.blocked,
    blockedReason: (r.blocked_reason as string | null) ?? null,
    blockedAt: r.blocked_at
      ? typeof r.blocked_at === 'string'
        ? r.blocked_at
        : new Date(r.blocked_at as Date).toISOString()
      : null,
    createdAt:
      typeof r.created_at === 'string'
        ? r.created_at
        : new Date(r.created_at as Date).toISOString(),
  };
}

/** Espelha mutação de auth no relacional se dual-write estiver ligado. Nunca quebra o request. */
export async function dualWriteAuthSafe(op: string, fn: () => Promise<void>): Promise<void> {
  if (!shouldDualWrite('users')) return;
  try {
    await fn();
  } catch (err) {
    logDualWriteError(op, err);
  }
}
