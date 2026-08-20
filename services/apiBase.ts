/**
 * Base URL das APIs (pagamentos + frota).
 * Produção: EXPO_PUBLIC_API_URL (ou EXPO_PUBLIC_FLEET_URL só pra frota).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function stripSlash(url: string) {
  return url.replace(/\/$/, '');
}

function expoLanHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    null;
  if (!hostUri) return null;
  return hostUri.split('/')[0]?.split(':')[0] || null;
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return stripSlash(fromEnv);

  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();
  if (fromExtra && !fromExtra.includes('REPLACE')) return stripSlash(fromExtra);

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
  if (fleetOnly) return stripSlash(fleetOnly);

  const api = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (api) return stripSlash(api);

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
