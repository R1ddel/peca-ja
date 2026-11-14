/**
 * Layout do catálogo na home.
 * - vitrine: destaque grande + trilhos por categoria (referência visual)
 * - classic: tiles pequenos + Ver grade + grade 2 colunas (comportamento anterior)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HomeCatalogLayout = 'vitrine' | 'classic';

export const HOME_CATALOG_LAYOUT_KEY = '@pecaja/homeCatalogLayout';
export const DEFAULT_HOME_CATALOG_LAYOUT: HomeCatalogLayout = 'vitrine';

const listeners = new Set<(layout: HomeCatalogLayout) => void>();
let cached: HomeCatalogLayout | null = null;
let hydrated = false;

function isLayout(v: unknown): v is HomeCatalogLayout {
  return v === 'vitrine' || v === 'classic';
}

export function getHomeCatalogLayoutSync(): HomeCatalogLayout {
  return cached ?? DEFAULT_HOME_CATALOG_LAYOUT;
}

export async function loadHomeCatalogLayout(): Promise<HomeCatalogLayout> {
  try {
    const raw = await AsyncStorage.getItem(HOME_CATALOG_LAYOUT_KEY);
    const next = isLayout(raw) ? raw : DEFAULT_HOME_CATALOG_LAYOUT;
    cached = next;
    hydrated = true;
    return next;
  } catch {
    cached = DEFAULT_HOME_CATALOG_LAYOUT;
    hydrated = true;
    return DEFAULT_HOME_CATALOG_LAYOUT;
  }
}

export async function saveHomeCatalogLayout(layout: HomeCatalogLayout): Promise<HomeCatalogLayout> {
  cached = layout;
  hydrated = true;
  try {
    await AsyncStorage.setItem(HOME_CATALOG_LAYOUT_KEY, layout);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(layout));
  return layout;
}

export function subscribeHomeCatalogLayout(
  fn: (layout: HomeCatalogLayout) => void
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isHomeCatalogLayoutHydrated(): boolean {
  return hydrated;
}

export const HOME_CATALOG_LAYOUT_LABELS: Record<HomeCatalogLayout, string> = {
  vitrine: 'Vitrine (destaque + categorias)',
  classic: 'Clássico (grade)',
};
