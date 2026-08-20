import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Order } from '@/types';
import { theme } from '@/constants/theme';
import {
  resolveBusinessCoords,
  resolveDeliveryCoords,
  isValidLatLng,
} from '@/utils/orderGeo';
import {
  buildDeliveryLeg,
  formatDistanceKm,
  resolveBestRouteLeg,
} from '@/utils/driverRoute';

type Props = {
  order: Order;
  trackDriver?: boolean;
  compact?: boolean;
  featured?: boolean;
};

/** Fallback web. */
export function DriverRouteMap({ order, featured }: Props) {
  const shop = isValidLatLng(order.businessLatitude, order.businessLongitude)
    ? {
        latitude: order.businessLatitude as number,
        longitude: order.businessLongitude as number,
      }
    : resolveBusinessCoords(order.businessId, order.businessName);
  const customer = isValidLatLng(order.deliveryLatitude, order.deliveryLongitude)
    ? {
        latitude: order.deliveryLatitude as number,
        longitude: order.deliveryLongitude as number,
      }
    : resolveDeliveryCoords(order.address);

  const [leg, setLeg] = useState(() =>
    buildDeliveryLeg(shop, customer, 'Loja → Cliente')
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const next = await resolveBestRouteLeg(shop, customer, 'Loja → Cliente');
      if (!cancelled) {
        setLeg(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order.id, shop.latitude, shop.longitude, customer.latitude, customer.longitude]);

  function openFullscreen() {
    router.push({
      pathname: '/driver/nav/[id]' as any,
      params: { id: order.id },
    });
  }

  return (
    <View style={[styles.box, featured && styles.boxFeatured]}>
      <Text style={styles.title}>
        {featured ? 'Rota atual da entrega' : 'Rota da entrega'}
      </Text>
      {loading ? (
        <ActivityIndicator color="#7C3AED" />
      ) : (
        <Text style={styles.meta}>
          {formatDistanceKm(leg.distanceKm)} · ~{leg.minutes} min
          {leg.source === 'osrm' ? ' · melhor rota' : ''}
        </Text>
      )}
      <Text style={styles.addr} numberOfLines={2}>
        {order.address}
      </Text>
      <TouchableOpacity style={styles.btn} onPress={openFullscreen}>
        <Ionicons name="expand" size={16} color="#fff" />
        <Text style={styles.btnText}>Navegação tela cheia</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
    gap: 6,
  },
  boxFeatured: {
    borderWidth: 2,
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
    marginBottom: 0,
  },
  title: { fontWeight: '800', color: theme.colors.text },
  meta: { color: '#6D28D9', fontWeight: '700' },
  addr: { color: theme.colors.textMuted, fontSize: 12 },
  btn: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnText: { color: '#fff', fontWeight: '800' },
});
