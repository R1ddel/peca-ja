/**
 * Hash de senha (scrypt) + tokens de sessão — só no servidor / API routes.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function newNumericCode(digits = 8): string {
  const min = 10 ** (digits - 1);
  const span = 9 * min;
  const n = randomBytes(4).readUInt32BE(0) % span + min;
  return String(n);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

export function sessionExpiresAt(days = 30): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Fingerprint estável pra logs (nunca logar senha). */
export function emailKey(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokensMatch(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/** Hash fictício para equalizar tempo de login quando o e-mail não existe. */
let dummyAuth: { salt: string; hash: string } | null = null;
export function dummyPasswordCheck(password: string): void {
  if (!dummyAuth) dummyAuth = hashPassword('timing-pad');
  verifyPassword(password || 'x', dummyAuth.salt, dummyAuth.hash);
}
