/**
 * Banco pela porta web (HTTPS). O site publicado não abre o cabo direto do Postgres.
 * A chave fica só no servidor. Nunca use prefixo EXPO_PUBLIC_.
 */

export type StateTable = 'platform_state' | 'fleet_state';

export type StateRow = {
  revision: number;
  updated_at: string;
  payload: unknown;
};

function readServerEnv(suffix: string): string {
  const env = process.env as Record<string, string | undefined>;
  return (env['SUPABASE_' + suffix] || '').trim();
}

function restConfig(): { base: string; key: string } | null {
  const base = readServerEnv('URL').replace(/\/$/, '');
  const key = readServerEnv('SECRET_KEY') || readServerEnv('SERVICE_ROLE_KEY');
  if (!base.startsWith('https://') || !key) return null;
  return { base, key };
}

export function supabaseRestEnabled(): boolean {
  return restConfig() != null;
}

async function restFetch(path: string, init: RequestInit & { prefer?: string } = {}): Promise<unknown> {
  const cfg = restConfig();
  if (!cfg) throw new Error('SUPABASE_URL ausente');
  const { prefer, ...rest } = init;
  const headers: Record<string, string> = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    Accept: 'application/json',
    'User-Agent': 'pecaja-server',
  };
  if (rest.body) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${cfg.base}/rest/v1/${path}`, { ...rest, headers });
  const text = await res.text();
  if (!res.ok) {
    const detail = text.replace(cfg.key, '').slice(0, 140);
    throw new Error(`supabase ${res.status} ${detail}`);
  }
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

export async function pingStateTable(table: StateTable): Promise<void> {
  await restFetch(`${table}?select=id&limit=1`);
}

export async function loadStateRow(table: StateTable): Promise<StateRow | null> {
  const rows = await restFetch(
    `${table}?id=eq.1&select=revision,updated_at,payload&limit=1`
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || typeof row !== 'object') return null;
  const rec = row as { revision?: unknown; updated_at?: unknown; payload?: unknown };
  return {
    revision: Number(rec.revision) || 0,
    updated_at: typeof rec.updated_at === 'string' ? rec.updated_at : '',
    payload: rec.payload,
  };
}

/** false = outra escrita ganhou a revisão. Sem expectedRevision, cria a linha se ela não existir. */
export async function saveStateRow(
  table: StateTable,
  revision: number,
  updatedAt: string,
  payload: unknown,
  expectedRevision?: number
): Promise<boolean> {
  const filter =
    expectedRevision == null
      ? 'id=eq.1'
      : `id=eq.1&revision=eq.${expectedRevision}`;
  const patched = await restFetch(`${table}?${filter}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: JSON.stringify({
      revision,
      updated_at: updatedAt,
      payload,
    }),
  });
  if (Array.isArray(patched) && patched.length > 0) return true;
  if (expectedRevision != null && expectedRevision !== 0) return false;
  const existing = await loadStateRow(table);
  if (existing) return false;
  await restFetch(table, {
    method: 'POST',
    prefer: 'return=minimal,resolution=merge-duplicates',
    body: JSON.stringify({
      id: 1,
      revision,
      updated_at: updatedAt,
      payload,
    }),
  });
  return true;
}
