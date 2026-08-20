/**
 * Após N recusas no dia, o popup de oferta some da home do entregador.
 * As ofertas continuam na aba Disponíveis (/driver/jobs).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pecaja_driver_offer_declines_v1';

/** Quantas recusas no dia desligam o popup da home. */
export const DRIVER_OFFER_POPUP_DECLINE_LIMIT = 2;

type DayEntry = { day: string; count: number };
type Store = Record<string, DayEntry>;

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveStore(store: Store) {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

function entryFor(store: Store, fleetId: string): DayEntry {
  const day = todayKey();
  const prev = store[fleetId];
  if (!prev || prev.day !== day) return { day, count: 0 };
  return { day, count: Math.max(0, prev.count | 0) };
}

/** Quantas recusas o entregador já fez hoje. */
export async function getDriverOfferDeclineCount(fleetId: string): Promise<number> {
  if (!fleetId) return 0;
  const store = await loadStore();
  return entryFor(store, fleetId).count;
}

/** true = não mostrar popup / fila na home; só na aba Disponíveis. */
export async function isDriverOfferPopupMuted(fleetId: string): Promise<boolean> {
  const count = await getDriverOfferDeclineCount(fleetId);
  return count >= DRIVER_OFFER_POPUP_DECLINE_LIMIT;
}

/** Registra uma recusa. Retorna o novo estado. */
export async function recordDriverOfferDecline(fleetId: string): Promise<{
  count: number;
  muted: boolean;
}> {
  if (!fleetId) return { count: 0, muted: false };
  const store = await loadStore();
  const entry = entryFor(store, fleetId);
  entry.count += 1;
  store[fleetId] = entry;
  await saveStore(store);
  return {
    count: entry.count,
    muted: entry.count >= DRIVER_OFFER_POPUP_DECLINE_LIMIT,
  };
}

/** Zera o contador (ex.: ao aceitar uma corrida). */
export async function resetDriverOfferDeclines(fleetId: string): Promise<void> {
  if (!fleetId) return;
  const store = await loadStore();
  store[fleetId] = { day: todayKey(), count: 0 };
  await saveStore(store);
}
