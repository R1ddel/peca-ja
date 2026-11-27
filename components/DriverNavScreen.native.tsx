import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrders } from '@/context/OrdersContext';
import {
  isValidLatLng,
  resolveBusinessCoords,
  type LatLng,
} from '@/utils/orderGeo';
import { useDeliveryTarget } from '@/hooks/useDeliveryTarget';
import { deliveryTargetLabel } from '@/utils/deliveryTarget';
import {
  buildDeliveryLeg,
  formatDistanceKm,
  haversineKm,
  resolveBestRouteLeg,
  routeKey,
  type RouteLeg,
} from '@/utils/driverRoute';
import {
  openGoogleNavigate,
  openGoogleToPlace,
  openWazeNavigate,
  openWazeToPlace,
} from '@/utils/openMaps';

const ACCENT = '#7C3AED';
const ARRIVE_M = 45;

function paramStr(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

function shopOf(order: {
  businessId: string;
  businessName: string;
  businessLatitude?: number;
  businessLongitude?: number;
}): LatLng {
  if (isValidLatLng(order.businessLatitude, order.businessLongitude)) {
    return {
      latitude: order.businessLatitude as number,
      longitude: order.businessLongitude as number,
    };
  }
  return resolveBusinessCoords(order.businessId, order.businessName);
}

/**
 * Navegação tela cheia estilo Waze: GPS ao vivo + melhor rota + pin exato.
 */
export default function DriverNavScreen() {
  const insets = useSafeAreaInsets();
  const id = paramStr(useLocalSearchParams<{ id?: string }>().id);
  const { getOrder } = useOrders();
  const order = getOrder(id);

  const mapRef = useRef<MapView>(null);
  const followRef = useRef(true);
  const headingRef = useRef(0);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState(0);
  const [follow, setFollow] = useState(true);
  const [leg, setLeg] = useState<RouteLeg | null>(null);
  const [routing, setRouting] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [opening, setOpening] = useState<'waze' | 'google' | null>(null);

  followRef.current = follow;
  headingRef.current = heading;

  const shop = useMemo(() => (order ? shopOf(order) : null), [order]);
  const customerTarget = useDeliveryTarget(order ?? null);
  const customer = customerTarget.point;

  const phase: 'to_shop' | 'to_customer' = order?.pickupVerifiedAt
    ? 'to_customer'
    : order?.status === 'saiu_entrega'
      ? 'to_customer'
      : 'to_shop';

  const destination = phase === 'to_shop' ? shop : customer;
  const destTitle =
    phase === 'to_shop' ? order?.businessName ?? 'Loja' : 'Cliente';
  const destSubtitle =
    phase === 'to_shop'
      ? 'Retirada do pedido'
      : order?.address ?? 'Endereço de entrega';

  const remainingKm = useMemo(() => {
    if (!driverPos || !destination) return leg?.distanceKm ?? 0;
    return haversineKm(driverPos, destination);
  }, [driverPos, destination, leg?.distanceKm]);

  const arrived = remainingKm * 1000 <= ARRIVE_M;

  const animateFollow = useCallback((pos: LatLng, hdg: number) => {
    if (!followRef.current || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: pos,
        heading: hdg,
        pitch: 55,
        zoom: 17.5,
        altitude: 450,
      },
      { duration: 600 }
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let sub: Location.LocationSubscription | null = null;

      void (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (cancelled) return;
          if (status !== 'granted') {
            setGpsError('Ative a localização para navegar.');
            setGpsReady(true);
            return;
          }

          await Location.enableNetworkProviderAsync().catch(() => {});

          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          if (cancelled) return;
          const pos = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          };
          const hdg = current.coords.heading ?? 0;
          const safeHdg = hdg >= 0 ? hdg : 0;
          setDriverPos(pos);
          setHeading(safeHdg);
          headingRef.current = safeHdg;
          setGpsReady(true);
          animateFollow(pos, safeHdg);

          sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              distanceInterval: 8,
              timeInterval: 1500,
            },
            (loc) => {
              if (cancelled) return;
              const next = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              };
              const nextHdg =
                typeof loc.coords.heading === 'number' && loc.coords.heading >= 0
                  ? loc.coords.heading
                  : headingRef.current;
              setDriverPos(next);
              setHeading(nextHdg);
              headingRef.current = nextHdg;
              animateFollow(next, nextHdg);
            }
          );
        } catch {
          if (!cancelled) {
            setGpsError('Não foi possível ler o GPS.');
            setGpsReady(true);
          }
        }
      })();

      return () => {
        cancelled = true;
        sub?.remove();
      };
    }, [animateFollow])
  );

  useEffect(() => {
    if (!destination) return;
    const from = driverPos ?? shop;
    if (!from) return;

    let cancelled = false;
    const label = phase === 'to_shop' ? 'Você → Loja' : 'Você → Cliente';
    const timer = setTimeout(() => {
      void (async () => {
        if (!cancelled) setRouting(true);
        const next = await resolveBestRouteLeg(from, destination, label);
        if (cancelled) return;
        setLeg(next);
        setRouting(false);
      })();
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    order?.id,
    phase,
    destination?.latitude,
    destination?.longitude,
    driverPos ? routeKey(driverPos, destination!) : 'no-gps',
  ]);

  function recenter() {
    setFollow(true);
    if (driverPos) animateFollow(driverPos, heading);
  }

  async function goWaze() {
    if (!destination) return;
    setOpening('waze');
    try {
      if (phase === 'to_customer' && !customerTarget.precise) {
        await openWazeToPlace({ address: order?.address, label: destTitle });
        return;
      }
      await openWazeNavigate(destination, destTitle);
    } finally {
      setOpening(null);
    }
  }

  async function goGoogle() {
    if (!destination) return;
    setOpening('google');
    try {
      if (phase === 'to_customer' && !customerTarget.precise) {
        await openGoogleToPlace({ address: order?.address, label: destTitle });
        return;
      }
      await openGoogleNavigate(destination);
    } finally {
      setOpening(null);
    }
  }

  if (!order || !shop || !customer || !destination) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backFab} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.missing}>Pedido não encontrado.</Text>
        </View>
      </View>
    );
  }

  const displayLeg = leg ?? buildDeliveryLeg(driverPos ?? shop, destination, 'Rota');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: destination.latitude,
          longitude: destination.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic
        followsUserLocation={follow && Platform.OS === 'ios'}
        toolbarEnabled={false}
        rotateEnabled
        pitchEnabled
        onPanDrag={() => setFollow(false)}
      >
        <Polyline
          coordinates={displayLeg.coordinates}
          strokeColor="#33B5E5"
          strokeWidth={6}
          lineCap="round"
          lineJoin="round"
        />
        <Marker
          coordinate={shop}
          title={order.businessName}
          description="Retirada"
          pinColor="#F59E0B"
        />
        <Marker
          coordinate={customer}
          title="Pedido"
          description={
            customerTarget.source
              ? deliveryTargetLabel(customerTarget.source)
              : order.address
          }
          pinColor="#10B981"
        />
        {destination ? (
          <Marker
            coordinate={destination}
            title={destTitle}
            description="Chegue aqui"
            pinColor="#EF4444"
          />
        ) : null}
      </MapView>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backFab} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topCard}>
          <Text style={styles.topLabel}>
            {arrived ? 'Você chegou' : phase === 'to_shop' ? 'Indo à loja' : 'Indo ao cliente'}
          </Text>
          <Text style={styles.topTitle} numberOfLines={1}>
            {destTitle}
          </Text>
          {routing ? (
            <Text style={styles.topMeta}>Calculando melhor rota…</Text>
          ) : (
            <Text style={styles.topMeta}>
              {formatDistanceKm(remainingKm)} · ~{displayLeg.minutes} min
              {displayLeg.source === 'osrm' ? ' · melhor caminho' : ''}
            </Text>
          )}
        </View>
      </View>

      {!follow ? (
        <TouchableOpacity
          style={[styles.recenter, { bottom: 210 + insets.bottom }]}
          onPress={recenter}
        >
          <Ionicons name="locate" size={22} color={ACCENT} />
        </TouchableOpacity>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {gpsError ? (
          <Text style={styles.warn}>{gpsError}</Text>
        ) : !gpsReady ? (
          <View style={styles.rowCenter}>
            <ActivityIndicator color="#33B5E5" />
            <Text style={styles.loadingGps}>Ligando GPS de precisão…</Text>
          </View>
        ) : arrived ? (
          <View style={styles.arrivedBox}>
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
            <Text style={styles.arrivedText}>
              Você está no ponto exato · {destTitle}
            </Text>
          </View>
        ) : (
          <Text style={styles.addr} numberOfLines={2}>
            {destSubtitle}
          </Text>
        )}

        <View style={styles.pinRow}>
          <Ionicons name="pin" size={16} color="#EF4444" />
          <Text style={styles.pinText}>
            {phase === 'to_customer' && customerTarget.source
              ? deliveryTargetLabel(customerTarget.source)
              : 'Ponto da loja'}
            {' · '}
            {destination.latitude.toFixed(5)}, {destination.longitude.toFixed(5)}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.wazeBtn}
            onPress={() => void goWaze()}
            disabled={!!opening}
            activeOpacity={0.88}
          >
            {opening === 'waze' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.wazeText}>Abrir no Waze</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gmapsBtn}
            onPress={() => void goGoogle()}
            disabled={!!opening}
            activeOpacity={0.88}
          >
            {opening === 'google' ? (
              <ActivityIndicator color={ACCENT} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={ACCENT} />
                <Text style={styles.gmapsText}>Maps</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missing: { color: '#fff', fontSize: 16 },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
  },
  backFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCard: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topLabel: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  topMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  recenter: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  addr: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  wazeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#33B5E5',
    borderRadius: 14,
    paddingVertical: 14,
  },
  wazeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  gmapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  gmapsText: { color: ACCENT, fontWeight: '800', fontSize: 14 },
  warn: { color: '#FBBF24', fontSize: 13 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingGps: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  arrivedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 12,
    padding: 12,
  },
  arrivedText: { flex: 1, color: '#6EE7B7', fontWeight: '700', fontSize: 14 },
});
