/**
 * Base URL das APIs (pagamentos + frota).
 * Produção: EXPO_PUBLIC_API_URL (ou EXPO_PUBLIC_FLEET_URL só pra frota).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function stripSlash(url: string) {
  return url.replace(/\/$/, '');
}

/** No celular, localhost é o próprio aparelho. Troca pelo IP do Expo na mesma porta. */
function rewriteLocalhostForDevice(url: string): string {
  if (Platform.OS === 'web') return stripSlash(url);
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return stripSlash(url);
    }
    const lan = expoLanHost();
    if (!lan || lan === 'localhost' || lan === '127.0.0.1') return stripSlash(url);
    parsed.hostname = lan;
    return stripSlash(parsed.toString());
  } catch {
    return stripSlash(url);
  }
}

function expoLanHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    null;
  if (!hostUri) return null;
  return hostUri.split('/')[0]?.split(':')[0] || null;
}

function dedicatedApiFromEnv(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!fromEnv) return null;
  try {
    const envHost = new URL(fromEnv).hostname.toLowerCase();
    // API própria (Railway etc.) — não usar o front Expo Hosting como backend
    if (
      envHost.includes('railway.app') ||
      envHost.includes('up.railway.app') ||
      envHost.startsWith('api.')
    ) {
      return stripSlash(fromEnv);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getApiBaseUrl(): string {
  const dedicated = dedicatedApiFromEnv();
  if (dedicated) return dedicated;

  // Túnel público (loca.lt / cloudflare): usa a mesma origem e o Metro faz proxy pra :8787
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return stripSlash(window.location.origin);
    }
  }

  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return rewriteLocalhostForDevice(fromEnv);

  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();
  if (fromExtra && !fromExtra.includes('REPLACE')) return rewriteLocalhostForDevice(fromExtra);

  const useDedicated =
    process.env.EXPO_PUBLIC_USE_FLEET_SERVER === '1' ||
    process.env.EXPO_PUBLIC_USE_FLEET_SERVER === 'true';

  if (useDedicated) {
    const lan = expoLanHost();
    const port = process.env.EXPO_PUBLIC_FLEET_PORT?.trim() || '8787';
    if (lan) return `http://${lan}:${port}`;
    if (Platform.OS === 'web') return `http://localhost:${port}`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    null;

  if (hostUri) {
    const host = hostUri.split('/')[0];
    return `http://${host}`;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:8081';
}

/**
 * Host da frota. Preferências:
 * 1) EXPO_PUBLIC_FLEET_URL
 * 2) EXPO_PUBLIC_API_URL
 * 3) Se EXPO_PUBLIC_USE_FLEET_SERVER=1 → mesmo IP do Expo na porta 8787
 * 4) Metro / getApiBaseUrl()
 */
export function getFleetBaseUrl(): string {
  const fleetOnly = process.env.EXPO_PUBLIC_FLEET_URL?.trim();
  if (fleetOnly) {
    try {
      const h = new URL(fleetOnly).hostname.toLowerCase();
      if (h.includes('railway.app') || h.startsWith('api.')) {
        return stripSlash(fleetOnly);
      }
    } catch {
      /* fall through */
    }
  }

  const dedicated = dedicatedApiFromEnv();
  if (dedicated) return dedicated;

  // No link público, localhost seria o celular de quem abriu — não o servidor.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return stripSlash(window.location.origin);
    }
  }

  if (fleetOnly) return rewriteLocalhostForDevice(fleetOnly);

  const api = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (api) return rewriteLocalhostForDevice(api);

  const useDedicated =
    process.env.EXPO_PUBLIC_USE_FLEET_SERVER === '1' ||
    process.env.EXPO_PUBLIC_USE_FLEET_SERVER === 'true';

  if (useDedicated) {
    const lan = expoLanHost();
    const port = process.env.EXPO_PUBLIC_FLEET_PORT?.trim() || '8787';
    if (lan) return `http://${lan}:${port}`;
    if (Platform.OS === 'web') return `http://localhost:${port}`;
  }

  return getApiBaseUrl();
}
