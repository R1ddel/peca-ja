/**
 * Identidade visual por cidade (GPS).
 * Nunca força "Mucugê" se o comerciante estiver em outra cidade.
 */
export type CityBrand = {
  /** Nome exibido (do GPS ou fallback). */
  displayName: string;
  tagline: string;
  vibe: string;
  /** Cores do mosaico (6 tiles). */
  mosaic: [string, string, string, string, string, string];
  accent: string;
  soft: string;
};

function normalizeCity(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Paletas rotativas — cada cidade “sente” diferente sem hardcode infinito. */
const PALETTE_BANK: Array<Omit<CityBrand, 'displayName' | 'tagline' | 'vibe'> & { vibeTemplate: string }> = [
  {
    mosaic: ['#00A86B', '#007A4D', '#FFB800', '#1E3A2F', '#C4A574', '#E8F8F0'],
    accent: '#00A86B',
    soft: '#E8F8F0',
    vibeTemplate: 'Comércio local que a cidade reconhece no mapa.',
  },
  {
    mosaic: ['#2D6A4F', '#D4A373', '#F4E3C1', '#1B4332', '#95D5B2', '#40916C'],
    accent: '#2D6A4F',
    soft: '#F4E3C1',
    vibeTemplate: 'Ritmo de praça, entrega na porta e cara de bairro.',
  },
  {
    mosaic: ['#1B4D3E', '#E9C46A', '#F4A261', '#264653', '#2A9D8F', '#E9F5F0'],
    accent: '#2A9D8F',
    soft: '#E9F5F0',
    vibeTemplate: 'Do centro ao bairro: sua loja no Peça Já daqui.',
  },
  {
    mosaic: ['#3D5A40', '#A3B18A', '#DAD7CD', '#588157', '#344E41', '#FEFAE0'],
    accent: '#588157',
    soft: '#FEFAE0',
    vibeTemplate: 'Pedidos da cidade, feitos por quem vive aqui.',
  },
  {
    mosaic: ['#0B6E4F', '#08A045', '#F0C929', '#14532D', '#86EFAC', '#ECFDF5'],
    accent: '#0B6E4F',
    soft: '#ECFDF5',
    vibeTemplate: 'Mais visibilidade onde o cliente já pede todo dia.',
  },
];

/** Ajustes manuais para cidades já mapeadas (Chapada / Bahia). */
const CITY_OVERRIDES: Record<string, Partial<CityBrand> & { vibe?: string }> = {
  mucuge: {
    mosaic: ['#00A86B', '#C4A574', '#FFB800', '#1E3A2F', '#8B7355', '#E8F8F0'],
    accent: '#00A86B',
    soft: '#FFF8E6',
    vibe: 'Chapada na mesa: sua loja no mosaico de Mucugê.',
  },
  'barra da estiva': {
    mosaic: ['#1B4332', '#D4A373', '#BC6C25', '#40916C', '#F4E3C1', '#2D6A4F'],
    accent: '#BC6C25',
    soft: '#F4E3C1',
    vibe: 'Barra da Estiva no Peça Já — vitrine feita pra cá.',
  },
  seabra: {
    mosaic: ['#007A4D', '#E9C46A', '#264653', '#2A9D8F', '#F4A261', '#E8F8F0'],
    accent: '#007A4D',
    soft: '#E8F8F0',
    vibe: 'Seabra pede Peça Já: sua marca no mapa da cidade.',
  },
  lencois: {
    mosaic: ['#1E3A2F', '#74C69D', '#FFB800', '#40916C', '#D8F3DC', '#081C15'],
    accent: '#40916C',
    soft: '#D8F3DC',
    vibe: 'Lençóis no ritmo Peça Já — destaque local de verdade.',
  },
  ibicoara: {
    mosaic: ['#2D6A4F', '#95D5B2', '#FFB800', '#1B4332', '#FEFAE0', '#52B788'],
    accent: '#2D6A4F',
    soft: '#FEFAE0',
    vibe: 'Ibicoara no app: pedidos da sua rua, do seu jeito.',
  },
  palmeiras: {
    mosaic: ['#344E41', '#A3B18A', '#DAD7CD', '#588157', '#00A86B', '#FEFAE0'],
    accent: '#588157',
    soft: '#FEFAE0',
    vibe: 'Palmeiras pede perto — sua loja no centro da conversa.',
  },
  'vale do capao': {
    mosaic: ['#1B4332', '#74C69D', '#E9C46A', '#40916C', '#D8F3DC', '#081C15'],
    accent: '#2D6A4F',
    soft: '#D8F3DC',
    vibe: 'Vale do Capão no Peça Já — trilha, pousada e entrega no vale.',
  },
  capao: {
    mosaic: ['#1B4332', '#74C69D', '#E9C46A', '#40916C', '#D8F3DC', '#081C15'],
    accent: '#2D6A4F',
    soft: '#D8F3DC',
    vibe: 'Capão no Peça Já — pedidos onde a chapada encontra o vale.',
  },
};

function hashCity(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Monta a marca da cidade a partir do nome do GPS.
 * Fallback genérico se o GPS falhar — sem citar Mucugê.
 */
export function resolveCityBrand(cityFromGps?: string | null): CityBrand {
  const raw = (cityFromGps ?? '').trim();
  const displayName = raw || 'Sua cidade';
  const key = normalizeCity(displayName);

  const override = CITY_OVERRIDES[key];
  const bank = PALETTE_BANK[hashCity(key || 'sua-cidade') % PALETTE_BANK.length];

  const mosaic = (override?.mosaic as CityBrand['mosaic'] | undefined) ?? bank.mosaic;
  const accent = override?.accent ?? bank.accent;
  const soft = override?.soft ?? bank.soft;
  const vibe =
    override?.vibe ??
    bank.vibeTemplate.replace(/a cidade/gi, displayName === 'Sua cidade' ? 'sua cidade' : displayName);

  return {
    displayName,
    tagline:
      displayName === 'Sua cidade'
        ? 'Planos Peça Já para o comércio local'
        : `Planos Peça Já em ${displayName}`,
    vibe,
    mosaic,
    accent,
    soft,
  };
}
