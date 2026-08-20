/**
 * Sistema de permissões do Peça Já (Expo Go / SDK 54).
 * Localização em primeiro plano + notificações locais + câmera/fotos.
 *
 * Push remoto no Android exige development build (não Expo Go) —
 * aqui usamos permissão + notificações locais para status do pedido.
 */

import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getActiveDemoLocation } from '@/utils/demoLocation';

export const PERMISSIONS_ONBOARDING_KEY = '@pecaja_permissions_onboarding_v1';

export type PermissionId =
  | 'notifications'
  | 'location'
  | 'camera'
  | 'photos';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export type PermissionInfo = {
  id: PermissionId;
  title: string;
  description: string;
  why: string;
  icon: string;
  status: PermissionState;
  canAskAgain: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function mapStatus(
  status: string | undefined,
  granted?: boolean
): PermissionState {
  if (granted === true || status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  if (status === 'undetermined') return 'undetermined';
  return 'unavailable';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Pedidos',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#00A86B',
  });
}

export async function getPermissionStatuses(): Promise<PermissionInfo[]> {
  const [notif, loc, cam, photos] = await Promise.all([
    Notifications.getPermissionsAsync().catch(() => null),
    Location.getForegroundPermissionsAsync().catch(() => null),
    ImagePicker.getCameraPermissionsAsync().catch(() => null),
    ImagePicker.getMediaLibraryPermissionsAsync().catch(() => null),
  ]);

  return [
    {
      id: 'notifications',
      title: 'Notificações',
      description: 'Avisos de pedido, preparação e saída para entrega.',
      why: 'Para você acompanhar o pedido sem abrir o app o tempo todo.',
      icon: 'notifications-outline',
      status: notif
        ? mapStatus(notif.status, notif.granted)
        : 'unavailable',
      canAskAgain: notif?.canAskAgain ?? true,
    },
    {
      id: 'location',
      title: 'Localização',
      description: 'Comércios perto de você e estimativa de entrega.',
      why: 'Usamos só enquanto o app está aberto (rastreio de proximidade).',
      icon: 'locate-outline',
      status: loc ? mapStatus(loc.status, loc.granted) : 'unavailable',
      canAskAgain: loc?.canAskAgain ?? true,
    },
    {
      id: 'camera',
      title: 'Câmera',
      description: 'Tirar foto de perfil ou capa.',
      why: 'Só quando você escolher tirar uma foto no perfil.',
      icon: 'camera-outline',
      status: cam ? mapStatus(cam.status, cam.granted) : 'unavailable',
      canAskAgain: cam?.canAskAgain ?? true,
    },
    {
      id: 'photos',
      title: 'Fotos',
      description: 'Escolher imagem da galeria para perfil e capa.',
      why: 'Só quando você abrir a galeria no perfil.',
      icon: 'images-outline',
      status: photos ? mapStatus(photos.status, photos.granted) : 'unavailable',
      canAskAgain: photos?.canAskAgain ?? true,
    },
  ];
}

export async function requestPermission(id: PermissionId): Promise<PermissionState> {
  try {
    if (id === 'notifications') {
      await ensureAndroidChannel();
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return 'granted';
      const res = await Notifications.requestPermissionsAsync();
      return mapStatus(res.status, res.granted);
    }
    if (id === 'location') {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.granted) return 'granted';
      const res = await Location.requestForegroundPermissionsAsync();
      return mapStatus(res.status, res.granted);
    }
    if (id === 'camera') {
      const res = await ImagePicker.requestCameraPermissionsAsync();
      return mapStatus(res.status, res.granted);
    }
    if (id === 'photos') {
      const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return mapStatus(res.status, res.granted);
    }
  } catch {
    return 'unavailable';
  }
  return 'unavailable';
}

/** Pede as permissões essenciais do onboarding (notif + localização). */
export async function requestEssentialPermissions(): Promise<void> {
  await requestPermission('notifications');
  await requestPermission('location');
}

export async function hasCompletedPermissionsOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PERMISSIONS_ONBOARDING_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markPermissionsOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(PERMISSIONS_ONBOARDING_KEY, '1');
}

export async function openSystemSettings(): Promise<void> {
  await Linking.openSettings();
}

export type UserCoords = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

/** Posição atual se a permissão estiver liberada (ou modo demo de cidade). */
export async function getCurrentCoords(): Promise<UserCoords | null> {
  const demo = getActiveDemoLocation();
  if (demo) {
    return {
      latitude: demo.latitude,
      longitude: demo.longitude,
      accuracy: 15,
    };
  }

  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return null;
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch {
    return null;
  }
}

export type UserPlaceDetails = {
  latitude: number;
  longitude: number;
  /** Sempre só o município (cidade onde a pessoa mora). */
  city: string;
  /** Alias de city — usado no chip da Home. */
  shortLabel: string;
  fullLabel: string;
};

/** Escolhe UM município — nunca junta duas cidades (ex.: Seabra + Mucugê). */
function pickCityOnly(p: Location.LocationGeocodedAddress | undefined): string {
  if (!p) return '';
  const candidates = [p.city, p.subregion, p.district, p.region]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  // Preferência: city explícita do reverse geocode
  if (p.city?.trim()) return p.city.trim();

  // Senão o primeiro candidato válido (um só)
  return candidates[0] ?? '';
}

/**
 * Lê GPS + reverse geocode.
 * Retorna apenas a cidade onde a pessoa está (sem bairro nem cidades vizinhas).
 * Modo demo: força cidade/coords (ex.: Vale do Capão).
 */
export async function getUserPlaceDetails(): Promise<UserPlaceDetails | null> {
  const demo = getActiveDemoLocation();
  if (demo) {
    return {
      latitude: demo.latitude,
      longitude: demo.longitude,
      city: demo.city,
      shortLabel: demo.city,
      fullLabel: `${demo.city} · ${demo.tagline}`,
    };
  }

  const coords = await getCurrentCoords();
  if (!coords) return null;

  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    const city = pickCityOnly(places[0]) || 'Sua cidade';

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      city,
      shortLabel: city,
      fullLabel: city,
    };
  } catch {
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      city: 'Sua cidade',
      shortLabel: 'Sua cidade',
      fullLabel: 'Sua cidade',
    };
  }
}

/** Rótulo da Home: só a cidade. */
export async function getApproxLocationLabel(): Promise<string | null> {
  const place = await getUserPlaceDetails();
  return place?.city ?? null;
}

export async function notifyOrderUpdate(opts: {
  title: string;
  body: string;
  orderId?: string;
  delaySeconds?: number;
  /** order | chat — usado na navegação do painel */
  type?: 'order' | 'chat';
  peer?: string;
}): Promise<string | null> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return null;
    await ensureAndroidChannel();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: {
          orderId: opts.orderId ?? null,
          type: opts.type ?? 'order',
          peer: opts.peer ?? null,
        },
        sound: true,
      },
      trigger:
        opts.delaySeconds && opts.delaySeconds > 0
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: opts.delaySeconds,
              channelId: 'orders',
            }
          : null,
    });
    return id;
  } catch {
    return null;
  }
}

/** Agenda avisos alinhados ao fluxo real (timer só até preparo; resto por código). */
export async function scheduleOrderStatusNotifications(order: {
  id: string;
  businessName: string;
  status: string;
}): Promise<void> {
  const name = order.businessName;
  const steps = [
    {
      delay: 1,
      title: 'Pedido confirmado',
      body: `Pagamento ok · ${name} recebeu seu pedido.`,
    },
    {
      delay: 9,
      title: 'Em preparo',
      body: `${name} está preparando seu pedido.`,
    },
  ];

  for (const step of steps) {
    await notifyOrderUpdate({
      title: step.title,
      body: step.body,
      orderId: order.id,
      delaySeconds: step.delay,
    });
  }
}

/** Aviso imediato quando o status muda de verdade (retirada / entrega / pronto). */
export async function notifyOrderStatusNow(order: {
  id: string;
  businessName: string;
  status: string;
  cancelReason?: string;
}): Promise<void> {
  const name = order.businessName;
  const map: Record<string, { title: string; body: string }> = {
    preparando: {
      title: 'Em preparo',
      body: `${name} está preparando seu pedido.`,
    },
    kitchen_ready: {
      title: 'Pedido pronto',
      body: `${name} terminou seu pedido. O entregador já pode retirar.`,
    },
    saiu_entrega: {
      title: 'Saiu para entrega',
      body: `Seu pedido de ${name} está a caminho. Mostre seu código ao entregador.`,
    },
    entregue: {
      title: 'Pedido entregue',
      body: `Pedido de ${name} entregue. Bom apetite!`,
    },
    cancelado: {
      title: 'Pedido cancelado',
      body: order.cancelReason
        ? `Seu pedido em ${name} foi cancelado: ${order.cancelReason}`
        : `Seu pedido em ${name} foi cancelado.`,
    },
  };
  const msg = map[order.status];
  if (!msg) return;
  await notifyOrderUpdate({
    title: msg.title,
    body: msg.body,
    orderId: order.id,
    delaySeconds: 0,
  });
}
