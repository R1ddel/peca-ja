/**
 * Rota do motoboy na web — Google Maps dentro do app + atalho Waze.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import type { Order } from '@/types';
import { theme } from '@/constants/theme';
import {
  isValidLatLng,
  resolveBusinessCoords,
  resolveDeliveryCoords,
  type LatLng,
} from '@/utils/orderGeo';
import {
  formatDistanceKm,
  resolveBestRouteLeg,
  routeKey,
} from '@/utils/driverRoute';
import { InAppGoogleMap } from '@/components/InAppGoogleMap';

type Props = {
  order: Order;
  trackDriver?: boolean;
  compact?: boolean;
  featured?: boolean;
  fullscreen?: boolean;
};

function orderShop(order: Order): LatLng {
  if (isValidLatLng(order.businessLatitude, order.businessLongitude)) {
    return {
      latitude: order.businessLatitude as number,
      longitude: order.businessLongitude as number,
    };
  }
  return resolveBusinessCoords(order.businessId, order.businessName);
}

function orderCustomer(order: Order): LatLng {
  if (isValidLatLng(order.deliveryLatitude, order.deliveryLongitude)) {
    return {
      latitude: order.deliveryLatitude as number,
      longitude: order.deliveryLongitude as number,
    };
  }
  return resolveDeliveryCoords(order.address);
}

export function DriverRouteMap({
  order,
  trackDriver = true,
  compact = false,
  featured = false,
  fullscreen = false,
}: Props) {
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [routing, setRouting] = useState(true);
  const [distanceKm, setDistanceKm] = useState(0);
  const [minutes, setMinutes] = useState(0);

  const shop = useMemo(() => orderShop(order), [order]);
  const customer = useMemo(() => orderCustomer(order), [order]);
  const phase: 'to_shop' | 'to_customer' =
    order.pickupVerifiedAt || order.status === 'saiu_entrega' ? 'to_customer' : 'to_shop';
  const destination = phase === 'to_shop' ? shop : customer;
  const origin = driverPos ?? shop;
  const target = driverPos ? destination : customer;
  const routeLabel = !driverPos
    ? 'Loja → Cliente'
    : phase === 'to_shop'
      ? 'Você → Loja'
      : 'Você → Cliente';

  useEffect(() => {
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;
    if (!trackDriver) return;
    void (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled || perm.status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setDriverPos({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 40, timeInterval: 5000 },
          (pos) => {
            if (cancelled) return;
            setDriverPos({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          }
        );
      } catch {
        /* sem GPS */
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [trackDriver]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (!cancelled) setRouting(true);
        const next = await resolveBestRouteLeg(origin, target, routeLabel);
        if (cancelled) return;
        setDistanceKm(next.distanceKm);
        setMinutes(next.minutes);
        setRouting(false);
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [order.id, phase, routeKey(origin, target), routeLabel]);

  function openFullscreen() {
    router.push({
      pathname: '/driver/nav/[id]' as any,
      params: { id: order.id },
    });
  }

  return (
    <View style={[styles.box, featured && styles.boxFeatured, fullscreen && styles.boxFull]}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {fullscreen
            ? routeLabel
            : phase === 'to_shop'
              ? 'Rota · indo à loja'
              : 'Rota · indo ao cliente'}
        </Text>
        {routing ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <Text style={styles.meta}>
            {formatDistanceKm(distanceKm)} · ~{minutes} min
          </Text>
        )}
      </View>

      <View style={styles.pad}>
        <InAppGoogleMap
          center={origin}
          label={driverPos ? 'Você' : 'Loja'}
          cityLabel={phase === 'to_shop' ? order.businessName : order.address}
          destination={destination}
          destinationLabel={phase === 'to_shop' ? 'Loja' : 'Cliente'}
          height={compact ? 200 : fullscreen ? 420 : 240}
        />
      </View>

      {!fullscreen ? (
        <TouchableOpacity style={styles.btn} onPress={openFullscreen}>
          <Ionicons name="map" size={16} color={theme.colors.primary} />
          <Text style={styles.btnTextAlt}>Abrir em tela cheia</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  boxFeatured: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    marginBottom: 0,
  },
  boxFull: {
    flex: 1,
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  title: { fontWeight: '800', color: theme.colors.text, flex: 1 },
  meta: { color: theme.colors.primary, fontWeight: '700' },
  pad: { paddingHorizontal: 10 },
  btn: {
    margin: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnTextAlt: { color: theme.colors.primary, fontWeight: '800' },
});
