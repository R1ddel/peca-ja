import { BRAZIL_CITIES } from '@/data/brazilCities';

const UFS = new Set([
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]);

export type BrazilCity = {
  name: string;
  uf: string;
};

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

type IndexedCity = BrazilCity & { key: string };

let index: IndexedCity[] | null = null;

function cities(): IndexedCity[] {
  if (!index) {
    index = BRAZIL_CITIES.map(([name, uf]) => ({
      name,
      uf,
      key: fold(name),
    }));
  }
  return index;
}

export function formatBrazilCity(city: Pick<BrazilCity, 'name' | 'uf'>): string {
  return `${city.name} — ${city.uf}`;
}

export function parseBrazilCityLabel(label: string): BrazilCity | null {
  const raw = label.trim();
  if (!raw) return null;
  const parts = raw.split(/\s+[—-]\s+/);
  if (parts.length < 2) return null;
  const uf = parts[parts.length - 1].trim().toUpperCase();
  const name = parts.slice(0, -1).join(' — ').trim();
  if (!name || !UFS.has(uf)) return null;
  return { name, uf };
}

export function isBrazilCityLabel(label: string): boolean {
  const parsed = parseBrazilCityLabel(label);
  if (!parsed) return false;
  const key = fold(parsed.name);
  return cities().some((city) => city.key === key && city.uf === parsed.uf);
}

export function searchBrazilCities(query: string, limit = 30): BrazilCity[] {
  const raw = fold(query).replace(/[—-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (raw.length < 2) return [];

  const tokens = raw.split(' ');
  const last = tokens[tokens.length - 1] ?? '';
  let nameQuery = raw;
  let uf = '';
  if (tokens.length > 1 && last.length === 2 && UFS.has(last.toUpperCase())) {
    uf = last.toUpperCase();
    nameQuery = tokens.slice(0, -1).join(' ');
  }
  if (nameQuery.length < 2) return [];

  const starts: BrazilCity[] = [];
  const contains: BrazilCity[] = [];
  for (const city of cities()) {
    if (uf && city.uf !== uf) continue;
    if (city.key.startsWith(nameQuery)) {
      starts.push(city);
      if (starts.length >= limit) break;
      continue;
    }
    if (starts.length + contains.length < limit && city.key.includes(nameQuery)) {
      contains.push(city);
    }
  }
  return [...starts, ...contains].slice(0, limit);
}
