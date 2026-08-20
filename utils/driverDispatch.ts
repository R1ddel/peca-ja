/**
 * Fila justa de corridas (cliente): wrappers AsyncStorage + núcleo puro.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '@/types';
import { DriverApplication } from '@/utils/partners';
import { getDriverOnline, driverFleetId } from '@/utils/driverOps';
import {
  DRIVER_OFFER_SECONDS,
  applyDispatchPatches,
  computeFairDispatchPatchesSync,
  countDeliveriesToday,
  driverHasActiveJob,
  driverHasOpenOffer,
  getOfferForDriver,
  isOfferActive,
  isOrderUnassignedForDispatch,
  listDispatchQueue,
  offerSecondsLeft,
  queueWaitingCount,
  type DispatchPatch,
  type DriverCandidate,
} from '@/utils/driverDispatchCore';

export {
  DRIVER_OFFER_SECONDS,
  applyDispatchPatches,
  countDeliveriesToday,
  driverHasActiveJob,
  driverHasOpenOffer,
  getOfferForDriver,
  isOfferActive,
  isOrderUnassignedForDispatch,
  listDispatchQueue,
  offerSecondsLeft,
  queueWaitingCount,
};
export type { DispatchPatch, DriverCandidate };

const LAST_OFFER_KEY = '@pecaja_driver_last_offer_at_v1';
const APPS_KEY = '@pecaja_partner_applications';

async function loadLastOfferMap(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(LAST_OFFER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function touchLastOffers(fleetIds: string[]): Promise<void> {
  if (!fleetIds.length) return;
  const map = await loadLastOfferMap();
  const now = Date.now();
  for (const id of fleetIds) map[id] = now;
  await AsyncStorage.setItem(LAST_OFFER_KEY, JSON.stringify(map));
}

export async function listApprovedOnlineDrivers(
  orders: Order[]
): Promise<DriverCandidate[]> {
  const lastOffers = await loadLastOfferMap();
  let apps: DriverApplication[] = [];
  try {
    const raw = await AsyncStorage.getItem(APPS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      apps = list.filter(
        (a: DriverApplication) =>
          a?.role === 'driver' &&
          a.status === 'approved' &&
          a.termsStatus === 'accepted'
      );
    }
  } catch {
    apps = [];
  }

  const out: DriverCandidate[] = [];
  for (const app of apps) {
    const fleetId = driverFleetId(app);
    const online = await getDriverOnline(fleetId);
    if (!online) continue;
    out.push({
      fleetId,
      applicationId: app.id,
      name: app.name,
      phone: app.phone,
      deliveriesToday: countDeliveriesToday(orders, fleetId),
      lastOfferAt: lastOffers[fleetId] ?? 0,
    });
  }

  out.sort((a, b) => {
    if (a.deliveriesToday !== b.deliveriesToday) {
      return a.deliveriesToday - b.deliveriesToday;
    }
    return a.lastOfferAt - b.lastOfferAt;
  });
  return out;
}

/**
 * Atribui ofertas exclusivas (local). Preferir frota remota quando online.
 */
export async function computeFairDispatchPatches(
  orders: Order[],
  nowMs = Date.now()
): Promise<DispatchPatch[]> {
  const drivers = await listApprovedOnlineDrivers(orders);
  const { patches, offeredFleetIds } = computeFairDispatchPatchesSync(
    orders,
    drivers,
    nowMs
  );
  await touchLastOffers(offeredFleetIds);
  return patches;
}
