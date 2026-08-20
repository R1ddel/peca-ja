/**
 * Smoke: health da plataforma (auth/pedidos/lojas).
 */
import 'dotenv/config';

const port = process.env.FLEET_PORT || process.env.PORT || '8787';
const base =
  process.env.EXPO_PUBLIC_FLEET_URL?.trim() ||
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  `http://127.0.0.1:${port}`;

async function main() {
  const url = `${base.replace(/\/$/, '')}/api/platform`;
  console.log('GET', url);
  const res = await fetch(url);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
  if (!json?.ok) {
    console.error('Plataforma não respondeu ok. Rode: npm run fleet:server');
    process.exit(1);
  }
  console.log('OK · persistence=', json.persistence);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
