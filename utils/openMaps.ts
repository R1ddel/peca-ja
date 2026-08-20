/**
 * Deep links de navegação (Waze / Google / Apple) até coordenadas exatas.
 */
import { Linking, Platform } from 'react-native';

export type NavPoint = { latitude: number; longitude: number };

/** Abre busca de endereço no app de mapas do celular. */
export async function openMapsAddress(address: string, label = 'Destino'): Promise<void> {
  const q = encodeURIComponent(address.trim() || label);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${q}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`;
  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  }
}

/** Abre Google Maps / Apple Maps na posição do usuário (estilo app de delivery). */
export async function openMapsAt(
  latitude: number,
  longitude: number,
  label = 'Minha localização'
): Promise<void> {
  const encoded = encodeURIComponent(label);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  const can = await Linking.canOpenURL(url);
  if (can) {
    await Linking.openURL(url);
    return;
  }
  await Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`);
}

/** Abre rota de navegação do ponto A → B no app de mapas do celular. */
export async function openMapsRoute(
  from: NavPoint,
  to: NavPoint,
  toLabel = 'Destino'
): Promise<void> {
  const label = encodeURIComponent(toLabel);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?saddr=${from.latitude},${from.longitude}&daddr=${to.latitude},${to.longitude}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&travelmode=driving&dir_action=navigate`;

  try {
    await Linking.openURL(url);
  } catch {
    await openMapsAt(to.latitude, to.longitude, label);
  }
}

/**
 * Abre o Waze em navegação até o ponto exato (lat/lng).
 * Fallback: Google Maps navegação.
 */
export async function openWazeNavigate(
  to: NavPoint,
  toLabel = 'Destino'
): Promise<'waze' | 'google'> {
  const wazeApp = `waze://?ll=${to.latitude},${to.longitude}&navigate=yes`;
  const wazeWeb = `https://waze.com/ul?ll=${to.latitude},${to.longitude}&navigate=yes&zoom=17`;

  try {
    const canWaze = await Linking.canOpenURL(wazeApp);
    if (canWaze) {
      await Linking.openURL(wazeApp);
      return 'waze';
    }
  } catch {
    /* tenta web */
  }

  try {
    await Linking.openURL(wazeWeb);
    return 'waze';
  } catch {
    await openGoogleNavigate(to);
    return 'google';
  }
}

/** Google Maps navegação turn-by-turn até o pin exato. */
export async function openGoogleNavigate(to: NavPoint): Promise<void> {
  const url =
    Platform.OS === 'ios'
      ? `comgooglemaps://?daddr=${to.latitude},${to.longitude}&directionsmode=driving`
      : `google.navigation:q=${to.latitude},${to.longitude}&mode=d`;

  try {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    /* fallback */
  }

  await Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${to.latitude},${to.longitude}&travelmode=driving&dir_action=navigate`
  );
}
