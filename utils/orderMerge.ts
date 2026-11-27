/**
 * Merge de pedidos da frota/plataforma.
 * `null` em campos de entregador = limpar de propósito (JSON omite `undefined`).
 */
import type { Order } from '@/types';
import { isValidLatLng } from '@/utils/orderGeo';
import { coerceOrderStatus } from '@/utils/orderStatus';

const DRIVER_CLEAR_KEYS = [
  'driverId',
  'driverName',
  'driverPhone',
  'driverPhotoUrl',
  'driverBio',
  'driverVehicle',
] as const;

function liveScore(order: Order): number {
  if (!isValidLatLng(order.customerLiveLatitude, order.customerLiveLongitude)) return -1;
  const at = +new Date(order.customerLiveAt || 0);
  return Number.isFinite(at) ? at : 0;
}

function fresherLive(a: Order, b: Order): Order | null {
  const scoreA = liveScore(a);
  const scoreB = liveScore(b);
  if (scoreA < 0 && scoreB < 0) return null;
  return scoreA >= scoreB ? a : b;
}

function earliestSavedPin(orders: Order[]): Order | null {
  const stamped = orders.filter(
    (order) =>
      !!order.deliveryPinSavedAt &&
      isValidLatLng(order.deliveryLatitude, order.deliveryLongitude)
  );
  if (!stamped.length) return null;
  return stamped.reduce((best, order) =>
    +new Date(order.deliveryPinSavedAt || 0) <= +new Date(best.deliveryPinSavedAt || 0)
      ? order
      : best
  );
}

/**
 * O GPS ao vivo e o ponto do checkout não seguem o updatedAt do pedido.
 * Um status mais novo não pode apagar o destino da corrida.
 */
export function graftDeliverySignals(winner: Order, other: Order): Order {
  const next: Order = { ...winner };
  const live = fresherLive(winner, other);
  if (live) {
    next.customerLiveLatitude = live.customerLiveLatitude;
    next.customerLiveLongitude = live.customerLiveLongitude;
    next.customerLiveAt = live.customerLiveAt;
  }
  const saved = earliestSavedPin([winner, other]);
  if (saved) {
    next.deliveryLatitude = saved.deliveryLatitude;
    next.deliveryLongitude = saved.deliveryLongitude;
    next.deliveryPinSavedAt = saved.deliveryPinSavedAt;
  } else if (!isValidLatLng(next.deliveryLatitude, next.deliveryLongitude)) {
    const fallback = [other, winner].find((order) =>
      isValidLatLng(order.deliveryLatitude, order.deliveryLongitude)
    );
    if (fallback) {
      next.deliveryLatitude = fallback.deliveryLatitude;
      next.deliveryLongitude = fallback.deliveryLongitude;
    }
  }
  return next;
}

/** Aplica patch remoto sobre o pedido local, respeitando limpeza com null. */
export function mergeOrderFields(prev: Order, incoming: Order): Order {
  const status = coerceOrderStatus(prev.status, incoming.status);
  const merged: Order = { ...prev, ...incoming, status };
  for (const key of DRIVER_CLEAR_KEYS) {
    if (Object.prototype.hasOwnProperty.call(incoming, key) && incoming[key] == null) {
      delete merged[key];
    }
  }
  return graftDeliverySignals(merged, prev);
}

export function mergeOrdersPreferNewer(local: Order[], remote: Order[]): Order[] {
  const map = new Map<string, Order>();
  for (const o of local) {
    if (o?.id) map.set(o.id, o);
  }
  for (const o of remote) {
    if (!o?.id) continue;
    const prev = map.get(o.id);
    if (!prev) {
      map.set(o.id, o);
      continue;
    }
    const prevT = +new Date(prev.updatedAt || prev.createdAt || 0);
    const nextT = +new Date(o.updatedAt || o.createdAt || 0);
    if (nextT >= prevT) {
      map.set(o.id, mergeOrderFields(prev, o));
    } else {
      map.set(o.id, graftDeliverySignals(prev, o));
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      +new Date(b.updatedAt || b.createdAt) - +new Date(a.updatedAt || a.createdAt)
  );
}

/** Pedido liberado pelo motoboy (campos null sobrevivem ao JSON). */
export function clearedDriverAssignment(order: Order): Order {
  return {
    ...order,
    driverId: null,
    driverName: null,
    driverPhone: null,
    driverPhotoUrl: null,
    driverBio: null,
    driverVehicle: null,
    offeredToDriverId: null,
    offerExpiresAt: null,
    offerDeclinedBy: [],
    updatedAt: new Date().toISOString(),
  };
}
