/**
 * Fecha a loja sozinha quando passa do horário da grade semanal.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { patchShop } from '@/utils/merchantShop';
import {
  shouldAutoCloseShop,
  todayAutoCloseKey,
} from '@/utils/shopAutoClose';

export function ShopAutoCloseWatcher() {
  const { user } = useAuth();
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { app } = await resolveOperatorMerchantContext(user?.email);
      if (!cancelled) setApplicationId(app?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const tick = useCallback(async () => {
    if (!applicationId || closingRef.current) return;
    const { shop } = await resolveOperatorMerchantContext(user?.email);
    if (!shop || shop.applicationId !== applicationId) return;
    if (!shouldAutoCloseShop(shop)) return;

    const key = todayAutoCloseKey(shop.businessId);
    try {
      const already = await AsyncStorage.getItem(key);
      if (already === '1') return;
    } catch {
      /* ignore */
    }

    closingRef.current = true;
    try {
      await patchShop(applicationId, { isOpen: false });
      await AsyncStorage.setItem(key, '1');
    } catch {
      /* ignore */
    } finally {
      closingRef.current = false;
    }
  }, [applicationId, user?.email]);

  useEffect(() => {
    if (!applicationId) return;
    void tick();
    const id = setInterval(() => void tick(), 60_000);
    return () => clearInterval(id);
  }, [applicationId, tick]);

  return null;
}
