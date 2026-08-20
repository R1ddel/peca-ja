import { Business, MenuItem } from '@/types';

/** Remove acentos, pontuação e normaliza espaços. */
export function normalizeSearchText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchTokens(raw: string): string[] {
  const n = normalizeSearchText(raw);
  if (!n) return [];
  return n.split(' ').filter((t) => t.length > 0);
}

/** Todas as palavras da busca precisam aparecer no texto (ordem livre). */
export function textMatchesQuery(haystack: string, query: string): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return false;
  const hay = normalizeSearchText(haystack);
  if (!hay) return false;
  // Frase inteira
  if (hay.includes(normalizeSearchText(query))) return true;
  // Ou cada token
  return tokens.every((t) => hay.includes(t));
}

export type CatalogProductHit = {
  key: string;
  item: MenuItem;
  business: Business;
};

export type CatalogSearchResult = {
  products: CatalogProductHit[];
  businesses: Business[];
};

function businessMatchesQuery(b: Business, query: string): boolean {
  const blob = [
    b.name,
    b.description,
    b.category,
    ...(b.tags ?? []),
  ].join(' ');
  return textMatchesQuery(blob, query);
}

function menuItemMatchesQuery(item: MenuItem, query: string): boolean {
  const blob = [item.name, item.description, item.category, item.details ?? ''].join(' ');
  return textMatchesQuery(blob, query);
}

/**
 * Busca em lojas + itens de cardápio do catálogo completo.
 * Só retorna vazio quando realmente não há nada com aquele nome.
 * Itens com available === false são ignorados.
 */
export function searchCatalog(
  catalog: Business[],
  query: string,
  opts?: {
    maxProducts?: number;
    maxBusinesses?: number;
    /** Se false, inclui itens indisponíveis (default: true = só disponíveis). */
    onlyAvailable?: boolean;
    /** Predicado extra sobre a loja (ex.: filtros da home). */
    businessFilter?: (b: Business) => boolean;
  }
): CatalogSearchResult {
  const q = query.trim();
  if (!q || searchTokens(q).length === 0) {
    return { products: [], businesses: [] };
  }

  const maxProducts = opts?.maxProducts ?? 200;
  const maxBusinesses = opts?.maxBusinesses ?? 80;
  const onlyAvailable = opts?.onlyAvailable !== false;
  const businessFilter = opts?.businessFilter;

  const products: CatalogProductHit[] = [];
  const businessHits = new Map<string, Business>();

  for (const business of catalog) {
    if (businessFilter && !businessFilter(business)) continue;

    if (businessMatchesQuery(business, q)) {
      businessHits.set(business.id, business);
    }

    for (const item of business.menu ?? []) {
      if (onlyAvailable && item.available === false) continue;
      if (!menuItemMatchesQuery(item, q)) continue;
      products.push({
        key: `${business.id}:${item.id}`,
        item,
        business,
      });
      businessHits.set(business.id, business);
    }
  }

  // Produtos mais relevantes primeiro (nome casa com a frase / começa com token)
  const normQ = normalizeSearchText(q);
  products.sort((a, b) => {
    const an = normalizeSearchText(a.item.name);
    const bn = normalizeSearchText(b.item.name);
    const aExact = an === normQ ? 0 : an.includes(normQ) ? 1 : 2;
    const bExact = bn === normQ ? 0 : bn.includes(normQ) ? 1 : 2;
    if (aExact !== bExact) return aExact - bExact;
    // Destaque (maior plano) sobe um pouco na lista
    const aPlan = a.business.plan === 'destaque' ? 0 : a.business.plan === 'crescimento' ? 1 : 2;
    const bPlan = b.business.plan === 'destaque' ? 0 : b.business.plan === 'crescimento' ? 1 : 2;
    if (aPlan !== bPlan) return aPlan - bPlan;
    return an.localeCompare(bn, 'pt-BR');
  });

  return {
    products: products.slice(0, maxProducts),
    businesses: Array.from(businessHits.values()).slice(0, maxBusinesses),
  };
}

/**
 * Lojas do maior plano que têm o produto/busca — duas fileiras horizontais.
 */
export function topPlanShopsForSearch(
  catalog: Business[],
  query: string,
  topPlan: Business['plan'] = 'destaque'
): { row1: Business[]; row2: Business[] } {
  const { products, businesses } = searchCatalog(catalog, query, {
    maxProducts: 500,
    maxBusinesses: 200,
  });
  const idsFromProducts = new Set(products.map((p) => p.business.id));
  const idsFromBiz = new Set(businesses.map((b) => b.id));

  const list = catalog
    .filter(
      (b) =>
        b.plan === topPlan &&
        (idsFromProducts.has(b.id) || idsFromBiz.has(b.id))
    )
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, 'pt-BR'));

  // Se a busca bateu só em produtos de planos menores, ainda mostra o Topo
  // que tenha o item no cardápio; se nenhum Topo casou, fileiras vazias.
  const mid = Math.ceil(list.length / 2) || 0;
  return {
    row1: list.slice(0, mid),
    row2: list.slice(mid),
  };
}

/** Filtro simples “tem match na loja ou no cardápio?” (home). */
export function businessMatchesSearch(b: Business, query: string): boolean {
  if (!query.trim()) return true;
  if (businessMatchesQuery(b, query)) return true;
  return (b.menu ?? []).some((m) => menuItemMatchesQuery(m, query));
}
