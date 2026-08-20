/**
 * Papéis HQ Peça Já (CEO / ops) e bootstrap via PLATFORM_CEO_EMAILS.
 */
import type { PlatformUser } from '@/services/platformTypes';

export type PlatformRole = 'ceo' | 'ops';

export function parseCeoEmails(): string[] {
  const raw = process.env.PLATFORM_CEO_EMAILS?.trim() || '';
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isCeoEmail(email: string): boolean {
  const list = parseCeoEmails();
  if (list.length === 0) return false;
  return list.includes(String(email || '').trim().toLowerCase());
}

export function staffRank(role: PlatformRole | null | undefined): number {
  if (role === 'ceo') return 2;
  if (role === 'ops') return 1;
  return 0;
}

export function hasMinRole(
  role: PlatformRole | null | undefined,
  min: PlatformRole
): boolean {
  return staffRank(role) >= staffRank(min);
}

/** Promove CEO se e-mail estiver na allowlist; nunca rebaixa automaticamente. */
export function applyCeoBootstrap(user: PlatformUser): PlatformUser {
  if (!isCeoEmail(user.email)) return user;
  if (user.platformRole === 'ceo') return user;
  return { ...user, platformRole: 'ceo' };
}

export function isStaffRole(role: PlatformRole | null | undefined): boolean {
  return role === 'ceo' || role === 'ops';
}
