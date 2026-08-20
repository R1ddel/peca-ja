/**
 * Alertas de chat (cliente / comércio / entregador): vibração + notificação local.
 */
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notifyOrderUpdate } from '@/services/permissions';

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

function vibrateChat() {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 220, 90, 220]);
    } else {
      Vibration.vibrate([0, 220, 100, 220]);
    }
  } catch {
    /* web */
  }
}

/** Nova mensagem no chat do pedido — qualquer lado. */
export async function alertIncomingChat(opts: {
  title: string;
  preview: string;
  orderId: string;
  peer?: string;
}): Promise<void> {
  vibrateChat();
  if (!(await ensureNotifPermission())) return;
  await notifyOrderUpdate({
    title: opts.title,
    body: opts.preview.trim() || 'Nova mensagem no chat',
    orderId: opts.orderId,
    type: 'chat',
    peer: opts.peer,
  });
}
