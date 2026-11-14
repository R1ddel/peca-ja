/**
 * Smoke do router de pagamentos (sem Neon / sem celular).
 * Roda in-process: espera 400/401 de validação — nunca 404.
 *
 * Uso: npm run payments:check
 * Opcional: SMOKE_HTTP=1 testa health em http://127.0.0.1:8787
 */
import 'dotenv/config';
import { handlePaymentsRequest } from '../server/paymentsHttp';

type Case = {
  name: string;
  request: Request;
  expectStatus?: number[];
  expectOkFalse?: boolean;
  expectCode?: string;
};

async function runCase(c: Case): Promise<void> {
  const res = await handlePaymentsRequest(c.request);
  if (!res) {
    throw new Error(`${c.name}: router retornou null (404 de path)`);
  }
  const status = res.status;
  const json = (await res.json().catch(() => null)) as any;
  if (c.expectStatus && !c.expectStatus.includes(status)) {
    throw new Error(
      `${c.name}: status ${status} (esperado ${c.expectStatus.join('|')}) body=${JSON.stringify(json)}`
    );
  }
  if (c.expectOkFalse && json?.ok !== false) {
    throw new Error(`${c.name}: esperava ok:false, got ${JSON.stringify(json)}`);
  }
  if (c.expectCode && json?.code !== c.expectCode) {
    throw new Error(`${c.name}: code=${json?.code} esperado ${c.expectCode}`);
  }
  console.log(`OK  ${c.name} → HTTP ${status} code=${json?.code ?? json?.ok}`);
}

async function httpHealth(): Promise<void> {
  if (process.env.SMOKE_HTTP !== '1') return;
  const port = process.env.PORT || process.env.FLEET_PORT || '8787';
  const url = `http://127.0.0.1:${port}/health`;
  const res = await fetch(url);
  const json = (await res.json()) as any;
  if (!res.ok || !json?.ok) {
    throw new Error(`health falhou: ${JSON.stringify(json)}`);
  }
  if (typeof json.payments !== 'boolean' || json.payments !== !!json.mpConfigured) {
    throw new Error(
      `health payments deve seguir mpConfigured → ${JSON.stringify(json)}`
    );
  }
  console.log(
    `OK  HTTP health → fleet=${json.fleet} platform=${json.platform} mp=${json.mpConfigured}`
  );
}

async function main() {
  const cases: Case[] = [
    {
      name: 'GET index',
      request: new Request('http://local/api/payments'),
      expectStatus: [200],
    },
    {
      name: 'POST refund sem auth',
      request: new Request('http://local/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: 'mock_x', orderId: 'ord_x' }),
      }),
      expectStatus: [401],
      expectOkFalse: true,
      expectCode: 'AUTH',
    },
    {
      name: 'POST refund sem orderId',
      request: new Request('http://local/api/payments/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer fake',
        },
        body: JSON.stringify({ paymentId: 'mock_x' }),
      }),
      expectStatus: [400],
      expectOkFalse: true,
      expectCode: 'INVALID',
    },
    {
      name: 'POST withdraw sem auth',
      request: new Request('http://local/api/payments/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: 'b1', amount: 10, pixKey: 'a@b.com' }),
      }),
      expectStatus: [401],
      expectOkFalse: true,
      expectCode: 'AUTH',
    },
    {
      name: 'POST order-credit sem auth',
      request: new Request('http://local/api/payments/order-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'paid', orderId: 'ord_1' }),
      }),
      expectStatus: [401],
      expectOkFalse: true,
      expectCode: 'AUTH',
    },
    {
      name: 'POST order-credit phase inválida',
      request: new Request('http://local/api/payments/order-credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer fake',
        },
        body: JSON.stringify({ phase: 'nope', orderId: 'ord_1' }),
      }),
      expectStatus: [400],
      expectOkFalse: true,
      expectCode: 'INVALID',
    },
    {
      name: 'POST pix body vazio (não 404)',
      request: new Request('http://local/api/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      expectStatus: [400, 422, 503],
    },
  ];

  for (const c of cases) {
    await runCase(c);
  }
  await httpHealth();
  console.log('\npayments:check OK');
}

main().catch((e) => {
  console.error('\npayments:check FAIL', e?.message || e);
  process.exit(1);
});
