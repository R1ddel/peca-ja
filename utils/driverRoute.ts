/**
 * Rota do entregador — melhor caminho por ruas (OSRM) + fallback local.
 */
import type { LatLng } from '@/utils/orderGeo';

const EARTH_KM = 6371;
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/** ETA em moto urbana (~22 km/h) + 2 min de margem. */
export function estimateMinutes(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 1;
  return Math.max(1, Math.round((km / 22) * 60) + 2);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Arredonda coords p/ evitar refetch a cada metro do GPS. */
export function routeKey(a: LatLng, b: LatLng): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(a.latitude)},${r(a.longitude)}>${r(b.latitude)},${r(b.longitude)}`;
}

/**
 * Fallback offline: curva estável A→B (nunca falha).
 */
export function buildRouteCoordinates(
  from: LatLng,
  to: LatLng,
  steps = 28
): LatLng[] {
  const n = Math.max(8, Math.min(60, steps));
  const midLat = (from.latitude + to.latitude) / 2;
  const midLng = (from.longitude + to.longitude) / 2;
  const dLat = to.latitude - from.latitude;
  const dLng = to.longitude - from.longitude;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng) || 0.001;
  const bend = Math.min(0.0045, dist * 0.22);
  const seed =
    Math.abs(from.latitude * 1000) +
    Math.abs(to.longitude * 1000) +
    Math.abs(dLat * 500);
  const sign = seed % 2 === 0 ? 1 : -1;
  const ctrl: LatLng = {
    latitude: midLat + sign * (-dLng / dist) * bend,
    longitude: midLng + sign * (dLat / dist) * bend,
  };

  const out: LatLng[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const lat =
      (1 - t) * (1 - t) * from.latitude +
      2 * (1 - t) * t * ctrl.latitude +
      t * t * to.latitude;
    const lng =
      (1 - t) * (1 - t) * from.longitude +
      2 * (1 - t) * t * ctrl.longitude +
      t * t * to.longitude;
    out.push({
      latitude: Math.round(lat * 1e6) / 1e6,
      longitude: Math.round(lng * 1e6) / 1e6,
    });
  }
  return out;
}

export type RouteSource = 'osrm' | 'local';

export type RouteLeg = {
  from: LatLng;
  to: LatLng;
  coordinates: LatLng[];
  distanceKm: number;
  minutes: number;
  label: string;
  source: RouteSource;
};

export function buildDeliveryLeg(
  from: LatLng,
  to: LatLng,
  label: string
): RouteLeg {
  const coordinates = buildRouteCoordinates(from, to);
  const distanceKm = haversineKm(from, to);
  return {
    from,
    to,
    coordinates,
    distanceKm,
    minutes: estimateMinutes(distanceKm),
    label,
    source: 'local',
  };
}

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry?: { coordinates?: [number, number][] };
};

/**
 * Melhor rota por ruas (OSRM público).
 * Escolhe a alternativa com menor distância. Em falha → fallback local.
 */
export async function resolveBestRouteLeg(
  from: LatLng,
  to: LatLng,
  label: string
): Promise<RouteLeg> {
  const fallback = buildDeliveryLeg(from, to, label);
  try {
    const url =
      `${OSRM_BASE}/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?overview=full&geometries=geojson&alternatives=true&steps=false`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) return fallback;

    const data = (await response.json()) as {
      code?: string;
      routes?: OsrmRoute[];
    };

    if (data.code !== 'Ok' || !data.routes?.length) return fallback;

    const best = data.routes.reduce((a, b) =>
      a.distance <= b.distance ? a : b
    );
    const raw = best.geometry?.coordinates;
    if (!raw?.length) return fallback;

    const coordinates: LatLng[] = raw.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    const distanceKm = best.distance / 1000;
    const minutes = Math.max(1, Math.round(best.duration / 60));

    return {
      from,
      to,
      coordinates,
      distanceKm,
      minutes,
      label,
      source: 'osrm',
    };
  } catch {
    return fallback;
  }
}

/** Interpola um ponto ao longo da polyline (0..1). */
export function pointAlongRoute(coords: LatLng[], t: number): LatLng {
  if (!coords.length) return { latitude: 0, longitude: 0 };
  if (coords.length === 1) return coords[0];
  const clamped = Math.max(0, Math.min(1, t));
  const f = clamped * (coords.length - 1);
  const i = Math.floor(f);
  const frac = f - i;
  const a = coords[i];
  const b = coords[Math.min(i + 1, coords.length - 1)];
  return {
    latitude: lerp(a.latitude, b.latitude, frac),
    longitude: lerp(a.longitude, b.longitude, frac),
  };
}
