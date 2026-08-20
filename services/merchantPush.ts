/**
 * Push do comerciante: registra token Expo + abre pedido ao tocar na notificação.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';

const TOKEN_KEY = '@pecaja_merchant_push_token';

export async function getStoredMerchantPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Registra token Expo Push (funciona no Expo Go com limitações). */
export async function registerMerchantPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice && Platform.OS !== 'web') {
      // Emulador: ainda tenta
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      final = req.status;
    }
    if (final !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenRes.data;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

let responseSub: Notifications.Subscription | null = null;

/** Ao tocar na notificação, abre pedido ou chat. */
export function attachMerchantNotificationNavigator() {
  if (responseSub) return;
  responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      orderId?: string;
      type?: string;
      peer?: string;
    };
    if (!data?.orderId) return;
    if (data.type === 'chat') {
      router.push({
        pathname: '/merchant/chat/[orderId]' as any,
        params: {
          orderId: String(data.orderId),
          peer: data.peer === 'driver' ? 'driver' : 'merchant',
        },
      });
      return;
    }
    router.push({
      pathname: '/merchant/order/[id]' as any,
      params: { id: String(data.orderId) },
    });
  });
}

export function detachMerchantNotificationNavigator() {
  responseSub?.remove();
  responseSub = null;
}
