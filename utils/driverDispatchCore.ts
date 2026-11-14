/**
 * Núcleo puro da fila justa (sem AsyncStorage) — usado no cliente e no servidor.
 * Não importa módulos RN para não quebrar as API routes do Expo.
 */
import { Order } from '@/types';
import { operatingCityKey, sameOperatingCity } from '@/utils/operatingCity';

export const DRIVER_OFFER_SECONDS = 45;

function isMockFleetDriverId(driverId?: string | null): boolean {
  if (!driverId) return false;
  return /^driver_\d+$/i.test(driverId) || driverId.startsWith('driver_');
}

function isAssignedToDriver(order: Order, fleetId: string): boolean {
  return !!order.driverId && order.driverId === fleetId;
}

function isKitchenReadyForPickup(order: Order): boolean {
  return (
    order.status === 'preparando' &&
    !!order.kitchenReadyAt &&
    !order.pickupVerifiedAt
  );
}

function listDriverActive(orders: Order[], fleetId: string): Order[] {
  return orders.filter(
    (o) =>
      isAssignedToDriver(o, fleetId) &&
      o.status !== 'cancelado' &&
      o.status !== 'entregue' &&
      o.status !== 'pendente'
  );
}

function listDriverHistory(orders: Order[], fleetId: string): Order[] {
  return orders.filter(
    (o) =>
      isAssignedToDriver(o, fleetId) &&
      (o.status === 'entregue' || o.status === 'cancelado')
  );
}

export type DriverCandidate = {
  fleetId: string;
  applicationId: string;
  name: string;
  phone: string;
  deliveriesToday: number;
  lastOfferAt: number;
  /** Cidade de atuação. Ex.: "Mucugê — BA". */
  city?: string;
};

/** Entregador só recebe corrida da cidade que escolheu. Sem cidade nos dois lados, segue a fila antiga. */
export function driverCanTakeCity(driverCity?: string | null, orderCity?: string | null): boolean {
  if (!operatingCityKey(driverCity) && !operatingCityKey(orderCity)) return true;
  return sameOperatingCity(driverCity, orderCity);
}

export type DispatchPatch = {
  orderId: string;
  offeredToDriverId: string | null;
  offerExpiresAt: string | null;
};

function sameLocalDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isOfferActive(order: Order, nowMs = Date.now()): boolean {
  if (!order.offeredToDriverId || !order.offerExpiresAt) return false;
  return +new Date(order.offerExpiresAt) > nowMs;
}

export function isOrderUnassignedForDispatch(order: Order): boolean {
  if (!order.driverId || isMockFleetDriverId(order.driverId)) return true;
  return false;
}

export function listDispatchQueue(orders: Order[]): Order[] {
  return orders
    .filter(
      (o) =>
        isKitchenReadyForPickup(o) &&
        isOrderUnassignedForDispatch(o) &&
        o.status === 'preparando'
    )
    .sort(
      (a, b) =>
        +new Date(a.kitchenReadyAt || a.createdAt) -
        +new Date(b.kitchenReadyAt || b.createdAt)
    );
}

export function countDeliveriesToday(orders: Order[], fleetId: string): number {
  return listDriverHistory(orders, fleetId).filter(
    (o) =>
      o.status === 'entregue' &&
      sameLocalDay(o.deliveryVerifiedAt || o.updatedAt)
  ).length;
}

export function driverHasActiveJob(orders: Order[], fleetId: string): boolean {
  return listDriverActive(orders, fleetId).length > 0;
}

export function driverHasOpenOffer(
  orders: Order[],
  fleetId: string,
  nowMs = Date.now()
): boolean {
  return orders.some(
    (o) =>
      o.offeredToDriverId === fleetId &&
      isOfferActive(o, nowMs) &&
      isOrderUnassignedForDispatch(o)
  );
}

/**
 * Atribui ofertas exclusivas. Vários pedidos → vários motoboys em paralelo.
 * Um motoboy só recebe 1 oferta (e só se não tiver corrida ativa).
 */
export function computeFairDispatchPatchesSync(
  orders: Order[],
  drivers: DriverCandidate[],
  nowMs = Date.now()
): { patches: DispatchPatch[]; offeredFleetIds: string[] } {
  const queue = listDispatchQueue(orders);
  const sorted = [...drivers].sort((a, b) => {
    if (a.deliveriesToday !== b.deliveriesToday) {
      return a.deliveriesToday - b.deliveriesToday;
    }
    return a.lastOfferAt - b.lastOfferAt;
  });
  const patches: DispatchPatch[] = [];

  for (const o of queue) {
    if (o.offeredToDriverId && o.offerExpiresAt && !isOfferActive(o, nowMs)) {
      patches.push({
        orderId: o.id,
        offeredToDriverId: null,
        offerExpiresAt: null,
      });
    }
  }

  const driverCity = new Map(sorted.map((d) => [d.fleetId, d.city]));
  for (const o of queue) {
    if (!o.offeredToDriverId || !isOfferActive(o, nowMs)) continue;
    if (driverCanTakeCity(driverCity.get(o.offeredToDriverId), o.city)) continue;
    patches.push({
      orderId: o.id,
      offeredToDriverId: null,
      offerExpiresAt: null,
    });
  }

  const busyFleet = new Set<string>();
  for (const d of sorted) {
    if (driverHasActiveJob(orders, d.fleetId)) busyFleet.add(d.fleetId);
  }

  const offeredFleet = new Set<string>();
  for (const o of orders) {
    if (isOfferActive(o, nowMs) && o.offeredToDriverId) {
      offeredFleet.add(o.offeredToDriverId);
    }
  }
  for (const p of patches) {
    if (p.offeredToDriverId === null) {
      const prev = orders.find((x) => x.id === p.orderId);
      if (prev?.offeredToDriverId) offeredFleet.delete(prev.offeredToDriverId);
    }
  }

  const assignedOrder = new Set(patches.map((p) => p.orderId));
  const offeredFleetIds: string[] = [];

  for (const job of queue) {
    if (assignedOrder.has(job.id)) continue;

    const expiresOk = isOfferActive(job, nowMs);
    if (expiresOk && job.offeredToDriverId) {
      offeredFleet.add(job.offeredToDriverId);
      continue;
    }

    const declined = new Set(job.offerDeclinedBy ?? []);
    const pick = sorted.find(
      (d) =>
        driverCanTakeCity(d.city, job.city) &&
        !busyFleet.has(d.fleetId) &&
        !offeredFleet.has(d.fleetId) &&
        !declined.has(d.fleetId)
    );
    if (!pick) continue;

    const expiresAt = new Date(nowMs + DRIVER_OFFER_SECONDS * 1000).toISOString();
    patches.push({
      orderId: job.id,
      offeredToDriverId: pick.fleetId,
      offerExpiresAt: expiresAt,
    });
    offeredFleet.add(pick.fleetId);
    offeredFleetIds.push(pick.fleetId);
    assignedOrder.add(job.id);
  }

  return { patches, offeredFleetIds };
}

export function applyDispatchPatches(
  orders: Order[],
  patches: DispatchPatch[],
  nowIso = new Date().toISOString()
): Order[] {
  if (!patches.length) return orders;
  const byId = new Map(patches.map((p) => [p.orderId, p]));
  return orders.map((o) => {
    const p = byId.get(o.id);
    if (!p) return o;
    if (
      (o.offeredToDriverId ?? null) === p.offeredToDriverId &&
      (o.offerExpiresAt ?? null) === p.offerExpiresAt
    ) {
      return o;
    }
    return {
      ...o,
      offeredToDriverId: p.offeredToDriverId,
      offerExpiresAt: p.offerExpiresAt,
      updatedAt: nowIso,
    };
  });
}

export function getOfferForDriver(
  orders: Order[],
  fleetId: string,
  nowMs = Date.now(),
  driverCity?: string | null
): Order | null {
  const mine = orders.filter(
    (o) =>
      o.offeredToDriverId === fleetId &&
      isOfferActive(o, nowMs) &&
      isOrderUnassignedForDispatch(o) &&
      isKitchenReadyForPickup(o) &&
      (driverCity === undefined || driverCanTakeCity(driverCity, o.city))
  );
  if (!mine.length) return null;
  mine.sort(
    (a, b) =>
      +new Date(a.kitchenReadyAt || a.createdAt) -
      +new Date(b.kitchenReadyAt || b.createdAt)
  );
  return mine[0];
}

export function offerSecondsLeft(order: Order, nowMs = Date.now()): number {
  if (!order.offerExpiresAt) return 0;
  return Math.max(0, Math.ceil((+new Date(order.offerExpiresAt) - nowMs) / 1000));
}

export function queueWaitingCount(orders: Order[], nowMs = Date.now()): number {
  return listDispatchQueue(orders).filter((o) => !isOfferActive(o, nowMs)).length;
}
