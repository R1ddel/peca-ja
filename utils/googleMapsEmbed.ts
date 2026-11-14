/**
 * URLs do Google Maps para embutir no app (web) e deep links.
 * Sem API key — usa o embed clássico com lat/lng explícitos.
 */

export type MapPoint = { latitude: number; longitude: number };

function ll(p: MapPoint): string {
  return `${Number(p.latitude).toFixed(6)},${Number(p.longitude).toFixed(6)}`;
}

/** Mapa embutido centrado no pin (rodando dentro do app). */
export function googleMapsEmbedUrl(
  point: MapPoint,
  opts?: { zoom?: number; label?: string }
): string {
  const zoom = opts?.zoom ?? 16;
  const label = (opts?.label || 'Peça Já').trim();
  const q = encodeURIComponent(`${label}@${ll(point)}`);
  return `https://maps.google.com/maps?q=${q}&ll=${ll(point)}&z=${zoom}&hl=pt-BR&output=embed`;
}

/** Rota embutida origem → destino. */
export function googleMapsEmbedDirectionsUrl(
  from: MapPoint,
  to: MapPoint,
  opts?: { label?: string }
): string {
  const destLabel = encodeURIComponent(opts?.label || 'Destino');
  return `https://maps.google.com/maps?saddr=${ll(from)}&daddr=${ll(to)}+(${destLabel})&hl=pt-BR&dirflg=d&output=embed`;
}
