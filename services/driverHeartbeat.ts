/**
 * Heartbeat do entregador → frota compartilhada (online + GPS).
 */
import * as Location from 'expo-location';
import { fleetHeartbeat } from '@/services/fleetClient';

export type HeartbeatDriver = {
  fleetId: string;
  applicationId: string;
  name: string;
  phone: string;
};

export async function sendDriverHeartbeat(
  driver: HeartbeatDriver,
  online: boolean
): Promise<{ ok: boolean; blocked?: boolean; message?: string }> {
  let latitude: number | undefined;
  let longitude: number | undefined;
  let heading: number | undefined;

  if (online) {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted) {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
        heading =
          typeof pos.coords.heading === 'number' && pos.coords.heading >= 0
            ? pos.coords.heading
            : undefined;
      }
    } catch {
      /* GPS opcional */
    }
  }

  const res = await fleetHeartbeat({
    fleetId: driver.fleetId,
    applicationId: driver.applicationId,
    name: driver.name,
    phone: driver.phone,
    online,
    latitude,
    longitude,
    heading,
  });

  if (!res) return { ok: false };
  if (res.ok === false && res.code === 'BLOCKED') {
    return { ok: false, blocked: true, message: res.message };
  }
  return { ok: !!res.ok, message: res.message };
}
