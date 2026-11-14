import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { hydratePartnerShops } from '@/utils/merchantShop';

/**
 * Sobe quando outra aba salva a loja (mesma origem).
 * O checkout e a página do comércio releem os pagamentos sem recarregar o site.
 */
export function useMerchantShopRevision(): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (!event.key || !event.key.includes('pecaja_merchant_shops')) return;
      void hydratePartnerShops().then(() => setRevision((current) => current + 1));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return revision;
}
