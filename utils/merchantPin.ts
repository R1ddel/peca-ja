/**
 * Pin da loja para frete / rota.
 * Prioridade: coordenadas salvas → seed fixo da loja → hash estável na cidade.
 * Nunca inventa pin “ao lado do cliente” (isso distorce o frete).
 */
import type { Business } from '@/types';
import { getBusinessById } from '@/data/businesses';
import {
  isValidLatLng,
  resolveBusinessCoords,
  type LatLng,
} from '@/utils/orderGeo';

export type MerchantPinSource = 'shop' | 'catalog' | 'fallback';

export type MerchantPin = LatLng & {
  source: MerchantPinSource;
  /** true = lojista (ou seed) gravou lat/lng reais no catálogo. */
  isPinned: boolean;
};

export function resolveMerchantPin(input: {
  businessId?: string | null;
  businessName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): MerchantPin {
  if (isValidLatLng(input.latitude, input.longitude)) {
    return {
      latitude: input.latitude as number,
      longitude: input.longitude as number,
      source: 'shop',
      isPinned: true,
    };
  }

  const id = String(input.businessId || '').trim();
  if (id) {
    const fromCatalog = getBusinessById(id);
    if (fromCatalog && isValidLatLng(fromCatalog.latitude, fromCatalog.longitude)) {
      return {
        latitude: fromCatalog.latitude as number,
        longitude: fromCatalog.longitude as number,
        source: 'catalog',
        isPinned: true,
      };
    }
  }

  const fallback = resolveBusinessCoords(id || 'loja', input.businessName || undefined);
  return {
    ...fallback,
    source: 'fallback',
    isPinned: false,
  };
}

export function resolveMerchantPinFromBusiness(
  business: Pick<Business, 'id' | 'name' | 'latitude' | 'longitude'> | null | undefined
): MerchantPin {
  if (!business) {
    return resolveMerchantPin({});
  }
  return resolveMerchantPin({
    businessId: business.id,
    businessName: business.name,
    latitude: business.latitude,
    longitude: business.longitude,
  });
}

/** Async: também lê AsyncStorage da loja parceira se o catálogo ainda não tiver pin. */
export async function resolveMerchantPinForBusinessId(
  businessId: string
): Promise<MerchantPin> {
  const fromCatalog = resolveMerchantPin({ businessId });
  if (fromCatalog.isPinned) return fromCatalog;

  try {
    const { getShopByBusinessId } = await import('@/utils/merchantShop');
    const shop = await getShopByBusinessId(businessId);
    if (shop && isValidLatLng(shop.latitude, shop.longitude)) {
      return {
        latitude: shop.latitude as number,
        longitude: shop.longitude as number,
        source: 'shop',
        isPinned: true,
      };
    }
    return resolveMerchantPin({
      businessId,
      businessName: shop?.name,
    });
  } catch {
    return fromCatalog;
  }
}

export function formatPinLabel(pin: MerchantPin): string {
  const lat = pin.latitude.toFixed(5);
  const lng = pin.longitude.toFixed(5);
  if (pin.isPinned) return `${lat}, ${lng}`;
  return `${lat}, ${lng} (aproximado)`;
}
