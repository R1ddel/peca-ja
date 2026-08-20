/**
 * Cliente da frota compartilhada (vários aparelhos → mesmo host Expo).
 * Offline: retorna null e o app cai no dispatch local.
 */
import type { ConductReport, Order } from '@/types';
import { getFleetBaseUrl } from '@/services/apiBase';
import type { FleetDriverPresence } from '@/services/fleetTypes';
import {
  getFleetDriverToken,
  setFleetDriverToken,
} from '@/utils/fleetDriverToken';
import { getPlatformToken } from '@/services/platformSession';

export { mergeOrdersPreferNewer } from '@/utils/orderMerge';

export type FleetSyncPayload = {
  ok: boolean;
  revision?: number;
  updatedAt?: string;
  orders?: Order[];
  drivers?: Record<string, FleetDriverPresence>;
  reports?: ConductReport[];
  order?: Order;
  driverToken?: string;
  location?: {
    latitude: number;
    longitude: number;
    heading?: number;
    at: string;
  } | null;
  message?: string;
  code?: string;
  persistence?: 'postgres' | 'filesystem';
};

const TIMEOUT_MS = 8000;

async function postFleet(
  body: Record<string, unknown>
): Promise<FleetSyncPayload | null> {
  try {
    const base = getFleetBaseUrl();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${base}/api/fleet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const json = (await res.json()) as FleetSyncPayload;
    if (!res.ok && !json) return null;
    return json;
  } catch {
    return null;
  }
}

export async function fleetHealth(): Promise<{
  ok: boolean;
  persistence?: 'postgres' | 'filesystem';
  baseUrl: string;
} | null> {
  try {
    const base = getFleetBaseUrl();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${base}/api/fleet`, {
      method: 'GET',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const json = (await res.json()) as FleetSyncPayload & {
      persistence?: 'postgres' | 'filesystem';
    };
    if (!res.ok) return { ok: false, baseUrl: base };
    return {
      ok: true,
      persistence: json.persistence,
      baseUrl: base,
    };
  } catch {
    return null;
  }
}

export async function fleetPushAndPull(
  orders: Order[],
  opts?: { runDispatch?: boolean }
): Promise<FleetSyncPayload | null> {
  // Envia só pedidos ativos + entregues recentes (14 dias já no server)
  const slim = orders.filter((o) => {
    if (o.status !== 'entregue' && o.status !== 'cancelado') return true;
    const t = +new Date(o.updatedAt || o.createdAt);
    return Date.now() - t < 14 * 86_400_000;
  });
  const token = await getPlatformToken();
  return postFleet({
    action: 'sync',
    orders: slim,
    runDispatch: opts?.runDispatch !== false,
    ...(token ? { token } : {}),
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
}): Promise<FleetSyncPayload | null> {
  const res = await postFleet({ action: 'heartbeat', ...input });
  if (res?.ok && res.driverToken) {
    await setFleetDriverToken(input.fleetId, res.driverToken);
  }
  return res;
}

export async function fleetClaimRemote(input: {
  orderId: string;
  fleetId: string;
  name: string;
  phone: string;
  photoUrl?: string;
  bio?: string;
  vehicle?: string;
}): Promise<FleetSyncPayload | null> {
  const driverToken = await getFleetDriverToken(input.fleetId);
  return postFleet({ action: 'claim', ...input, driverToken });
}

export async function fleetDeclineRemote(input: {
  orderId: string;
  fleetId: string;
}): Promise<FleetSyncPayload | null> {
  const driverToken = await getFleetDriverToken(input.fleetId);
  return postFleet({ action: 'decline', ...input, driverToken });
}

export async function fleetReleaseRemote(input: {
  orderId: string;
  fleetId: string;
}): Promise<FleetSyncPayload | null> {
  const driverToken = await getFleetDriverToken(input.fleetId);
  return postFleet({ action: 'release', ...input, driverToken });
}

export async function fleetReportRemote(
  report: ConductReport
): Promise<FleetSyncPayload | null> {
  return postFleet({ action: 'report', report });
}

export async function fleetDriverLocationRemote(
  fleetId: string
): Promise<FleetSyncPayload | null> {
  return postFleet({ action: 'location', fleetId });
}

export async function fleetAdminRemote(input: {
  pin?: string;
  token?: string;
  adminAction: 'list' | 'block' | 'unblock' | 'set_report_status';
  fleetId?: string;
  reason?: string;
  reportId?: string;
  status?: ConductReport['status'];
}): Promise<FleetSyncPayload | null> {
  return postFleet({ action: 'admin', ...input });
}
