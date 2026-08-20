/**
 * Alertas da cozinha: notificação + vibração (Expo Go safe).
 * Sem expo-av / reanimated.
 */
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notifyOrderUpdate } from '@/services/permissions';

const SEEN_KEY_PREFIX = '@pecaja_merchant_alerted_';

async function ensureNotifPermission(): Promise<boolean> {
  try {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      perm = await Notifications.requestPermissionsAsync();
    }
    return !!perm.granted;
  } catch {
    return false;
  }
}

function vibrateNewAlert() {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 400, 120, 400, 120, 500]);
    } else {
      Vibration.vibrate([0, 400, 150, 400]);
    }
  } catch {
    /* web / sem vibração */
  }
}

/** Vibração forte + notificação local de pedido novo. */
export async function alertMerchantNewOrder(opts: {
  orderId: string;
  shopOrderNumber?: number;
  businessName?: string;
  itemSummary?: string;
}): Promise<void> {
  const label =
    opts.shopOrderNumber != null
      ? `#${opts.shopOrderNumber}`
      : `#${opts.orderId.slice(-6).toUpperCase()}`;

  vibrateNewAlert();
  if (!(await ensureNotifPermission())) return;

  await notifyOrderUpdate({
    title: `🔔 Novo pedido ${label}`,
    body: opts.itemSummary
      ? `${opts.itemSummary} · toque para abrir a cozinha`
      : 'Pedido novo na fila — abra o painel Peça Já',
    orderId: opts.orderId,
    type: 'order',
  });
}

/** Cliente ou entregador mandou mensagem no chat do pedido. */
export async function alertMerchantCustomerChat(opts: {
  orderId: string;
  shopOrderNumber?: number;
  preview: string;
  peer?: 'merchant' | 'driver';
  from?: 'customer' | 'driver';
}): Promise<void> {
  const label =
    opts.shopOrderNumber != null
      ? `#${opts.shopOrderNumber}`
      : `#${opts.orderId.slice(-6).toUpperCase()}`;

  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 250, 100, 250]);
    } else {
      Vibration.vibrate([0, 250, 120, 250]);
    }
  } catch {
    /* ignore */
  }

  if (!(await ensureNotifPermission())) return;

  const who = opts.from === 'driver' ? 'Motoboy' : 'Cliente';
  const where = opts.peer === 'driver' ? 'chat da entrega' : 'chat com a loja';
  await notifyOrderUpdate({
    title: `💬 ${who} · pedido ${label}`,
    body: opts.preview.trim() || `Nova mensagem no ${where}`,
    orderId: opts.orderId,
    type: 'chat',
    peer: opts.peer ?? 'merchant',
  });
}

export function merchantAlertStorageKey(businessId: string) {
  return `${SEEN_KEY_PREFIX}${businessId}`;
}
