/**
 * Destino do cliente na corrida.
 * Plano 1: GPS ao vivo do celular.
 * Plano 2: ponto gravado no pedido na hora do checkout.
 * Plano 3: endereço. Cada um só entra se o anterior falhou.
 */
import {
  isValidLatLng,
  resolveDeliveryCoords,
  type LatLng,
} from '@/utils/orderGeo';

/** GPS ao vivo mais velho que isso não conta — cai no ponto salvo. */
export const LIVE_CUSTOMER_GPS_MAX_AGE_MS = 90_000;

/** Relógio do aparelho um pouco à frente ainda vale. */
const LIVE_CLOCK_SKEW_MS = 15_000;

export type DeliveryTargetSource = 'phone_gps' | 'order_pin' | 'address';

export type DeliveryTargetOrder = {
  address?: string | null;
  city?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  customerLiveLatitude?: number | null;
  customerLiveLongitude?: number | null;
  customerLiveAt?: string | null;
};

export type DeliveryTarget = {
  point: LatLng;
  source: DeliveryTargetSource;
  /** false só no pin local do endereço, antes do geocode confirmar a rua. */
  precise: boolean;
};

export function deliveryTargetFromOrder(
  order: DeliveryTargetOrder,
  now = Date.now()
): DeliveryTarget {
  const liveAt = +new Date(order.customerLiveAt || 0);
  const liveFresh =
    Number.isFinite(liveAt) &&
    liveAt > 0 &&
    now - liveAt <= LIVE_CUSTOMER_GPS_MAX_AGE_MS &&
    liveAt - now <= LIVE_CLOCK_SKEW_MS;

  if (
    liveFresh &&
    isValidLatLng(order.customerLiveLatitude, order.customerLiveLongitude)
  ) {
    return {
      point: {
        latitude: order.customerLiveLatitude as number,
        longitude: order.customerLiveLongitude as number,
      },
      source: 'phone_gps',
      precise: true,
    };
  }

  if (isValidLatLng(order.deliveryLatitude, order.deliveryLongitude)) {
    return {
      point: {
        latitude: order.deliveryLatitude as number,
        longitude: order.deliveryLongitude as number,
      },
      source: 'order_pin',
      precise: true,
    };
  }

  return {
    point: resolveDeliveryCoords(order.address || ''),
    source: 'address',
    precise: false,
  };
}

export function deliveryTargetLabel(source: DeliveryTargetSource): string {
  if (source === 'phone_gps') return 'Destino pelo GPS do celular';
  if (source === 'order_pin') return 'Destino pelo ponto salvo no pedido';
  return 'Destino pelo endereço do pedido';
}

export function deliveryTargetShort(source: DeliveryTargetSource): string {
  if (source === 'phone_gps') return 'GPS do celular';
  if (source === 'order_pin') return 'Ponto do pedido';
  return 'Endereço';
}
