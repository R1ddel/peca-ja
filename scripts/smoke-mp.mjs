/**
 * Smoke test: cria um Pix de R$ 0,01 no Mercado Pago e consulta o status.
 * Uso: node scripts/smoke-mp.mjs
 * Não imprime o token.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const token = env.MP_ACCESS_TOKEN;
  if (!token || (!token.startsWith('APP_USR-') && !token.startsWith('TEST-'))) {
    console.error('FAIL: MP_ACCESS_TOKEN ausente ou inválido no .env');
    process.exit(1);
  }

  const meRes = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const me = await meRes.json();
  if (!meRes.ok) {
    console.error('FAIL: token rejeitado', me?.message || meRes.status);
    process.exit(1);
  }
  console.log('OK conta MP id=', me.id, 'site=', me.site_id);

  const idem = `smoke-${Date.now()}`;
  const payRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idem,
    },
    body: JSON.stringify({
      transaction_amount: 0.01,
      description: 'Peça Já smoke test',
      payment_method_id: 'pix',
      payer: { email: 'smoke@pecaja.app', first_name: 'Smoke' },
      external_reference: idem,
    }),
  });
  const pay = await payRes.json();
  if (!payRes.ok) {
    console.error('FAIL: criar Pix', pay?.message || JSON.stringify(pay?.cause) || payRes.status);
    process.exit(1);
  }
  const qr = pay?.point_of_interaction?.transaction_data?.qr_code;
  console.log('OK pix id=', pay.id, 'status=', pay.status, 'tem_qr=', !!qr);

  const stRes = await fetch(`https://api.mercadopago.com/v1/payments/${pay.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const st = await stRes.json();
  console.log('OK consulta status=', st.status);
  console.log('SMOKE_OK');
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
