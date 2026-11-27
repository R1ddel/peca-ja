import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Order } from '@/types';
import { theme } from '@/constants/theme';
import {
  isValidLatLng,
  regionFitting,
  resolveBusinessCoords,
  resolveDeliveryCoords,
  type LatLng,
} from '@/utils/orderGeo';
import { useDeliveryTarget } from '@/hooks/useDeliveryTarget';
import { deliveryTargetLabel, deliveryTargetShort } from '@/utils/deliveryTarget';
import {
  buildDeliveryLeg,
  formatDistanceKm,
  resolveBestRouteLeg,
  routeKey,
  type RouteLeg,
} from '@/utils/driverRoute';

type Props = {
  order: Order;
  /** Se true, acompanha GPS ao vivo do motoboy. */
  trackDriver?: boolean;
  /** Versão menor pro painel principal. */
  compact?: boolean;
  /** Destaque no painel: mapa maior + borda forte. */
  featured?: boolean;
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

/**
 * Mapa da corrida: melhor rota por ruas (OSRM) + GPS do motoboy.
 */
export function DriverRouteMap({
  order,
  trackDriver = true,
  compact = false,
  featured = false,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [leg, setLeg] = useState<RouteLeg | null>(null);
  const [routing, setRouting] = useState(false);

  const shop = useMemo(() => orderShop(order), [order]);
  const customerTarget = useDeliveryTarget(order);
  const customer = customerTarget.point ?? resolveDeliveryCoords(order.address || '');

  const phase: 'to_shop' | 'to_customer' = order.pickupVerifiedAt
    ? 'to_customer'
    : order.status === 'saiu_entrega'
      ? 'to_customer'
      : 'to_shop';

  const destination = phase === 'to_shop' ? shop : customer;

  const origin: LatLng = driverPos ?? shop;
  const target: LatLng = driverPos ? destination : customer;
  const routeLabel = !driverPos
    ? 'Loja → Cliente'
    : phase === 'to_shop'
      ? 'Você → Loja'
      : 'Você → Cliente';

  const region = useMemo(
    () =>
      regionFitting(
        [shop, customer, ...(driverPos ? [driverPos] : [])],
        1.45
      ),
    [shop, customer, driverPos]
  );

  const displayLeg =
    leg ?? buildDeliveryLeg(origin, target, routeLabel);

  // Melhor rota por ruas (com debounce / key estável)
  useEffect(() => {
    let cancelled = false;
    const key = routeKey(origin, target);
    const timer = setTimeout(() => {
      void (async () => {
        if (!cancelled) setRouting(true);
        const next = await resolveBestRouteLeg(origin, target, routeLabel);
        if (cancelled) return;
        setLeg(next);
        setRouting(false);
        if (next.coordinates.length > 1) {
          mapRef.current?.fitToCoordinates(next.coordinates, {
            edgePadding: { top: 40, right: 28, bottom: 40, left: 28 },
            animated: true,
          });
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // key cobre origem/destino arredondados
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, phase, routeKey(origin, target), routeLabel]);

  useEffect(() => {
    if (!gpsReady || leg) return;
    mapRef.current?.fitToCoordinates(
      [shop, customer, ...(driverPos ? [driverPos] : [])],
      {
        edgePadding: { top: 48, right: 36, bottom: 48, left: 36 },
        animated: true,
      }
    );
  }, [gpsReady, order.id, shop, customer, driverPos, leg]);

  useEffect(() => {
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;

    void (async () => {
      if (!trackDriver) {
        if (!cancelled) setGpsReady(true);
        return;
      }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setGpsDenied(true);
          setGpsReady(true);
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setDriverPos({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        setGpsReady(true);

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 40,
            timeInterval: 5000,
          },
          (pos) => {
            if (cancelled) return;
            setDriverPos({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          }
        );
      } catch {
        if (!cancelled) {
          setGpsDenied(true);
          setGpsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [trackDriver]);

  async function openNav() {
    router.push({
      pathname: '/driver/nav/[id]' as any,
      params: { id: order.id },
    });
  }

  function openFullscreen() {
    router.push({
      pathname: '/driver/nav/[id]' as any,
      params: { id: order.id },
    });
  }

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        featured && styles.wrapFeatured,
      ]}
    >
      <View style={styles.header}>
        <Ionicons
          name="navigate-circle"
          size={featured ? 22 : 18}
          color="#7C3AED"
        />
        <Text style={[styles.headerTitle, featured && styles.headerTitleFeatured]}>
          {featured
            ? phase === 'to_shop'
              ? 'Rota atual · indo à loja'
              : 'Rota atual · indo ao cliente'
            : compact
              ? 'GPS · corrida ativa'
              : 'Rota da entrega'}
        </Text>
        <Text
          style={[
            styles.badge,
            displayLeg.source === 'osrm' && styles.badgeBest,
          ]}
        >
          {routing
            ? 'Calculando…'
            : displayLeg.source === 'osrm'
              ? 'Melhor rota'
              : displayLeg.label}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.mapBox,
          compact && !featured && styles.mapBoxCompact,
          featured && styles.mapBoxFeatured,
        ]}
        activeOpacity={0.92}
        onPress={openFullscreen}
      >
        {!gpsReady ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#7C3AED" />
            <Text style={styles.loadingText}>Preparando mapa…</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            showsUserLocation={!!driverPos && Platform.OS !== 'web'}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            pitchEnabled={false}
            scrollEnabled={false}
            zoomEnabled={false}
            pointerEvents="none"
          >
            <Polyline
              coordinates={displayLeg.coordinates}
              strokeColor="#7C3AED"
              strokeWidth={featured ? 6 : compact ? 4 : 5}
              lineCap="round"
              lineJoin="round"
            />
            <Marker
              coordinate={shop}
              title={order.businessName}
              description="Retirada"
              pinColor="#D97706"
            />
            <Marker
              coordinate={customer}
              title="Pedido"
              description={
                customerTarget.source
                  ? deliveryTargetLabel(customerTarget.source)
                  : order.address
              }
              pinColor="#059669"
            />
            {driverPos ? (
              <Marker
                coordinate={driverPos}
                title="Você"
                description="Sua posição"
                pinColor="#7C3AED"
              />
            ) : null}
          </MapView>
        )}
        <View style={styles.mapOverlay}>
          <Ionicons name="expand" size={16} color="#fff" />
          <Text style={styles.mapOverlayText}>
            {featured ? 'Toque · navegação tela cheia' : 'Toque para tela cheia · estilo Waze'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>
            {formatDistanceKm(displayLeg.distanceKm)}
          </Text>
          <Text style={styles.statLbl}>distância</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>~{displayLeg.minutes} min</Text>
          <Text style={styles.statLbl}>estimativa</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>
            {phase === 'to_shop' ? 'Loja' : 'Cliente'}
          </Text>
          <Text style={styles.statLbl}>
            {phase === 'to_customer' && customerTarget.source
              ? deliveryTargetShort(customerTarget.source)
              : 'destino'}
          </Text>
        </View>
      </View>

      {!featured ? (
        !compact ? (
          <>
            {gpsDenied ? (
              <Text style={styles.hint}>
                GPS sem permissão — mostrando rota loja → cliente. Ative a
                localização para traçar a partir de você.
              </Text>
            ) : (
              <Text style={styles.hint} numberOfLines={2}>
                {displayLeg.source === 'osrm'
                  ? 'Rota otimizada pelas ruas até o destino do pedido.'
                  : order.address}
              </Text>
            )}

            <TouchableOpacity
              style={styles.navBtn}
              onPress={openFullscreen}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.navBtnText}>
                Navegação tela cheia
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={openFullscreen}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.navBtnText}>
              Abrir navegação · Waze
            </Text>
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  wrapCompact: {
    marginBottom: 12,
  },
  wrapFeatured: {
    borderWidth: 2,
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
    padding: 14,
    marginBottom: 0,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontWeight: '800',
    fontSize: 15,
    color: theme.colors.text,
  },
  headerTitleFeatured: {
    fontSize: 16,
    color: '#4C1D95',
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgeBest: {
    color: '#065F46',
    backgroundColor: '#D1FAE5',
  },
  mapBox: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EDE9FE',
    position: 'relative',
  },
  mapBoxCompact: {
    height: 200,
  },
  mapBoxFeatured: {
    height: 260,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C4B5FD',
  },
  map: { width: '100%', height: '100%' },
  mapOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30, 27, 75, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: { color: theme.colors.textMuted, fontSize: 13 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingVertical: 10,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontWeight: '800', fontSize: 15, color: '#4C1D95' },
  statLbl: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  divider: { width: 1, height: 28, backgroundColor: '#DDD6FE' },
  hint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 12,
  },
  navBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
