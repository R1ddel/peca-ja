/**
 * Mapa ao vivo do entregador — cliente e comércio.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { Order } from '@/types';
import { theme } from '@/constants/theme';
import {
  isValidLatLng,
  regionFitting,
  resolveBusinessCoords,
  resolveDeliveryCoords,
  type LatLng,
} from '@/utils/orderGeo';
import { fleetDriverLocationRemote } from '@/services/fleetClient';
import { buildDeliveryLeg, resolveBestRouteLeg } from '@/utils/driverRoute';

type Props = {
  order: Order;
  /** Quem está olhando — muda textos. */
  viewer?: 'customer' | 'merchant';
  /** Altura do mapa. */
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

export function CustomerLiveMap({ order, viewer = 'customer', height = 220 }: Props) {
  const mapRef = useRef<MapView>(null);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);

  const shop = useMemo(() => shopOf(order), [order]);
  const customer = useMemo(() => customerOf(order), [order]);
  const toCustomer = !!order.pickupVerifiedAt || order.status === 'saiu_entrega';

  useEffect(() => {
    if (!order.driverId) return;
    let alive = true;
    const poll = async () => {
      const res = await fleetDriverLocationRemote(order.driverId!);
      if (!alive) return;
      if (
        res?.ok &&
        res.location &&
        isValidLatLng(res.location.latitude, res.location.longitude)
      ) {
        setDriverPos({
          latitude: res.location.latitude,
          longitude: res.location.longitude,
        });
        setUpdatedAt(res.location.at);
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [order.driverId]);

  useEffect(() => {
    let cancelled = false;
    const dest = toCustomer ? customer : shop;
    const origin = driverPos || shop;
    void (async () => {
      try {
        const leg = await resolveBestRouteLeg(
          origin,
          dest,
          toCustomer
            ? viewer === 'merchant'
              ? 'Entregador → Cliente'
              : 'Entregador → Você'
            : 'Entregador → Loja'
        );
        if (!cancelled && leg?.coordinates?.length) {
          setRouteCoords(leg.coordinates);
          return;
        }
      } catch {
        /* fallback */
      }
      if (!cancelled) {
        const fallback = buildDeliveryLeg(
          origin,
          dest,
          toCustomer
            ? viewer === 'merchant'
              ? 'Entregador → Cliente'
              : 'Entregador → Você'
            : 'Entregador → Loja'
        );
        setRouteCoords(fallback.coordinates);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverPos?.latitude, driverPos?.longitude, toCustomer, shop, customer, viewer]);

  useEffect(() => {
    if (!mapRef.current) return;
    const points = [shop, customer];
    if (driverPos) points.push(driverPos);
    try {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 48, right: 36, bottom: 48, left: 36 },
        animated: true,
      });
    } catch {
      const r = regionFitting(points);
      mapRef.current.animateToRegion(r, 400);
    }
  }, [shop, customer, driverPos]);

  const title =
    viewer === 'merchant'
      ? toCustomer
        ? 'Motoboy a caminho do cliente'
        : 'Motoboy a caminho da loja'
      : toCustomer
        ? 'Entregador a caminho'
        : 'Entregador indo à loja';

  const customerLabel = viewer === 'merchant' ? 'Cliente' : 'Você';

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webFallback}>
        <Ionicons name="map-outline" size={22} color={theme.colors.primary} />
        <Text style={styles.webText}>
          Acompanhe a rota do entregador no app no celular.
          {order.driverName ? ` · ${order.driverName}` : ''}
        </Text>
      </View>
    );
  }

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
      <MapView
        ref={mapRef}
        style={[styles.map, { height }]}
        initialRegion={regionFitting([shop, customer])}
        showsUserLocation={false}
        showsTraffic
      >
        {routeCoords.length > 1 ? (
          <Polyline
            coordinates={routeCoords}
            strokeColor={theme.colors.primary}
            strokeWidth={4}
          />
        ) : null}
        <Marker coordinate={shop} title={order.businessName} pinColor="#F59E0B" />
        <Marker coordinate={customer} title={customerLabel} pinColor="#0EA5E9" />
        {driverPos ? (
          <Marker coordinate={driverPos} title={order.driverName || 'Entregador'}>
            <View style={styles.bikePin}>
              <Ionicons name="bicycle" size={18} color="#fff" />
            </View>
          </Marker>
        ) : null}
      </MapView>
      {!driverPos ? (
        <Text style={styles.hint}>
          Aguardando localização do entregador… Peça para ele ficar online com GPS liberado.
        </Text>
      ) : (
        <Text style={styles.hint}>
          {toCustomer
            ? `${order.driverName || 'Entregador'} está a caminho ${
                viewer === 'merchant' ? 'do cliente' : 'de você'
              }`
            : `${order.driverName || 'Entregador'} está a caminho da loja`}
        </Text>
      )}
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
  headMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  map: {
    width: '100%',
  },
  bikePin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  hint: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  webFallback: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  webText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
});
