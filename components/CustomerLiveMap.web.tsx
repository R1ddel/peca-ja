/**
 * Acompanhamento do motoboy na web — Google Maps dentro do app.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Order } from '@/types';
import { theme } from '@/constants/theme';
import {
  isValidLatLng,
  resolveBusinessCoords,
  resolveDeliveryCoords,
  type LatLng,
} from '@/utils/orderGeo';
import { useDeliveryTarget } from '@/hooks/useDeliveryTarget';
import { deliveryTargetLabel } from '@/utils/deliveryTarget';
import { useDriverLivePosition } from '@/hooks/useDriverLivePosition';
import { InAppGoogleMap } from '@/components/InAppGoogleMap';

type Props = {
  order: Order;
  viewer?: 'customer' | 'merchant';
  height?: number;
};

function shopOf(order: Order): LatLng {
  if (isValidLatLng(order.businessLatitude, order.businessLongitude)) {
    return {
      latitude: order.businessLatitude as number,
      longitude: order.businessLongitude as number,
    };
  }
  return resolveBusinessCoords(order.businessId, order.businessName);
}

export function CustomerLiveMap({ order, viewer = 'customer', height = 240 }: Props) {
  const live = useDriverLivePosition(order.driverId);
  const driverPos = live
    ? { latitude: live.latitude, longitude: live.longitude }
    : null;
  const updatedAt = live?.at ?? null;

  const shop = useMemo(() => shopOf(order), [order]);
  const customerTarget = useDeliveryTarget(order);
  const customer = customerTarget.point ?? resolveDeliveryCoords(order.address || '');
  const toCustomer = !!order.pickupVerifiedAt || order.status === 'saiu_entrega';
  const dest = toCustomer ? customer : shop;
  const origin = driverPos || shop;

  const title =
    viewer === 'merchant'
      ? toCustomer
        ? 'Motoboy a caminho do cliente'
        : 'Motoboy a caminho da loja'
      : toCustomer
        ? 'Entregador a caminho'
        : 'Entregador indo à loja';

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Ionicons name="navigate" size={18} color={theme.colors.primary} />
        <Text style={styles.headTitle}>{title}</Text>
        {updatedAt ? (
          <Text style={styles.headMeta}>
            GPS{' '}
            {new Date(updatedAt).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        ) : (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
      </View>
      <View style={styles.pad}>
        <InAppGoogleMap
          center={origin}
          label={order.driverName || 'Motoboy'}
          cityLabel={toCustomer ? order.address : order.businessName}
          destination={dest}
          destinationLabel={toCustomer ? (viewer === 'merchant' ? 'Cliente' : 'Você') : 'Loja'}
          height={height}
        />
      </View>
      {customerTarget.source ? (
        <Text style={styles.source}>{deliveryTargetLabel(customerTarget.source)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headMeta: { fontSize: 11, color: theme.colors.textMuted },
  pad: { padding: 10, paddingTop: 0 },
  source: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
});
