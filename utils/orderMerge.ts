/**
 * Merge de pedidos da frota/plataforma.
 * `null` em campos de entregador = limpar de propósito (JSON omite `undefined`).
 */
import type { Order } from '@/types';
import { coerceOrderStatus } from '@/utils/orderStatus';

const DRIVER_CLEAR_KEYS = [
  'driverId',
  'driverName',
  'driverPhone',
  'driverPhotoUrl',
  'driverBio',
  'driverVehicle',
] as const;

/** Aplica patch remoto sobre o pedido local, respeitando limpeza com null. */
export function mergeOrderFields(prev: Order, incoming: Order): Order {
  const status = coerceOrderStatus(prev.status, incoming.status);
  const merged: Order = { ...prev, ...incoming, status };
  for (const key of DRIVER_CLEAR_KEYS) {
    if (Object.prototype.hasOwnProperty.call(incoming, key) && incoming[key] == null) {
      delete merged[key];
    }
  }
  return merged;
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
