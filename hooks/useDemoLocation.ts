import { useCallback, useEffect, useState } from 'react';
import {
  DemoLocation,
  DemoLocationId,
  getActiveDemoLocation,
  getDemoLocationVersion,
  getSimulatedCityLabel,
  hydrateDemoLocation,
  setDemoLocation as persistDemoLocation,
  subscribeDemoLocation,
} from '@/utils/demoLocation';

/**
 * Cidade demo reativa — GPS label, catálogo e banners devem depender de `version`.
 */
export function useDemoLocation() {
  const [demo, setDemo] = useState<DemoLocation | null>(() => getActiveDemoLocation());
  const [version, setVersion] = useState(() => getDemoLocationVersion());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void hydrateDemoLocation().then((loc) => {
      if (!alive) return;
      setDemo(loc);
      setVersion(getDemoLocationVersion());
      setReady(true);
    });
    const unsub = subscribeDemoLocation((loc) => {
      setDemo(loc);
      setVersion(getDemoLocationVersion());
      setReady(true);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const setDemoLocation = useCallback(async (id: DemoLocationId | null) => {
    const next = await persistDemoLocation(id);
    setDemo(next);
    setVersion(getDemoLocationVersion());
    return next;
  }, []);

  return {
    demo,
    ready,
    version,
    cityLabel: getSimulatedCityLabel(),
    setDemoLocation,
  };
}
