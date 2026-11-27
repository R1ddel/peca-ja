/**
 * Ponto do pedido no mapa: GPS do celular, senão o pin salvo, senão o endereço.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  deliveryTargetFromOrder,
  type DeliveryTarget,
  type DeliveryTargetOrder,
} from '@/utils/deliveryTarget';
import { geocodeAddressLine } from '@/utils/geocodeAddress';
import type { LatLng } from '@/utils/orderGeo';

export function useDeliveryTarget(
  order: DeliveryTargetOrder | null | undefined
): DeliveryTarget | { point: null; source: null; precise: false } {
  const sync = useMemo(
    () => (order ? deliveryTargetFromOrder(order) : null),
    [
      order?.address,
      order?.city,
      order?.deliveryLatitude,
      order?.deliveryLongitude,
      order?.customerLiveLatitude,
      order?.customerLiveLongitude,
      order?.customerLiveAt,
    ]
  );

  const [geocoded, setGeocoded] = useState<{ query: string; point: LatLng } | null>(
    null
  );

  const query = order
    ? [order.address?.trim(), order.city?.trim()].filter(Boolean).join(', ')
    : '';

  useEffect(() => {
    if (!order || sync?.source !== 'address' || query.length < 4) return;
    let cancelled = false;
    void geocodeAddressLine(order.address || '', order.city).then((point) => {
      if (cancelled || !point) return;
      setGeocoded({ query, point });
    });
    return () => {
      cancelled = true;
    };
  }, [sync?.source, query, order?.address, order?.city]);

  if (!order || !sync) return { point: null, source: null, precise: false };
  if (
    sync.source === 'address' &&
    geocoded &&
    geocoded.query === query
  ) {
    return { point: geocoded.point, source: 'address', precise: true };
  }
  return sync;
}
