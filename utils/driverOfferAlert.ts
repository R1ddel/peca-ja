/**
 * Alerta local quando chega oferta exclusiva (janela de 45s).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyOrderUpdate } from '@/services/permissions';
import { DRIVER_OFFER_SECONDS } from '@/utils/driverDispatchCore';

const SEEN_KEY = '@pecaja_driver_offer_alert_seen_v1';

async function loadSeen(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function markSeen(orderId: string, expiresAt: string) {
  const map = await loadSeen();
  map[orderId] = expiresAt;
  // Mantém só entradas recentes
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, exp] of Object.entries(map)) {
    if (+new Date(exp) < cutoff) delete map[id];
  }
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(map));
}

export async function alertExclusiveOffer(opts: {
  orderId: string;
  businessName: string;
  address: string;
  freteLabel: string;
  offerExpiresAt: string;
}): Promise<void> {
  const seen = await loadSeen();
  if (seen[opts.orderId] === opts.offerExpiresAt) return;
  await markSeen(opts.orderId, opts.offerExpiresAt);
  const left = Math.max(
    5,
    Math.min(
      DRIVER_OFFER_SECONDS,
      Math.ceil((+new Date(opts.offerExpiresAt) - Date.now()) / 1000)
    )
  );
  await notifyOrderUpdate({
    title: `Corrida exclusiva · ${left}s`,
    body: `${opts.businessName} · ${opts.freteLabel}\n${opts.address}`,
    orderId: opts.orderId,
    delaySeconds: 0,
    type: 'order',
    peer: 'driver',
  });
}
