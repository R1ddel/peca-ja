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

function customerOf(order: Order): LatLng {
  if (isValidLatLng(order.deliveryLatitude, order.deliveryLongitude)) {
    return {
      latitude: order.deliveryLatitude as number,
      longitude: order.deliveryLongitude as number,
    };
  }
  return resolveDeliveryCoords(order.address);
}

export function CustomerLiveMap({ order, viewer = 'customer', height = 240 }: Props) {
  const live = useDriverLivePosition(order.driverId);
  const driverPos = live
    ? { latitude: live.latitude, longitude: live.longitude }
    : null;
  const updatedAt = live?.at ?? null;

  const shop = useMemo(() => shopOf(order), [order]);
  const customer = useMemo(() => customerOf(order), [order]);
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
});
