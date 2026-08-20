/**
 * Verifica se a frota responde e qual persistência está ativa.
 * Uso: npm run fleet:check
 */
import 'dotenv/config';

const bases = [
  process.env.EXPO_PUBLIC_FLEET_URL,
  process.env.EXPO_PUBLIC_API_URL,
  'http://127.0.0.1:8787',
  'http://127.0.0.1:8081',
].filter(Boolean) as string[];

async function check(base: string) {
  const url = `${base.replace(/\/$/, '')}/api/fleet`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    const json = (await res.json()) as Record<string, unknown>;
    console.log(`OK  ${url}`);
    console.log(
      `    persistence=${json.persistence ?? '?'} driversOnline=${json.driversOnline ?? '?'} orders=${json.orders ?? '?'}`
    );
    return true;
  } catch (e: any) {
    console.log(`FAIL ${url} · ${e?.message || e}`);
    return false;
  }
}

async function main() {
  console.log('Checando frota Peça Já…\n');
  let any = false;
  const seen = new Set<string>();
  for (const b of bases) {
    const key = b.replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    if (await check(key)) any = true;
  }
  if (!any) {
    console.log('\nNenhuma frota respondeu. Rode: npm run fleet:server  ou  npx expo start');
    process.exit(1);
  }
  if (!process.env.FLEET_DATABASE_URL && !process.env.DATABASE_URL) {
    console.log(
      '\nDica: sem FLEET_DATABASE_URL a frota usa arquivo local (LAN). Pra produção, configure Postgres (Neon).'
    );
  } else {
    console.log('\nFLEET_DATABASE_URL detectada no .env — use npm run fleet:server pra Postgres.');
  }
}

void main();
