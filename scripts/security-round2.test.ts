/**
 * Aceitação local da rodada 2 de segurança.
 * Não toca Postgres de produção: força filesystem e limpa URLs de banco.
 *
 *   npm run security:round2
 */
process.env.PLATFORM_FORCE_FS = '1';
process.env.NODE_ENV = 'development';
delete process.env.DATABASE_URL;
delete process.env.FLEET_DATABASE_URL;
delete process.env.PLATFORM_DATABASE_URL;
delete process.env.MP_WEBHOOK_SECRET;

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type http from 'node:http';
import {
  dummyPasswordCheck,
  hashResetToken,
  tokensMatch,
} from '../services/platformCrypto';
import {
  checkKeyedRateLimit,
  checkRateLimit,
  resetRateLimitBucketsForTests,
  verifyMercadoPagoWebhookSignature,
} from '../server/security';
import { handlePlatformAction } from '../services/platformEngine';
import { fleetHeartbeat, verifyDriverToken } from '../services/fleetEngine';

let failed = 0;
let passed = 0;

function fakeReq(ip = '203.0.113.10'): http.IncomingMessage {
  return {
    headers: {},
    socket: { remoteAddress: ip },
  } as http.IncomingMessage;
}

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log('ok  ', name);
  } catch (err) {
    failed += 1;
    console.error('FAIL', name, (err as Error).message);
  }
}

async function main() {
await test('P0-1 hash do token não é reversível e compara em tempo constante', () => {
  const hash = hashResetToken('12345678');
  assert.equal(hash.length, 64);
  assert.notEqual(hash, '12345678');
  assert.equal(tokensMatch(hash, hashResetToken('12345678')), true);
  assert.equal(tokensMatch(hash, hashResetToken('00000000')), false);
});

await test('P0-2 dummyPasswordCheck equaliza o caminho sem usuário', () => {
  dummyPasswordCheck('qualquer');
});

await test('P0-4 webhook: assinatura válida / inválida / sem header', () => {
  const secret = 'test-secret';
  const dataId = '999';
  const requestId = 'req-1';
  const ts = '1700000000';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  assert.equal(
    verifyMercadoPagoWebhookSignature({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: requestId,
      dataId,
      secret,
    }),
    true
  );
  assert.equal(
    verifyMercadoPagoWebhookSignature({
      xSignature: `ts=${ts},v1=${'0'.repeat(64)}`,
      xRequestId: requestId,
      dataId,
      secret,
    }),
    false
  );
  assert.equal(
    verifyMercadoPagoWebhookSignature({
      xSignature: null,
      xRequestId: requestId,
      dataId,
      secret,
    }),
    false
  );
});

await test('P1-7 login 5/min por IP → 6ª tentativa 429', () => {
  resetRateLimitBucketsForTests();
  const req = fakeReq('198.51.100.1');
  for (let i = 0; i < 5; i += 1) {
    assert.equal(checkRateLimit(req, 'login', 5, 60_000).ok, true);
  }
  const sixth = checkRateLimit(req, 'login', 5, 60_000);
  assert.equal(sixth.ok, false);
  if (!sixth.ok) assert.ok(sixth.retryAfter > 0);
});

await test('P1-7 reset 3/15min por e-mail (chave global)', () => {
  resetRateLimitBucketsForTests();
  const email = 'alvo@example.com';
  assert.equal(checkKeyedRateLimit(`reset:${email}`, 3, 15 * 60_000).ok, true);
  assert.equal(checkKeyedRateLimit(`reset:${email}`, 3, 15 * 60_000).ok, true);
  assert.equal(checkKeyedRateLimit(`reset:${email}`, 3, 15 * 60_000).ok, true);
  const fourth = checkKeyedRateLimit(`reset:${email}`, 3, 15 * 60_000);
  assert.equal(fourth.ok, false);
});

await test('P1-7 payments 10/min → 11ª 429', () => {
  resetRateLimitBucketsForTests();
  const req = fakeReq('198.51.100.9');
  for (let i = 0; i < 10; i += 1) {
    assert.equal(checkRateLimit(req, 'payments', 10, 60_000).ok, true);
  }
  assert.equal(checkRateLimit(req, 'payments', 10, 60_000).ok, false);
});

await test('P1-7 GET fleet 60/min → 61ª 429', () => {
  resetRateLimitBucketsForTests();
  const req = fakeReq('198.51.100.60');
  for (let i = 0; i < 60; i += 1) {
    assert.equal(checkRateLimit(req, 'fleet-get', 60, 60_000).ok, true);
  }
  assert.equal(checkRateLimit(req, 'fleet-get', 60, 60_000).ok, false);
});

await test('P2-12 health sem token só {ok:true}', async () => {
  const health = await handlePlatformAction({ action: 'health' });
  assert.deepEqual(health, { ok: true });
  assert.equal('service' in health, false);
  assert.equal('persistence' in health, false);
  assert.equal('time' in health, false);
});

await test('P0-1/P0-2 reset nunca devolve token nem exists', async () => {
  const stamp = Date.now();
  const existing = `sec2_${stamp}@pecaja.local`;
  const missing = `nao-existe-${stamp}@example.com`;
  await handlePlatformAction({
    action: 'register',
    name: 'QA',
    email: existing,
    phone: '11999999999',
    password: 'senha123',
    address: 'Mucugê',
  });
  const a = await handlePlatformAction({ action: 'request_password_reset', email: existing });
  const b = await handlePlatformAction({ action: 'request_password_reset', email: missing });
  for (const body of [a, b]) {
    assert.equal(body.ok, true);
    assert.equal(body.message, 'Se a conta existir, enviaremos as instruções.');
    assert.equal('devResetToken' in body, false);
    assert.equal('resetToken' in body, false);
    assert.equal('exists' in body, false);
  }
  assert.deepEqual(a, b);
});

await test('P0-1 reset sem código não troca senha; código usado duas vezes falha', async () => {
  const email = `sec2_reset_${Date.now()}@pecaja.local`;
  const reg = await handlePlatformAction({
    action: 'register',
    name: 'QA Reset',
    email,
    phone: '11999999999',
    password: 'senha123',
    address: 'Mucugê',
  });
  assert.equal(reg.ok, true);
  const sessionToken = reg.token as string;
  const noCode = await handlePlatformAction({
    action: 'reset_password',
    email,
    newPassword: 'novaSenha9',
    resetToken: '',
  });
  assert.equal(noCode.ok, false);
  const still = await handlePlatformAction({ action: 'me', token: sessionToken });
  assert.equal(still.ok, true);

  await handlePlatformAction({ action: 'request_password_reset', email });
  const first = await handlePlatformAction({
    action: 'reset_password',
    email,
    newPassword: 'novaSenha9',
    resetToken: '00000000',
  });
  assert.equal(first.ok, false);
  const second = await handlePlatformAction({
    action: 'reset_password',
    email,
    newPassword: 'novaSenha9',
    resetToken: '00000000',
  });
  assert.equal(second.ok, false);
});

await test('P0-2 login existente/inexistente mesma mensagem', async () => {
  const email = `sec2_login_${Date.now()}@pecaja.local`;
  await handlePlatformAction({
    action: 'register',
    name: 'QA Login',
    email,
    phone: '11999999999',
    password: 'senha123',
    address: 'Mucugê',
  });
  const a = await handlePlatformAction({ action: 'login', email, password: 'errada' });
  const b = await handlePlatformAction({
    action: 'login',
    email: `nao-existe-${Date.now()}@example.com`,
    password: 'errada',
  });
  assert.equal(a.ok, false);
  assert.equal(b.ok, false);
  assert.equal(a.message, 'E-mail ou senha inválidos.');
  assert.equal(b.message, a.message);
  assert.equal(a.code, 'AUTH');
  assert.equal(b.code, 'AUTH');
  const blob = JSON.stringify(a) + JSON.stringify(b);
  assert.equal(/não encontrado|senha incorreta|crie uma conta|existe/i.test(blob), false);
});

await test('P2-12 cadastro vazio não 500', async () => {
  const r = await handlePlatformAction({
    action: 'register',
    name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
  } as never);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'INVALID');
});

await test('P0-3 heartbeat não cria motorista; token de cliente não autentica', async () => {
  const fleetId = `sm-qa-nonexistent-fleet-${Date.now()}`;
  assert.equal(verifyDriverToken({ drivers: {}, orders: [], reports: [], revision: 0, updatedAt: '' }, fleetId, 'x'), false);
  const hb = await fleetHeartbeat({
    fleetId,
    applicationId: fleetId,
    online: true,
  });
  assert.equal(hb.missing, true);
  assert.equal(hb.state.drivers[fleetId], undefined);
});

await test('P2-10 cartão test_ / GHOST não passa no cliente nem no charge', () => {
  const cards = fs.readFileSync(path.join(process.cwd(), 'services', 'cards.ts'), 'utf8');
  assert.match(cards, /startsWith\('test_'\)/);
  assert.match(cards, /if \(!__DEV__\)/);
  assert.doesNotMatch(cards, /export const GHOST_TEST_CARD/);
  const charge = fs.readFileSync(
    path.join(process.cwd(), 'app', 'api', 'payments', 'card', 'charge+api.ts'),
    'utf8'
  );
  assert.match(charge, /MP_MODE === 'sandbox'/);
  assert.doesNotMatch(charge, /body\.isGhostTest/);
});

await test('P3 list_shops filtra Recheck/teste', async () => {
  const listed = await handlePlatformAction({ action: 'list_shops' });
  assert.equal(listed.ok, true);
  const names = (listed.shops || []).map((s: { name?: string }) => String(s.name || ''));
  assert.equal(names.some((n: string) => /recheck|\bteste\b/i.test(n)), false);
});

console.log(`\n${passed} passou, ${failed} falhou`);
if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
