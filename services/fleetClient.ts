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
import { getDriverSession } from '@/utils/driverSession';
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
  const session = await getDriverSession();
  const fleetId = session?.applicationId ? `da_${session.applicationId}` : '';
  const driverToken = fleetId ? await getFleetDriverToken(fleetId) : null;
  if (!token && !driverToken) {
    return {
      ok: false,
      code: 'AUTH',
      message: 'Sync da frota só com sessão ou token de entregador.',
    };
  }
  return postFleet({
    action: 'sync',
    orders: slim,
    runDispatch: opts?.runDispatch !== false,
    ...(token ? { token } : {}),
    ...(fleetId ? { fleetId } : {}),
    ...(driverToken ? { driverToken } : {}),
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
  city?: string;
}): Promise<FleetSyncPayload | null> {
  let driverToken = await getFleetDriverToken(input.fleetId);
  if (!driverToken) {
    const token = await getPlatformToken();
    if (!token) {
      return {
        ok: false,
        code: 'AUTH',
        message: 'Heartbeat exige login do entregador.',
      };
    }
    const auth = await postFleet({
      action: 'driver_auth',
      fleetId: input.fleetId,
      applicationId: input.applicationId,
      name: input.name,
      phone: input.phone,
      city: input.city,
      token,
    });
    if (!auth?.ok || !auth.driverToken) {
      return auth || { ok: false, code: 'AUTH', message: 'Não foi possível autenticar o entregador.' };
    }
    driverToken = auth.driverToken;
    await setFleetDriverToken(input.fleetId, driverToken);
  }
  return postFleet({
    action: 'heartbeat',
    fleetId: input.fleetId,
    applicationId: input.applicationId,
    online: input.online,
    latitude: input.latitude,
    longitude: input.longitude,
    heading: input.heading,
    driverToken,
  });
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
  const token = await getPlatformToken();
  const session = await getDriverSession();
  const fleetId = session?.applicationId ? `da_${session.applicationId}` : '';
  const driverToken = fleetId ? await getFleetDriverToken(fleetId) : null;
  return postFleet({
    action: 'report',
    report,
    ...(fleetId ? { fleetId } : {}),
    ...(token ? { token } : {}),
    ...(driverToken ? { driverToken } : {}),
  });
}

export async function fleetDriverLocationRemote(
  fleetId: string
): Promise<FleetSyncPayload | null> {
  const token = await getPlatformToken();
  const driverToken = await getFleetDriverToken(fleetId);
  return postFleet({
    action: 'location',
    fleetId,
    ...(token ? { token } : {}),
    ...(driverToken ? { driverToken } : {}),
  });
}

export async function fleetAdminRemote(input: {
  pin?: string;
  token?: string;
  adminAction: 'list' | 'block' | 'unblock' | 'set_report_status';
  hqMode?: 'real' | 'projection';
  fleetId?: string;
  reason?: string;
  reportId?: string;
  status?: ConductReport['status'];
}): Promise<FleetSyncPayload | null> {
  return postFleet({ action: 'admin', ...input });
}
