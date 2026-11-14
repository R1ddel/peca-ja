import { useCallback, useEffect, useState } from 'react';
import {
  getHomeCatalogLayoutSync,
  loadHomeCatalogLayout,
  saveHomeCatalogLayout,
  subscribeHomeCatalogLayout,
  type HomeCatalogLayout,
} from '@/utils/homeCatalogLayout';

/** Layout da home reativo (vitrine | classic) com persistência local. */
export function useHomeCatalogLayout() {
  const [layout, setLayout] = useState<HomeCatalogLayout>(() => getHomeCatalogLayoutSync());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadHomeCatalogLayout().then((next) => {
      if (!alive) return;
      setLayout(next);
      setReady(true);
    });
    const unsub = subscribeHomeCatalogLayout((next) => {
      setLayout(next);
      setReady(true);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const setHomeCatalogLayout = useCallback(async (next: HomeCatalogLayout) => {
    const saved = await saveHomeCatalogLayout(next);
    setLayout(saved);
    return saved;
  }, []);

  return {
    layout,
    ready,
    isVitrine: layout === 'vitrine',
    isClassic: layout === 'classic',
    setHomeCatalogLayout,
  };
}
