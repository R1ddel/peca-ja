/**
 * Cliente Postgres carregado só quando a nuvem é consultada.
 * Assim a tela de login sobe mesmo no servidor publicado.
 */
type Sql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]>;
  json: (value: unknown) => unknown;
  begin: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>;
};

type PostgresFactory = (url: string, opts?: Record<string, unknown>) => Sql;

let factoryPromise: Promise<PostgresFactory> | null = null;

function isCloudflareWorker(): boolean {
  const g = globalThis as { WebSocketPair?: unknown; navigator?: { userAgent?: string } };
  if (typeof g.WebSocketPair === 'function') return true;
  return String(g.navigator?.userAgent || '').includes('Cloudflare');
}

function withSsl(url: string, opts: Record<string, unknown>): Record<string, unknown> {
  if (opts.ssl != null) return opts;
  if (url.includes('supabase.com') || url.includes('sslmode=require')) {
    return { ...opts, ssl: 'require' };
  }
  return opts;
}

async function loadFactory(): Promise<PostgresFactory> {
  if (isCloudflareWorker()) {
    const mod = (await import('./postgresCfEntry.js')) as { default: PostgresFactory };
    return mod.default;
  }
  const mod = (await import('postgres')) as { default: PostgresFactory };
  return mod.default;
}

export async function createPostgres(
  url: string,
  opts: Record<string, unknown> = {}
): Promise<Sql> {
  if (!factoryPromise) factoryPromise = loadFactory();
  const postgres = await factoryPromise;
  return postgres(url, withSsl(url, opts));
}
