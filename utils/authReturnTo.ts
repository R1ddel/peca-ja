import { router } from 'expo-router';

/** Rotas internas seguras para redirecionar após login/cadastro. */
const ALLOWED_PREFIXES = [
  '/checkout',
  '/cart',
  '/addresses',
  '/cards',
  '/favorites',
  '/order/',
  '/(tabs)',
  '/profile',
  '/community',
  '/support',
];

export function sanitizeAuthReturnTo(raw?: string | string[] | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.includes('://')) return null;
  if (path.includes('..') || path.includes('//')) return null;
  const ok = ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
  return ok ? path : null;
}

export function loginHref(returnTo?: string | null): `/(auth)/login${string}` | '/(auth)/login' {
  const safe = sanitizeAuthReturnTo(returnTo);
  if (!safe) return '/(auth)/login';
  return `/(auth)/login?returnTo=${encodeURIComponent(safe)}` as `/(auth)/login${string}`;
}

export function navigateAfterAuth(returnTo?: string | string[] | null) {
  const safe = sanitizeAuthReturnTo(returnTo);
  if (safe) {
    router.replace(safe as any);
    return;
  }
  router.replace('/(tabs)');
}
