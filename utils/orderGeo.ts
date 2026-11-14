/**
 * Coordenadas de entrega/loja — sempre determinísticas.
 * Sem geocode de rede: mesmo endereço = mesmo pin, nunca falha.
 */

export type LatLng = { latitude: number; longitude: number };

/** Centro de Mucugê-BA (âncora padrão). */
export const MUCUGE_CENTER: LatLng = {
  latitude: -13.0054,
  longitude: -41.3706,
};

/** Centro do Vale do Capão (Palmeiras/BA). */
export const CAPAO_CENTER: LatLng = {
  latitude: -12.595,
  longitude: -41.495,
};

function activeMapCenter(): LatLng {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDemoGeoCenter } = require('@/utils/demoLocation') as {
      getDemoGeoCenter: () => LatLng | null;
    };
    return getDemoGeoCenter() || MUCUGE_CENTER;
  } catch {
    return MUCUGE_CENTER;
  }
}

/** Pontos fixos conhecidos (endereços demo + ruas reais da cidade). */
const FIXED_ADDRESS_COORDS: Record<string, LatLng> = {
  'rua das flores, 120 — mucugê': { latitude: -13.0038, longitude: -41.3689 },
  'rua das flores, 120': { latitude: -13.0038, longitude: -41.3689 },
  'av. coronel durval, 45 — mucugê': { latitude: -13.0069, longitude: -41.3722 },
  'av. coronel durval, 45': { latitude: -13.0069, longitude: -41.3722 },
  'praça coronel douca, 10 — mucugê': { latitude: -13.0049, longitude: -41.3711 },
  'praça coronel douca, 10': { latitude: -13.0049, longitude: -41.3711 },
  'rua principal, 50 — vale do capão': { latitude: -12.5942, longitude: -41.4941 },
  'pousada centro — vale do capão': { latitude: -12.5958, longitude: -41.4962 },
};

const FIXED_BUSINESS_COORDS: Record<string, LatLng> = {
  demo_fair_pizza: { latitude: -13.0072, longitude: -41.3695 },
  demo_fair_burger: { latitude: -13.0029, longitude: -41.3734 },
  demo_fair_acai: { latitude: -13.0051, longitude: -41.3682 },
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Hash estável → número 0..1 */
function stableUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Desloca o centro ativo (Mucugê ou demo Capão) de forma fixa a partir do texto
 * (raio ~1,8 km — área urbana típica).
 */
export function coordsFromSeed(seed: string, base?: LatLng): LatLng {
  const origin = base || activeMapCenter();
  const a = stableUnit(seed);
  const b = stableUnit(`${seed}::b`);
  const angle = a * Math.PI * 2;
  const radiusKm = 0.25 + b * 1.55;
  const dLat = (radiusKm / 111.32) * Math.cos(angle);
  const dLng =
    (radiusKm / (111.32 * Math.cos((origin.latitude * Math.PI) / 180))) *
    Math.sin(angle);
  return {
    latitude: round6(origin.latitude + dLat),
    longitude: round6(origin.longitude + dLng),
  };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function isValidLatLng(
  lat?: number | null,
  lng?: number | null
): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Destino do cliente no pedido. */
export function resolveDeliveryCoords(
  address: string,
  hint?: Partial<LatLng> | null
): LatLng {
  const hintLat = hint?.latitude;
  const hintLng = hint?.longitude;
  if (isValidLatLng(hintLat, hintLng)) {
    return {
      latitude: round6(hintLat as number),
      longitude: round6(hintLng as number),
    };
  }
  const key = normalizeKey(address || 'cidade');
  const demoCenter = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDemoGeoCenter } = require('@/utils/demoLocation') as {
        getDemoGeoCenter: () => LatLng | null;
      };
      return getDemoGeoCenter();
    } catch {
      return null;
    }
  })();

  // Em produção (sem demo): sem hint válido, não inventa pin — usa centro só se demo
  if (!demoCenter) {
    if (FIXED_ADDRESS_COORDS[key]) return FIXED_ADDRESS_COORDS[key];
    for (const [k, v] of Object.entries(FIXED_ADDRESS_COORDS)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
    // Sem geocode: ancora em hash só como último recurso local (dev)
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return coordsFromSeed(`delivery:${key}`);
    }
    return MUCUGE_CENTER;
  }
  if (FIXED_ADDRESS_COORDS[key] && !/mucug/.test(key)) {
    return FIXED_ADDRESS_COORDS[key];
  }
  return coordsFromSeed(`delivery:${key}`, demoCenter);
}

/** Ponto da loja (retirada). Preferir lat/lng reais via `utils/merchantPin`. */
export function resolveBusinessCoords(
  businessId: string,
  businessName?: string,
  hint?: Partial<LatLng> | null
): LatLng {
  if (isValidLatLng(hint?.latitude, hint?.longitude)) {
    return {
      latitude: round6(hint!.latitude as number),
      longitude: round6(hint!.longitude as number),
    };
  }
  if (FIXED_BUSINESS_COORDS[businessId]) return FIXED_BUSINESS_COORDS[businessId];
  return coordsFromSeed(`shop:${businessId || businessName || 'loja'}`);
}

export function regionFitting(
  points: LatLng[],
  pad = 1.35
): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  const list = points.filter((p) => isValidLatLng(p.latitude, p.longitude));
  if (!list.length) {
    const center = activeMapCenter();
    return {
      ...center,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }
  let minLat = list[0].latitude;
  let maxLat = list[0].latitude;
  let minLng = list[0].longitude;
  let maxLng = list[0].longitude;
  for (const p of list) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max(0.012, (maxLat - minLat) * pad || 0.02);
  const longitudeDelta = Math.max(0.012, (maxLng - minLng) * pad || 0.02);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}
