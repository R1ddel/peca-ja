/**
 * Posição ao vivo do motoboy de um pedido.
 * Usa o GPS que já vem no sync da frota e, em paralelo, a consulta de localização.
 */
import { useEffect, useState } from 'react';
import { useOrders, type DriverLiveFix } from '@/context/OrdersContext';
import { fleetDriverLocationRemote } from '@/services/fleetClient';
import { isValidLatLng } from '@/utils/orderGeo';

function newer(a: DriverLiveFix | null, b: DriverLiveFix | null): DriverLiveFix | null {
  if (!a) return b;
  if (!b) return a;
  return +new Date(a.at || 0) >= +new Date(b.at || 0) ? a : b;
}

export function useDriverLivePosition(driverId?: string | null): DriverLiveFix | null {
  const { driverLocations } = useOrders();
  const fromSync = driverId ? driverLocations[driverId] ?? null : null;
  const [polled, setPolled] = useState<DriverLiveFix | null>(null);

  useEffect(() => {
    if (!driverId) return;
    let alive = true;
    const poll = async () => {
      const res = await fleetDriverLocationRemote(driverId);
      if (!alive) return;
      const loc = res?.location;
      if (!res?.ok || !loc || !isValidLatLng(loc.latitude, loc.longitude)) return;
      setPolled({
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: loc.heading,
        at: loc.at,
      });
    };
    void poll();
    const id = setInterval(() => void poll(), 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [driverId]);

  return newer(fromSync, polled);
}
