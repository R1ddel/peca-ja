/**
 * Motor da frota no host Expo: sync, heartbeat, dispatch atômico, claim, denúncias.
 */
import type { ConductReport, Order } from '@/types';
import {
  applyDispatchPatches,
  computeFairDispatchPatchesSync,
  countDeliveriesToday,
  driverHasActiveJob,
  isOfferActive,
  isOrderUnassignedForDispatch,
  type DriverCandidate,
} from '@/utils/driverDispatchCore';
import type { FleetDriverPresence, FleetState } from '@/services/fleetTypes';
import {
  mergeOrdersByUpdatedAt,
  pruneFleetOrders,
  saveFleetState,
  withFleetLock,
} from '@/services/fleetStore';
import { newSessionToken } from '@/services/platformCrypto';

const ONLINE_TTL_MS = 90_000;

export function sanitizeOrderForFleet(
  order: Order,
  viewerFleetId?: string | null
): Order {
  const assigned =
    viewerFleetId &&
    (order.driverId === viewerFleetId || order.offeredToDriverId === viewerFleetId);
  if (assigned) return order;
  const {
    pickupCode: _p,
    deliveryCode: _d,
    customerPhone: _c,
    ...rest
  } = order as Order & {
    pickupCode?: string;
    deliveryCode?: string;
    customerPhone?: string;
  };
  return rest as Order;
}

export function publicDriversMap(
  drivers: Record<string, FleetDriverPresence>
): Record<string, FleetDriverPresence> {
  const out: Record<string, FleetDriverPresence> = {};
  for (const [id, d] of Object.entries(drivers)) {
    if (!d) continue;
    const { sessionToken: _t, ...rest } = d;
    out[id] = rest;
  }
  return out;
}

export function verifyDriverToken(
  state: FleetState,
  fleetId: string,
  driverToken?: string
): boolean {
  if (!fleetId || !driverToken) return false;
  const d = state.drivers[fleetId];
  return !!d?.sessionToken && d.sessionToken === driverToken;
}

function isMockFleetDriverId(driverId?: string | null): boolean {
  if (!driverId) return false;
  return /^driver_\d+$/i.test(driverId) || driverId.startsWith('driver_');
}

function nowIso() {
  return new Date().toISOString();
}

function onlineDrivers(
  state: FleetState,
  orders: Order[],
  nowMs = Date.now()
): DriverCandidate[] {
  const out: DriverCandidate[] = [];
  for (const d of Object.values(state.drivers)) {
    if (!d?.fleetId) continue;
    if (d.blocked) continue;
    if (!d.online) continue;
    const age = nowMs - +new Date(d.lastSeenAt || 0);
    if (age > ONLINE_TTL_MS) continue;
    out.push({
      fleetId: d.fleetId,
      applicationId: d.applicationId || d.fleetId,
      name: d.name || 'Entregador',
      phone: d.phone || '',
      deliveriesToday: countDeliveriesToday(orders, d.fleetId),
      lastOfferAt: d.lastOfferAt ?? 0,
    });
  }
  return out;
}

function runDispatch(state: FleetState, nowMs = Date.now()): FleetState {
  const drivers = onlineDrivers(state, state.orders, nowMs);
  const { patches, offeredFleetIds } = computeFairDispatchPatchesSync(
    state.orders,
    drivers,
    nowMs
  );
  if (!patches.length) return state;
  const orders = applyDispatchPatches(state.orders, patches, nowIso());
  const driversMap = { ...state.drivers };
  const touchAt = Date.now();
  for (const fid of offeredFleetIds) {
    const prev = driversMap[fid];
    if (prev) {
      driversMap[fid] = { ...prev, lastOfferAt: touchAt };
    }
  }
  return { ...state, orders, drivers: driversMap };
}

export async function fleetSync(input: {
  orders?: Order[];
  runDispatch?: boolean;
}): Promise<FleetState> {
  return withFleetLock(async (state) => {
    let next = { ...state };
    if (input.orders?.length) {
      next.orders = pruneFleetOrders(
        mergeOrdersByUpdatedAt(next.orders, input.orders)
      );
    }
    if (input.runDispatch !== false) {
      next = runDispatch(next);
    }
    return saveFleetState(next);
  });
}

export async function fleetHeartbeat(input: {
  fleetId: string;
  applicationId: string;
  name: string;
  phone: string;
  online: boolean;
  latitude?: number;
  longitude?: number;
  heading?: number;
}): Promise<{ state: FleetState; blocked: boolean; reason?: string; driverToken?: string }> {
  return withFleetLock(async (state) => {
    const prev = state.drivers[input.fleetId];
    if (prev?.blocked) {
      return {
        state,
        blocked: true,
        reason: prev.blockedReason || 'Conta bloqueada pelo suporte.',
      };
    }
    const presence: FleetDriverPresence = {
      fleetId: input.fleetId,
      applicationId: input.applicationId,
      name: input.name,
      phone: input.phone,
      online: !!input.online,
      lastSeenAt: nowIso(),
      lastOfferAt: prev?.lastOfferAt,
      latitude: input.latitude,
      longitude: input.longitude,
      heading: input.heading,
      blocked: false,
      sessionToken: prev?.sessionToken || newSessionToken(),
    };
    let next: FleetState = {
      ...state,
      drivers: { ...state.drivers, [input.fleetId]: presence },
    };
    if (input.online) {
      next = runDispatch(next);
    }
    const saved = await saveFleetState(next);
    return { state: saved, blocked: false, driverToken: presence.sessionToken };
  });
}

export async function fleetClaim(input: {
  orderId: string;
  fleetId: string;
  name: string;
  phone: string;
  photoUrl?: string;
  bio?: string;
  vehicle?: string;
}): Promise<
  | { ok: true; order: Order; state: FleetState }
  | { ok: false; error: string; state: FleetState }
> {
  return withFleetLock(async (state) => {
    const current = state.orders.find((o) => o.id === input.orderId);
    if (!current) {
      return { ok: false, error: 'Pedido não encontrado na frota.', state };
    }
    const driver = state.drivers[input.fleetId];
    if (driver?.blocked) {
      return {
        ok: false,
        error: driver.blockedReason || 'Conta bloqueada pelo suporte.',
        state,
      };
    }
    if (current.status === 'cancelado' || current.status === 'entregue') {
      return { ok: false, error: 'Pedido não está disponível.', state };
    }
    if (
      current.driverId &&
      !isMockFleetDriverId(current.driverId) &&
      current.driverId !== input.fleetId
    ) {
      return {
        ok: false,
        error: 'Outro entregador já aceitou esta corrida.',
        state,
      };
    }
    if (current.driverId === input.fleetId) {
      return { ok: true, order: current, state };
    }
    if (
      !isOfferActive(current) ||
      current.offeredToDriverId !== input.fleetId
    ) {
      return {
        ok: false,
        error: 'Esta oferta não é mais sua ou expirou. Aguarde a próxima.',
        state,
      };
    }
    if (driverHasActiveJob(state.orders, input.fleetId)) {
      return {
        ok: false,
        error: 'Você já tem uma corrida ativa. Finalize antes de aceitar outra.',
        state,
      };
    }

    const nextOrder: Order = {
      ...current,
      driverId: input.fleetId,
      driverName: input.name,
      driverPhone: input.phone,
      driverPhotoUrl: input.photoUrl?.trim() || null,
      driverBio: input.bio?.trim() || null,
      driverVehicle: input.vehicle?.trim() || null,
      offeredToDriverId: null,
      offerExpiresAt: null,
      offerDeclinedBy: [],
      updatedAt: nowIso(),
    };
    let next: FleetState = {
      ...state,
      orders: state.orders.map((o) => (o.id === input.orderId ? nextOrder : o)),
    };
    next = runDispatch(next);
    const saved = await saveFleetState(next);
    return { ok: true, order: nextOrder, state: saved };
  });
}

export async function fleetDecline(input: {
  orderId: string;
  fleetId: string;
}): Promise<
  | { ok: true; order: Order; state: FleetState }
  | { ok: false; error: string; state: FleetState }
> {
  return withFleetLock(async (state) => {
    const current = state.orders.find((o) => o.id === input.orderId);
    if (!current) {
      return { ok: false, error: 'Pedido não encontrado na frota.', state };
    }
    if (current.offeredToDriverId !== input.fleetId || !isOfferActive(current)) {
      return { ok: false, error: 'Esta oferta não é mais sua.', state };
    }
    const declined = Array.from(
      new Set([...(current.offerDeclinedBy ?? []), input.fleetId])
    );
    const after: Order = {
      ...current,
      offeredToDriverId: null,
      offerExpiresAt: null,
      offerDeclinedBy: declined,
      updatedAt: nowIso(),
    };
    let next: FleetState = {
      ...state,
      orders: state.orders.map((o) => (o.id === input.orderId ? after : o)),
    };
    next = runDispatch(next);
    const saved = await saveFleetState(next);
    const order = saved.orders.find((o) => o.id === input.orderId) || after;
    return { ok: true, order, state: saved };
  });
}

export async function fleetRelease(input: {
  orderId: string;
  fleetId: string;
}): Promise<
  | { ok: true; order: Order; state: FleetState }
  | { ok: false; error: string; state: FleetState }
> {
  return withFleetLock(async (state) => {
    const current = state.orders.find((o) => o.id === input.orderId);
    if (!current) {
      return { ok: false, error: 'Pedido não encontrado na frota.', state };
    }
    if (current.driverId !== input.fleetId) {
      return { ok: false, error: 'Esta corrida não é sua.', state };
    }
    if (current.pickupVerifiedAt || current.status === 'saiu_entrega') {
      return {
        ok: false,
        error: 'Não dá para desistir depois da retirada no comércio.',
        state,
      };
    }
    if (current.status === 'entregue' || current.status === 'cancelado') {
      return { ok: false, error: 'Pedido já finalizado.', state };
    }
    const nextOrder: Order = {
      ...current,
      driverId: null,
      driverName: null,
      driverPhone: null,
      offeredToDriverId: null,
      offerExpiresAt: null,
      offerDeclinedBy: [],
      updatedAt: nowIso(),
    };
    let next: FleetState = {
      ...state,
      orders: state.orders.map((o) => (o.id === input.orderId ? nextOrder : o)),
    };
    next = runDispatch(next);
    const saved = await saveFleetState(next);
    return { ok: true, order: nextOrder, state: saved };
  });
}

export async function fleetAddReport(
  report: ConductReport
): Promise<FleetState> {
  return withFleetLock(async (state) => {
    const reports = [report, ...state.reports.filter((r) => r.id !== report.id)];
    return saveFleetState({ ...state, reports: reports.slice(0, 500) });
  });
}

export async function fleetAdmin(input: {
  pin?: string;
  token?: string;
  action: 'list' | 'block' | 'unblock' | 'set_report_status';
  fleetId?: string;
  reason?: string;
  reportId?: string;
  status?: ConductReport['status'];
}): Promise<{ ok: true; state: FleetState } | { ok: false; error: string }> {
  const expected = process.env.SUPPORT_PIN?.trim();
  const pinOk = !!(expected && input.pin && input.pin === expected);

  let staffOk = false;
  if (!pinOk && input.token) {
    try {
      const { loadPlatformState } = await import('@/services/platformStore');
      const { isStaffRole, applyCeoBootstrap } = await import('@/services/platformRoles');
      const state = await loadPlatformState();
      const session = state.sessions.find((s) => s.token === input.token);
      if (session && new Date(session.expiresAt).getTime() >= Date.now()) {
        const raw = state.users.find((u) => u.id === session.userId);
        if (raw) {
          const user = applyCeoBootstrap(raw);
          staffOk = isStaffRole(user.platformRole);
        }
      }
    } catch {
      staffOk = false;
    }
  }

  if (!pinOk && !staffOk) {
    return { ok: false, error: 'PIN de suporte inválido ou sessão HQ sem permissão.' };
  }

  if (
    input.action !== 'list' &&
    input.action !== 'block' &&
    input.action !== 'unblock' &&
    input.action !== 'set_report_status'
  ) {
    return { ok: false, error: 'Ação inválida.' };
  }
  if (
    (input.action === 'block' || input.action === 'unblock') &&
    !input.fleetId
  ) {
    return { ok: false, error: 'fleetId obrigatório.' };
  }
  if (input.action === 'set_report_status' && (!input.reportId || !input.status)) {
    return { ok: false, error: 'reportId e status obrigatórios.' };
  }

  const saved = await withFleetLock(async (current) => {
    if (input.action === 'list') {
      return current;
    }
    let next = current;
    if (input.action === 'block' && input.fleetId) {
      const prev = current.drivers[input.fleetId] || {
        fleetId: input.fleetId,
        applicationId: input.fleetId,
        name: 'Entregador',
        phone: '',
        online: false,
        lastSeenAt: nowIso(),
      };
      const drivers = {
        ...current.drivers,
        [input.fleetId]: {
          ...prev,
          online: false,
          blocked: true,
          blockedReason: input.reason || 'Bloqueado por denúncia.',
          blockedAt: nowIso(),
        },
      };
      const orders = current.orders.map((o) => {
        if (
          o.offeredToDriverId === input.fleetId &&
          isOrderUnassignedForDispatch(o)
        ) {
          return {
            ...o,
            offeredToDriverId: null,
            offerExpiresAt: null,
            updatedAt: nowIso(),
          };
        }
        if (
          o.driverId === input.fleetId &&
          !o.pickupVerifiedAt &&
          o.status !== 'entregue' &&
          o.status !== 'cancelado'
        ) {
          return {
            ...o,
            driverId: null,
            driverName: null,
            driverPhone: null,
            offeredToDriverId: null,
            offerExpiresAt: null,
            offerDeclinedBy: [],
            updatedAt: nowIso(),
          };
        }
        return o;
      });
      next = runDispatch({ ...current, drivers, orders });
    } else if (input.action === 'unblock' && input.fleetId) {
      const prev = current.drivers[input.fleetId];
      if (prev) {
        next = {
          ...current,
          drivers: {
            ...current.drivers,
            [input.fleetId]: {
              ...prev,
              blocked: false,
              blockedReason: undefined,
              blockedAt: undefined,
            },
          },
        };
      }
    } else if (
      input.action === 'set_report_status' &&
      input.reportId &&
      input.status
    ) {
      next = {
        ...current,
        reports: current.reports.map((r) =>
          r.id === input.reportId ? { ...r, status: input.status! } : r
        ),
      };
    }
    if (next === current) return current;
    return saveFleetState(next);
  });

  return { ok: true, state: saved };
}

export async function fleetDriverLocation(
  fleetId: string
): Promise<{ latitude: number; longitude: number; heading?: number; at: string } | null> {
  return withFleetLock(async (state) => {
    const d = state.drivers[fleetId];
    if (!d || typeof d.latitude !== 'number' || typeof d.longitude !== 'number') {
      return null;
    }
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      heading: d.heading,
      at: d.lastSeenAt,
    };
  });
}
