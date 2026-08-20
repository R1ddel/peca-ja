/**
 * Token de sessão da frota (emitido no heartbeat).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pecaja_fleet_driver_token_v1';

export async function getFleetDriverToken(fleetId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[fleetId] || null;
  } catch {
    return null;
  }
}

export async function setFleetDriverToken(
  fleetId: string,
  token: string
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[fleetId] = token;
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
