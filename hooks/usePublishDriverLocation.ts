/**
 * Publica GPS do entregador na frota (cliente/comércio veem a rota).
 * Sem permissão ou sem leitura, não envia posição vazia — isso apagava o ponto no mapa.
 */
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { fleetHeartbeat } from '@/services/fleetClient';

type Presence = {
  fleetId: string;
  applicationId: string;
  name: string;
  phone: string;
  city?: string;
};

export type DriverGpsStatus = 'idle' | 'ok' | 'denied' | 'unavailable';

export function usePublishDriverLocation(
  presence: Presence | null,
  enabled: boolean
): DriverGpsStatus {
  const presenceRef = useRef(presence);
  presenceRef.current = presence;
  const [status, setStatus] = useState<DriverGpsStatus>('idle');

  useEffect(() => {
    if (!enabled || !presence) {
      setStatus('idle');
      return;
    }
    let alive = true;
    let sub: Location.LocationSubscription | null = null;

    const push = async (latitude: number, longitude: number, heading?: number) => {
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
        city: p.city,
      });
    };

    const readFix = async () => {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        heading:
          typeof pos.coords.heading === 'number' && pos.coords.heading >= 0
            ? pos.coords.heading
            : undefined,
      };
    };

    let beat: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      try {
        const { status: permission } = await Location.requestForegroundPermissionsAsync();
        if (!alive) return;
        if (permission !== 'granted') {
          setStatus('denied');
          return;
        }
        const current = await readFix();
        if (!alive) return;
        await push(current.latitude, current.longitude, current.heading);
        if (!alive) return;
        setStatus('ok');

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 4000,
          },
          (pos) => {
            if (!alive) return;
            setStatus('ok');
            void push(
              pos.coords.latitude,
              pos.coords.longitude,
              typeof pos.coords.heading === 'number' && pos.coords.heading >= 0
                ? pos.coords.heading
                : undefined
            );
          }
        );

        beat = setInterval(() => {
          void (async () => {
            if (!alive) return;
            try {
              const pos = await readFix();
              await push(pos.latitude, pos.longitude, pos.heading);
              if (alive) setStatus('ok');
            } catch {
              if (alive) setStatus('unavailable');
            }
          })();
        }, 12_000);
        if (!alive) {
          clearInterval(beat);
          beat = null;
        }
      } catch {
        if (alive) setStatus('unavailable');
      }
    })();

    return () => {
      alive = false;
      sub?.remove();
      if (beat) clearInterval(beat);
    };
  }, [enabled, presence?.fleetId, presence?.applicationId]);

  return status;
}
