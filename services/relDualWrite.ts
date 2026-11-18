/**
 * Helpers compartilhados do dual-write relacional (F1+).
 * Flags default off — ver persistenceMode.ts.
 */
import { createPostgres } from '@/services/postgresClient';
import { shouldDualWrite, type RelDomain } from '@/services/persistenceMode';

type Sql = Awaited<ReturnType<typeof createPostgres>>;

let sqlPromise: Promise<Sql> | null = null;

export function relDatabaseUrl(): string | null {
  return (
    process.env.PLATFORM_DATABASE_URL?.trim() ||
    process.env.FLEET_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    null
  );
}

export async function getRelSql(): Promise<Sql | null> {
  const url = relDatabaseUrl();
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

export async function dualWriteSafe(
  domain: RelDomain,
  op: string,
  fn: () => Promise<void>
): Promise<void> {
  if (!shouldDualWrite(domain)) return;
  try {
    await fn();
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err || 'error').slice(0, 200);
    console.warn(`[rel-${domain}] dual-write ${op} falhou (JSONB segue SoT):`, msg);
  }
}
