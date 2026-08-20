/**
 * Publica GPS do entregador na frota (cliente/comércio veem a rota).
 */
import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { fleetHeartbeat } from '@/services/fleetClient';

type Presence = {
  fleetId: string;
  applicationId: string;
  name: string;
  phone: string;
};

export function usePublishDriverLocation(presence: Presence | null, enabled: boolean) {
  const presenceRef = useRef(presence);
  presenceRef.current = presence;

  useEffect(() => {
    if (!enabled || !presence) return;
    let alive = true;
    let sub: Location.LocationSubscription | null = null;

    const push = async (latitude?: number, longitude?: number, heading?: number) => {
      const p = presenceRef.current;
      if (!p || !alive) return;
      await fleetHeartbeat({
        fleetId: p.fleetId,
        applicationId: p.applicationId,
        name: p.name,
        phone: p.phone,
        online: true,
        latitude,
        longitude,
        heading,
      });
    };

    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!alive || status !== 'granted') {
          await push();
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!alive) return;
        await push(
          current.coords.latitude,
          current.coords.longitude,
          typeof current.coords.heading === 'number' && current.coords.heading >= 0
            ? current.coords.heading
            : undefined
        );

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 4000,
          },
          (pos) => {
            void push(
              pos.coords.latitude,
              pos.coords.longitude,
              typeof pos.coords.heading === 'number' && pos.coords.heading >= 0
                ? pos.coords.heading
                : undefined
            );
          }
        );
      } catch {
        await push();
      }
    })();

    const beat = setInterval(() => {
      void (async () => {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          await push(pos.coords.latitude, pos.coords.longitude);
        } catch {
          await push();
        }
      })();
    }, 12_000);

    return () => {
      alive = false;
      sub?.remove();
      clearInterval(beat);
    };
  }, [enabled, presence?.fleetId, presence?.applicationId]);
}
