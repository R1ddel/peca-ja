/** URL do mapa embutido do OpenStreetMap. Sem chave e sem biblioteca extra. */
export function osmEmbedUrl(latitude: number, longitude: number, span = 0.02): string {
  const bbox = [longitude - span, latitude - span, longitude + span, latitude + span].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}
