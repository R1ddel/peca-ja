import { Business, MenuItem } from '@/types';
import { BusinessCategory } from '@/constants/theme';
import { getAllBusinesses } from '@/data/businesses';

/** Nomes/categorias típicos de prateleira rápida (seeds sem flag explícito). */
const CONVENIENCE_HINTS = [
  'água',
  'refrigerante',
  'energético',
  'isotônico',
  'salgadinho',
  'chocolate',
  'bala ',
  'pilha',
  'isqueiro',
  'macarrão instant',
  'café pronto',
  'sanduíche',
  'wrap ',
  'guardanapo',
  'papel toalha',
  'sabonete',
  'pasta de dente',
  'escova de dente',
  'desinfetante',
  'esponja',
  'saco de lixo',
  'carregador',
  'fone de ouvido',
  'kit lanche',
  'kit café',
  'picolé',
  'sorvete',
  'leite vegetal',
  'iogurte',
  'yogurte',
];

function textMatchesHint(text: string): boolean {
  const t = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return CONVENIENCE_HINTS.some((h) => t.includes(h));
}

/** Item entra no hub Conveniência? */
export function isConvenienceMenuItem(
  item: MenuItem,
  businessCategory?: BusinessCategory
): boolean {
  if (item.available === false) return false;
  if (item.convenience === true) return true;
  if (item.convenience === false) return false;
  if (businessCategory === 'conveniencia') return true;
  // Seeds do catálogo demo: heurística só como fallback (parceiros reais usam flag)
  if (typeof item.id === 'string' && item.id.startsWith('seed-')) {
    return textMatchesHint(`${item.name} ${item.category}`);
  }
  return false;
}

export type ConvenienceProductHit = {
  key: string;
  business: Business;
  item: MenuItem;
};

/** Lojas que vendem na Conveniência (categoria própria ou itens marcados). */
export function listConvenienceShops(catalog?: Business[]): Business[] {
  const list = catalog ?? getAllBusinesses();
  return list.filter((b) => {
    if (b.category === 'conveniencia') return true;
    return b.menu.some((m) => isConvenienceMenuItem(m, b.category));
  });
}

/** Produtos da vitrine Conveniência (todas as lojas). */
export function listConvenienceProducts(
  catalog?: Business[],
  limit = 80
): ConvenienceProductHit[] {
  const list = catalog ?? getAllBusinesses();
  const hits: ConvenienceProductHit[] = [];
  for (const business of list) {
    if (!business.isOpen && business.category !== 'conveniencia') {
      // ainda lista fechados da categoria própria; produtos de outras só se abertos
    }
    for (const item of business.menu) {
      if (!isConvenienceMenuItem(item, business.category)) continue;
      if (business.category !== 'conveniencia' && !business.isOpen) continue;
      hits.push({
        key: `${business.id}:${item.id}`,
        business,
        item,
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

/** Categorias de produto presentes no hub (chips). */
export function convenienceProductCategories(
  hits: ConvenienceProductHit[]
): string[] {
  const set = new Set<string>();
  for (const h of hits) set.add(h.item.category || 'Geral');
  return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
}
