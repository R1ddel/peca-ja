/**
 * Modo demo de cidade (GPS + catálogo + mapas + copy).
 * PRODUÇÃO: sempre desligado. Só funciona em __DEV__ (ou EXPO_PUBLIC_ALLOW_DEMO_CITY=1).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type DemoLocationId = 'vale-do-capao' | 'mucuge';

export type DemoLocation = {
  id: DemoLocationId;
  city: string;
  latitude: number;
  longitude: number;
  tagline: string;
};

export const DEMO_LOCATIONS: Record<DemoLocationId, DemoLocation> = {
  'vale-do-capao': {
    id: 'vale-do-capao',
    city: 'Vale do Capão',
    latitude: -12.595,
    longitude: -41.495,
    tagline: 'Chapada Diamantina · Palmeiras/BA',
  },
  mucuge: {
    id: 'mucuge',
    city: 'Mucugê',
    latitude: -13.0054,
    longitude: -41.3706,
    tagline: 'Chapada Diamantina · BA',
  },
};

const STORAGE_KEY = '@pecaja_demo_location_v1';

/** null = GPS real; string = forçar demo; undefined = ainda não hidratou */
let cachedId: string | null | undefined = undefined;
let version = 0;

type Listener = (next: DemoLocation | null) => void;
const listeners = new Set<Listener>();

/** Demo de cidade só em desenvolvimento. */
export function isDemoCityAllowed(): boolean {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  return (process.env.EXPO_PUBLIC_ALLOW_DEMO_CITY || '').trim() === '1';
}

function envDemoId(): DemoLocationId | null {
  if (!isDemoCityAllowed()) return null;
  const raw = (process.env.EXPO_PUBLIC_DEMO_LOCATION || '').trim().toLowerCase();
  if (!raw || raw === '0' || raw === 'off' || raw === 'false') return null;
  if (raw === 'capao' || raw === 'vale-do-capao' || raw === 'vale_do_capao') {
    return 'vale-do-capao';
  }
  if (raw === 'mucuge') return 'mucuge';
  return null;
}

function parseStoredId(raw: string): DemoLocationId | null {
  if (!raw || raw === 'off' || raw === '') return null;
  if (raw === 'vale-do-capao' || raw === 'capao') return 'vale-do-capao';
  if (raw === 'mucuge') return 'mucuge';
  return null;
}

function notify() {
  version += 1;
  const next = getActiveDemoLocation();
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore */
    }
  });
}

export function getDemoLocationVersion(): number {
  return version;
}

export function subscribeDemoLocation(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function hydrateDemoLocation(): Promise<DemoLocation | null> {
  if (!isDemoCityAllowed()) {
    cachedId = null;
    notify();
    return null;
  }
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      cachedId = envDemoId();
      // Web dev: sem GPS, catálogo demo evita home vazia nos testes no browser.
      if (
        !cachedId &&
        typeof __DEV__ !== 'undefined' &&
        __DEV__ &&
        Platform.OS === 'web'
      ) {
        cachedId = 'mucuge';
        await AsyncStorage.setItem(STORAGE_KEY, 'mucuge');
      }
    } else {
      cachedId = parseStoredId(stored);
    }
  } catch {
    cachedId = envDemoId();
  }
  notify();
  return getActiveDemoLocation();
}

/** Sync — use após hydrate (ou cai no .env). Em produção sempre null. */
export function getDemoLocationIdSync(): DemoLocationId | null {
  if (!isDemoCityAllowed()) return null;
  if (cachedId === undefined) {
    cachedId = envDemoId();
  }
  if (!cachedId) return null;
  return parseStoredId(String(cachedId));
}

export function getActiveDemoLocation(): DemoLocation | null {
  const id = getDemoLocationIdSync();
  return id ? DEMO_LOCATIONS[id] : null;
}

export function isDemoLocationActive(): boolean {
  return getActiveDemoLocation() != null;
}

/**
 * Nome da cidade para UI: demo ativa → cidade demo;
 * senão o label do GPS / fallback neutro (nunca força Mucugê).
 */
export function getSimulatedCityLabel(gpsCity?: string | null): string {
  const demo = getActiveDemoLocation();
  if (demo) return demo.city;
  const gps = (gpsCity || '').trim();
  return gps || 'sua cidade';
}

export async function setDemoLocation(
  id: DemoLocationId | null
): Promise<DemoLocation | null> {
  if (!isDemoCityAllowed()) {
    cachedId = null;
    notify();
    return null;
  }
  cachedId = id;
  try {
    if (id == null) {
      await AsyncStorage.setItem(STORAGE_KEY, 'off');
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    /* ignore */
  }
  notify();
  return getActiveDemoLocation();
}

export function getDemoGeoCenter(): { latitude: number; longitude: number } | null {
  const d = getActiveDemoLocation();
  if (!d) return null;
  return { latitude: d.latitude, longitude: d.longitude };
}

/** Token curto para mpAccessToken / seeds. */
export function getDemoTokenCity(): string {
  const id = getDemoLocationIdSync();
  if (id === 'vale-do-capao') return 'CAPAO';
  if (id === 'mucuge') return 'MUCUGE';
  return 'LOCAL';
}
