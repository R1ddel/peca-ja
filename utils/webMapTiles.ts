/**
 * Mapa web só com imagens de tile (sem iframe / sem Leaflet).
 * Assim o CSP do site não bloqueia o mapa.
 */

export type MapLatLng = { latitude: number; longitude: number };

const EARTH = 6378137;

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function latLngToWorld(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (clamp(lat, -85.05112878, 85.05112878) * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y, n };
}

export function worldToPixel(
  worldX: number,
  worldY: number,
  center: MapLatLng,
  zoom: number,
  width: number,
  height: number,
  tileSize = 256
) {
  const c = latLngToWorld(center.latitude, center.longitude, zoom);
  const px = (worldX - c.x) * tileSize + width / 2;
  const py = (worldY - c.y) * tileSize + height / 2;
  return { x: px, y: py };
}

export function latLngToPixel(
  point: MapLatLng,
  center: MapLatLng,
  zoom: number,
  width: number,
  height: number,
  tileSize = 256
) {
  const w = latLngToWorld(point.latitude, point.longitude, zoom);
  return worldToPixel(w.x, w.y, center, zoom, width, height, tileSize);
}

/**
 * Tiles OpenStreetMap — sem API key.
 * Espelhos oficiais (a/b/c) + fallback .de se um host falhar no client.
 */
export function tileUrl(z: number, x: number, y: number): string {
  const host = ['a', 'b', 'c'][(Math.abs(x + y) % 3)];
  return `https://${host}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** Fallback se o host principal não carregar. */
export function tileUrlFallback(z: number, x: number, y: number): string {
  return `https://tile.openstreetmap.de/${z}/${x}/${y}.png`;
}

export function tilesForView(
  center: MapLatLng,
  zoom: number,
  width: number,
  height: number,
  tileSize = 256
): {
  key: string;
  url: string;
  fallbackUrl: string;
  left: number;
  top: number;
  size: number;
  z: number;
  x: number;
  y: number;
}[] {
  const z = clamp(Math.round(zoom), 1, 19);
  const c = latLngToWorld(center.latitude, center.longitude, z);
  const tilesX = Math.ceil(width / tileSize) + 2;
  const tilesY = Math.ceil(height / tileSize) + 2;
  const startX = Math.floor(c.x - tilesX / 2);
  const startY = Math.floor(c.y - tilesY / 2);
  const n = 2 ** z;
  const out: {
    key: string;
    url: string;
    fallbackUrl: string;
    left: number;
    top: number;
    size: number;
    z: number;
    x: number;
    y: number;
  }[] = [];

  for (let ix = 0; ix < tilesX; ix++) {
    for (let iy = 0; iy < tilesY; iy++) {
      const tx = startX + ix;
      const ty = startY + iy;
      if (ty < 0 || ty >= n) continue;
      const wrappedX = ((tx % n) + n) % n;
      const left = (tx - c.x) * tileSize + width / 2;
      const top = (ty - c.y) * tileSize + height / 2;
      out.push({
        key: `${z}/${wrappedX}/${ty}`,
        url: tileUrl(z, wrappedX, ty),
        fallbackUrl: tileUrlFallback(z, wrappedX, ty),
        left,
        top,
        size: tileSize,
        z,
        x: wrappedX,
        y: ty,
      });
    }
  }
  return out;
}

/** Distância aproximada em metros (Haversine). */
export function distanceMeters(a: MapLatLng, b: MapLatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

/** ETA grosseira a ~25 km/h (cidade). */
export function formatEta(meters: number): string {
  const minutes = Math.max(1, Math.round((meters / 1000 / 25) * 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
