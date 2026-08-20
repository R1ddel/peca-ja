/**
 * Utilitários de geolocalização (haversine, raio, formatação).
 */

export type GeoPoint = { latitude: number; longitude: number };

const EARTH_KM = 6371;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return `${Math.max(0.1, Math.round(km * 10) / 10)} km`;
  return `${Math.round(km * 10) / 10} km`;
}

export function isWithinRadius(
  user: GeoPoint,
  shop: GeoPoint,
  radiusKm: number
): boolean {
  return haversineKm(user, shop) <= radiusKm;
}
