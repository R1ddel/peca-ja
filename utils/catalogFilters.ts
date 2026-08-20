/**
 * Filtros compartilhados home / busca / conveniência.
 */
import type { Business } from '@/types';
import type { BusinessCategory } from '@/constants/theme';
import {
  defaultHomeFilters,
  parseDistanceKm,
  type HomeFilterState,
} from '@/components/HomeFilters';
import { businessMatchesSearch } from '@/utils/catalogSearch';

export type CatalogCategoryFilter = BusinessCategory | 'todos';

/** Rotaciona a lista por dia — ninguém fica eternamente no fim. */
export function rotateFair<T>(list: T[], seed: number): T[] {
  if (list.length <= 1) return list;
  const offset = ((seed % list.length) + list.length) % list.length;
  return [...list.slice(offset), ...list.slice(0, offset)];
}

export function daySeed(): number {
  const d = new Date();
  return d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate();
}

/** Loja passa nos filtros de aberto / km / frete / nota? */
export function businessPassesHomeFilters(
  b: Business,
  filters: HomeFilterState
): boolean {
  if (filters.openOnly && !b.isOpen) return false;
  const km = parseDistanceKm(b.distance);
  if (filters.distance !== 'any' && km > Number(filters.distance)) return false;
  if (filters.deliveryFee !== 'any' && b.deliveryFee > Number(filters.deliveryFee)) {
    return false;
  }
  if (filters.rating !== 'any' && b.rating < Number(filters.rating)) return false;
  return true;
}

export function sortBusinessesByHomeFilters(
  list: Business[],
  filters: HomeFilterState
): Business[] {
  const result = [...list];
  const seed = daySeed();
  switch (filters.sort) {
    case 'distance':
      result.sort((a, b) => parseDistanceKm(a.distance) - parseDistanceKm(b.distance));
      break;
    case 'delivery':
      result.sort((a, b) => a.deliveryFee - b.deliveryFee);
      break;
    case 'rating':
      result.sort((a, b) => b.rating - a.rating);
      break;
    default: {
      const planRank = (p: string) => (p === 'destaque' ? 0 : p === 'crescimento' ? 1 : 2);
      const buckets: Business[][] = [[], [], []];
      for (const b of result) {
        buckets[planRank(b.plan)].push(b);
      }
      return buckets.flatMap((bucket, i) =>
        rotateFair(
          [...bucket].sort((a, b) => b.rating - a.rating),
          seed + i * 17
        )
      );
    }
  }
  return result;
}

export function applyHomeBusinessFilters(
  list: Business[],
  opts: {
    selectedCategory?: CatalogCategoryFilter;
    searchQuery?: string;
    filters?: HomeFilterState;
  }
): Business[] {
  const selectedCategory = opts.selectedCategory ?? 'todos';
  const searchQuery = opts.searchQuery ?? '';
  const filters = opts.filters ?? defaultHomeFilters;

  const filtered = list.filter((b) => {
    const matchesCategory =
      selectedCategory === 'todos' || b.category === selectedCategory;
    const matchesSearch = businessMatchesSearch(b, searchQuery);
    if (!matchesCategory || !matchesSearch) return false;
    return businessPassesHomeFilters(b, filters);
  });

  return sortBusinessesByHomeFilters(filtered, filters);
}

export { defaultHomeFilters, parseDistanceKm };
export type { HomeFilterState };
