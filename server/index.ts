/**
 * Servidor HTTP Peça Já — frota + plataforma + pagamentos.
 * Deploy: Railway / Render / Fly — DATABASE_URL + PORT + MP_ACCESS_TOKEN.
 *
 * Local: npm run fleet:server
 * App: EXPO_PUBLIC_API_URL=http://SEU_IP:8787  + EXPO_PUBLIC_USE_FLEET_SERVER=1
 */
import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fleetPersistenceMode } from '@/services/fleetStore';
import { pingPlatformDb, platformPersistenceMode } from '@/services/platformStore';
import { handleFleetRequest } from '@/server/fleetHttp';
import { handlePlatformRequest } from '@/server/platformHttp';
import { handlePaymentsRequest } from '@/server/paymentsHttp';
import { PRIVACY_POLICY_HTML } from '@/server/privacyPolicy';
import { APOIADORES_HTML, BENEFICIOS_HTML } from '@/server/apoiadoresPage';
import {
  applyCors,
  checkKeyedRateLimit,
  checkRateLimit,
  clearPinFailures,
  pinLockRemaining,
  registerPinFailure,
  securityResponseHeaders,
} from '@/server/security';

function publicPdfPath(fileName: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'server', 'public', fileName),
    path.join(process.cwd(), 'docs', fileName),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function sendPdf(res: http.ServerResponse, fileName: string, downloadName: string) {
  const pdfPath = publicPdfPath(fileName);
  if (!pdfPath) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: `PDF ${downloadName} não encontrado.` }));
    return;
  }
  const buf = fs.readFileSync(pdfPath);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Length': buf.length,
    'Content-Disposition': `inline; filename="${downloadName}"`,
    'Cache-Control': 'public, max-age=300',
  });
  res.end(buf);
}

const PORT = Number(process.env.PORT || process.env.FLEET_PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

function assertProductionPersistence() {
  if (!IS_PROD) return;
  if (platformPersistenceMode() !== 'postgres' || fleetPersistenceMode() !== 'postgres') {
    console.error(
      '[pecaja-api] FATAL: em production é obrigatório DATABASE_URL (Postgres). Fallback .data/ é proibido.'
    );
    process.exit(1);
  }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function toFetchRequest(req: http.IncomingMessage, url: URL, raw: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  };
  const auth = req.headers.authorization || req.headers.Authorization;
  if (typeof auth === 'string' && auth.trim()) {
    headers.Authorization = auth;
  }
  const xSig = req.headers['x-signature'];
  if (typeof xSig === 'string' && xSig.trim()) headers['x-signature'] = xSig;
  const xRid = req.headers['x-request-id'];
  if (typeof xRid === 'string' && xRid.trim()) headers['x-request-id'] = xRid;
  return new Request(`http://local${url.pathname}${url.search}`, {
    method: req.method || 'GET',
    headers,
    body:
      req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
        ? raw || undefined
        : undefined,
  });
}

function applySecHeaders(res: http.ServerResponse) {
  for (const [k, v] of Object.entries(securityResponseHeaders())) {
    res.setHeader(k, v);
  }
}

assertProductionPersistence();

const server = http.createServer(async (req, res) => {
  applySecHeaders(res);
  const corsOk = applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(corsOk ? 204 : 403);
    res.end();
    return;
  }

  try {
    if (req.method && !['GET', 'POST', 'OPTIONS', 'HEAD'].includes(req.method)) {
      res.writeHead(405, {
        'Content-Type': 'application/json',
        Allow: 'GET, POST, OPTIONS, HEAD',
      });
      res.end(JSON.stringify({ ok: false, code: 'METHOD', message: 'Method not allowed.' }));
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Rate limit: pagamentos e admin da frota
    if (url.pathname.startsWith('/api/payments') && req.method === 'POST') {
      const isWebhook = url.pathname.includes('/webhook');
      const rl = isWebhook
        ? checkRateLimit(req, 'webhook', 120, 60_000)
        : checkRateLimit(req, 'payments', 10, 60_000);
      if (!rl.ok) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfter),
        });
        res.end(JSON.stringify({ ok: false, code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde.' }));
        return;
      }
    }

    if (url.pathname === '/health' || url.pathname === '/') {
      const fleet = fleetPersistenceMode();
      const platform = platformPersistenceMode();
      if (IS_PROD && (fleet !== 'postgres' || platform !== 'postgres')) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
        return;
      }

      try {
        await pingPlatformDb();
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
        return;
      }

      // Produção: só ok. Staging/local pode pedir ?detail=1
      const detail =
        !IS_PROD && (url.searchParams.get('detail') === '1' || url.searchParams.get('detail') === 'true');
      if (detail) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            service: 'pecaja-api',
            fleet,
            platform,
            db: 'up',
            payments: !!process.env.MP_ACCESS_TOKEN?.trim(),
            mpConfigured: !!process.env.MP_ACCESS_TOKEN?.trim(),
            time: new Date().toISOString(),
          })
        );
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === '/privacy' || url.pathname === '/privacy/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(PRIVACY_POLICY_HTML);
      return;
    }

    if (url.pathname === '/apoiadores' || url.pathname === '/apoiadores/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      res.end(APOIADORES_HTML);
      return;
    }

    if (url.pathname === '/apoiadores.pdf') {
      sendPdf(res, 'PECA_JA_Apoiadores.pdf', 'PECA_JA_Apoiadores.pdf');
      return;
    }

    if (url.pathname === '/beneficios' || url.pathname === '/beneficios/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      res.end(BENEFICIOS_HTML);
      return;
    }

    if (url.pathname === '/beneficios.pdf') {
      sendPdf(res, 'PECA_JA_Beneficios_Comerciante.pdf', 'PECA_JA_Beneficios_Comerciante.pdf');
      return;
    }

    const raw =
      req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
        ? await readBody(req)
        : '';

    const fetchReq = toFetchRequest(req, url, raw);

    if (url.pathname === '/api/fleet' || url.pathname === '/api/fleet/') {
      if (req.method === 'GET') {
        const rl = checkRateLimit(req, 'fleet-get', 60, 60_000);
        if (!rl.ok) {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfter),
          });
          res.end(JSON.stringify({ ok: false, code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde.' }));
          return;
        }
      }
      // Rate limit + lockout no admin PIN
      let fleetBodyPreview: { action?: string; adminAction?: string; pin?: string } = {};
      try {
        fleetBodyPreview = raw ? JSON.parse(raw) : {};
      } catch {
        fleetBodyPreview = {};
      }
      if (fleetBodyPreview.action === 'admin') {
        const lock = pinLockRemaining(req);
        if (lock > 0) {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': String(lock),
          });
          res.end(
            JSON.stringify({
              ok: false,
              code: 'RATE_LIMIT',
              message: 'Muitas tentativas de PIN. Aguarde.',
            })
          );
          return;
        }
        const rl = checkRateLimit(req, 'fleet-admin', 5, 60_000);
        if (!rl.ok) {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfter),
          });
          res.end(JSON.stringify({ ok: false, code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde.' }));
          return;
        }
      }

      const response = await handleFleetRequest(fetchReq);
      if (fleetBodyPreview.action === 'admin') {
        if (response.status === 403) registerPinFailure(req);
        if (response.status === 200) clearPinFailures(req);
      }
      const body = await response.text();
      res.writeHead(response.status, {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      });
      res.end(body);
      return;
    }

    if (url.pathname === '/api/platform' || url.pathname === '/api/platform/') {
      let platformAction = '';
      let platformEmail = '';
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        platformAction = String(parsed.action || '');
        platformEmail = String(parsed.email || '').trim().toLowerCase();
      } catch {
        platformAction = '';
      }
      if (platformAction === 'login') {
        const rlIp = checkRateLimit(req, 'login', 5, 60_000);
        const rlMail = platformEmail
          ? checkKeyedRateLimit(`login-mail:${platformEmail}`, 10, 60 * 60_000)
          : { ok: true as const };
        if (!rlIp.ok || !rlMail.ok) {
          const retry = !rlIp.ok ? rlIp.retryAfter : (rlMail as { retryAfter: number }).retryAfter;
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': String(retry),
          });
          res.end(JSON.stringify({ ok: false, code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde.' }));
          return;
        }
      }
      if (platformAction === 'request_password_reset') {
        const rlIp = checkRateLimit(req, 'reset', 3, 15 * 60_000);
        const rlMail = platformEmail
          ? checkKeyedRateLimit(`reset:${platformEmail}`, 3, 15 * 60_000)
          : { ok: true as const };
        if (!rlIp.ok || !rlMail.ok) {
          const retry = !rlIp.ok ? rlIp.retryAfter : (rlMail as { retryAfter: number }).retryAfter;
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': String(retry),
          });
          res.end(JSON.stringify({ ok: false, code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde.' }));
          return;
        }
      }
      if (platformAction === 'reset_password') {
        const rl = checkRateLimit(req, `reset-try:${platformEmail || 'none'}`, 5, 15 * 60_000);
        if (!rl.ok) {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfter),
          });
          res.end(JSON.stringify({ ok: false, code: 'RATE_LIMIT', message: 'Muitas tentativas. Aguarde.' }));
          return;
        }
      }
      const response = await handlePlatformRequest(fetchReq);
      const body = await response.text();
      res.writeHead(response.status, {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      });
      res.end(body);
      return;
    }

    if (url.pathname.startsWith('/api/payments')) {
      const response = await handlePaymentsRequest(fetchReq);
      if (response) {
        const body = await response.text();
        res.writeHead(response.status, {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
        });
        res.end(body);
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: 'Not found.' }));
  } catch (err: any) {
    console.error('[pecaja-api]', err?.message || err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: false,
        code: 'SERVER',
        message: IS_PROD ? 'Erro no servidor.' : err?.message || 'Erro no servidor.',
      })
    );
  }
});

server.listen(PORT, HOST, () => {
  const webhookReady = !!(process.env.MP_WEBHOOK_SECRET || '').trim();
  console.log(
    `[pecaja-api] http://${HOST}:${PORT} · fleet=${fleetPersistenceMode()} · platform=${platformPersistenceMode()} · payments=on · webhook=${webhookReady ? 'ok' : 'MISSING'}`
  );
  if (IS_PROD && !webhookReady) {
    console.error('[pecaja-api] CRÍTICO: MP_WEBHOOK_SECRET ausente — eventos do Mercado Pago serão recusados (503).');
  }
  if (platformPersistenceMode() === 'filesystem') {
    console.warn(
      '[pecaja-api] Sem DATABASE_URL — plataforma em .data/platform (ok pra LAN; use Postgres em produção).'
    );
  }
  // Revoga tokens de frota emitidos sem autenticação + limpa probes (auditoria 08/11).
  if (process.env.FLEET_REVOKE_TOKENS_ON_BOOT !== '0') {
    void (async () => {
      try {
        const { revokeAllDriverSessionTokens, purgeProbeDrivers } = await import(
          '@/services/fleetEngine'
        );
        const n = await revokeAllDriverSessionTokens();
        const p = await purgeProbeDrivers();
        if (n > 0) console.log(`[pecaja-api] Revogados ${n} driverToken(s) da frota.`);
        if (p > 0) console.log(`[pecaja-api] Removidos ${p} driver(s) de probe.`);
      } catch (err: any) {
        console.error('[pecaja-api] Falha ao revogar tokens da frota:', err?.message || err);
      }
    })();
  }
  if (
    process.env.PLATFORM_HQ_PROJECTION === '1' ||
    process.env.PLATFORM_HQ_PROJECTION === 'true'
  ) {
    void (async () => {
      try {
        const { loadPlatformState, savePlatformState } = await import('@/services/platformStore');
        const { loadFleetState, saveFleetState } = await import('@/services/fleetStore');
        const { mergeProjectionIntoPlatform, mergeProjectionIntoFleet } = await import(
          '@/services/hqProjectionSeed'
        );
        const { isHqProjectionActive, HQ_YEAR2 } = await import('@/services/hqProjection');
        const state = await loadPlatformState();
        if (!isHqProjectionActive(state) || !(state.orders || []).some((o) => String(o.id).startsWith('proj2y_'))) {
          const { state: next, stats } = mergeProjectionIntoPlatform(state);
          await savePlatformState(next);
          console.log('[pecaja-api] Projeção Ano 2 seed aplicada', stats);
        } else {
          console.log('[pecaja-api]', HQ_YEAR2.label, '· já ativa no state');
        }
        const fleet = await loadFleetState();
        await saveFleetState(mergeProjectionIntoFleet(fleet));
      } catch (err: any) {
        console.error('[pecaja-api] Falha ao aplicar projeção:', err?.message || err);
      }
    })();
  }
});
