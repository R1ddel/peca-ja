/**
 * Hardening HTTP da API Peça Já (CORS, rate limit, headers).
 */
import type http from 'http';
import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_ORIGINS = [
  'https://peca-ja.expo.app',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
];

function parseAllowlist(): string[] {
  const raw = (process.env.CORS_ALLOWED_ORIGINS || '').trim();
  const fromEnv = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const merged = [...DEFAULT_ORIGINS, ...fromEnv];
  return Array.from(new Set(merged));
}

/** Aplica CORS com allowlist. Nunca usa *. */
export function applyCors(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  const origin = String(req.headers.origin || '').trim();
  const allowed = parseAllowlist();
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-Id'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    return true;
  }
  // Sem Origin (curl/server-to-server): não espelha CORS.
  return false;
}

type Bucket = { count: number; resetAt: number; fails: number; lockUntil: number };

const buckets = new Map<string, Bucket>();

function clientIp(req: http.IncomingMessage): string {
  const xf = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    ?.trim();
  return xf || req.socket.remoteAddress || 'unknown';
}

function bumpBucket(
  id: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  let b = buckets.get(id);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs, fails: b?.fails || 0, lockUntil: b?.lockUntil || 0 };
    buckets.set(id, b);
  }
  if (b.lockUntil > now) {
    return { ok: false, retryAfter: Math.ceil((b.lockUntil - now) / 1000) };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true };
}

/** Limite simples em memória por IP+chave. Retorna Retry-After em segundos se bloqueado. */
export function checkRateLimit(
  req: http.IncomingMessage,
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  return bumpBucket(`${clientIp(req)}:${key}`, limit, windowMs);
}

/** Limite global por chave (ex.: e-mail), independente do IP. */
export function checkKeyedRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  return bumpBucket(`keyed:${key}`, limit, windowMs);
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
}

/** Lockout progressivo após PIN errado (admin). */
export function registerPinFailure(req: http.IncomingMessage): number {
  const id = `${clientIp(req)}:admin-pin`;
  const now = Date.now();
  let b = buckets.get(id);
  if (!b) {
    b = { count: 0, resetAt: now + 60_000, fails: 0, lockUntil: 0 };
    buckets.set(id, b);
  }
  b.fails += 1;
  // 5 falhas → 1 min; 10 → 5 min; 15+ → 30 min
  if (b.fails >= 15) b.lockUntil = now + 30 * 60_000;
  else if (b.fails >= 10) b.lockUntil = now + 5 * 60_000;
  else if (b.fails >= 5) b.lockUntil = now + 60_000;
  return b.fails;
}

export function clearPinFailures(req: http.IncomingMessage) {
  const id = `${clientIp(req)}:admin-pin`;
  const b = buckets.get(id);
  if (b) {
    b.fails = 0;
    b.lockUntil = 0;
  }
}

export function pinLockRemaining(req: http.IncomingMessage): number {
  const id = `${clientIp(req)}:admin-pin`;
  const b = buckets.get(id);
  if (!b || b.lockUntil <= Date.now()) return 0;
  return Math.ceil((b.lockUntil - Date.now()) / 1000);
}

/**
 * Valida assinatura do webhook Mercado Pago (x-signature + x-request-id).
 * @see https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function verifyMercadoPagoWebhookSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = input;
  if (!secret || !xSignature || !xRequestId || !dataId) return false;

  const parts: Record<string, string> = {};
  for (const part of xSignature.split(',')) {
    const [k, v] = part.split('=').map((s) => s.trim());
    if (k && v) parts[k] = v;
  }
  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function securityResponseHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  };
}
