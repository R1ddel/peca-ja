/**
 * Terceira rede de segurança: transforma o endereço do pedido em coordenada.
 * Se o aparelho não geocodificar, o mapa continua com o pin local do endereço.
 */
import * as Location from 'expo-location';
import { isValidLatLng, type LatLng } from '@/utils/orderGeo';

const cache = new Map<string, LatLng | null>();

export async function geocodeAddressLine(
  address: string,
  city?: string | null
): Promise<LatLng | null> {
  const line = address.trim();
  if (line.length < 4) return null;
  const query = [line, city?.trim()].filter(Boolean).join(', ');
  const key = query.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const hits = await Promise.race([
      Location.geocodeAsync(query),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (hits == null) return null;
    if (!hits.length) {
      cache.set(key, null);
      return null;
    }
    const hit = hits.find((item) => isValidLatLng(item.latitude, item.longitude));
    const point = hit
      ? { latitude: hit.latitude, longitude: hit.longitude }
      : null;
    cache.set(key, point);
    return point;
  } catch {
    return null;
  }
}
