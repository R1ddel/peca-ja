import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveDriverApplication } from '@/utils/partners';
import { getBusinessById } from '@/data/businesses';
import { formatPrice } from '@/data/businesses';
import { openMapsAddress } from '@/utils/openMaps';
import { DriverRouteMap } from '@/components/DriverRouteMap';
import {
  driverFleetId,
  isAssignedToDriver,
  isJobAvailable,
  isKitchenReadyForPickup,
  driverEarningsOf,
  statusLabelPt,
  driverPublicProfile,
} from '@/utils/driverOps';
import { usePublishDriverLocation } from '@/hooks/usePublishDriverLocation';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { OrderPersonCard } from '@/components/OrderPersonCard';
import { theme } from '@/constants/theme';

const ACCENT = '#7C3AED';

function paramStr(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

export default function DriverOrderDetailScreen() {
  const { user } = useAuth();
  const id = paramStr(useLocalSearchParams<{ id?: string }>().id);
  const { getOrder, assignDriverToOrder, releaseDriverFromOrder } = useOrders();
  const order = getOrder(id);

  const [fleetId, setFleetId] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverPhotoUrl, setDriverPhotoUrl] = useState<string | undefined>();
  const [driverBio, setDriverBio] = useState<string | undefined>();
  const [driverVehicle, setDriverVehicle] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const app = await resolveDriverApplication(user?.email);
        if (app?.status === 'approved') {
          setFleetId(driverFleetId(app));
          setApplicationId(app.id);
          setDriverName(app.name);
          setDriverPhone(app.phone);
          const pub = driverPublicProfile(app);
          setDriverPhotoUrl(pub.photoUrl);
          setDriverBio(pub.bio);
          setDriverVehicle(pub.vehicle);
        }
        setReady(true);
      })();
    }, [user?.email])
  );

  const mine = useMemo(
    () => (order && fleetId ? isAssignedToDriver(order, fleetId) : false),
    [order, fleetId]
  );

  usePublishDriverLocation(
    fleetId && applicationId
      ? {
          fleetId,
          applicationId,
          name: driverName,
          phone: driverPhone,
        }
      : null,
    mine && !!order && order.status !== 'entregue' && order.status !== 'cancelado'
  );
  const available = order ? isJobAvailable(order) : false;
  const business = order ? getBusinessById(order.businessId) : null;
  const shopAddress =
    (business as { address?: string } | null)?.address ||
    order?.businessName ||
    '';

  if (!ready) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </MobileShell>
    );
  }

  if (!order) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Corrida" fallbackHref="/driver" />
        <Text style={styles.missing}>Pedido não encontrado.</Text>
      </MobileShell>
    );
  }

  function accept() {
    if (!fleetId) return;
    void (async () => {
      setBusy(true);
      const res = await assignDriverToOrder(order!.id, {
        id: fleetId,
        name: driverName,
        phone: driverPhone,
        photoUrl: driverPhotoUrl,
        bio: driverBio,
        vehicle: driverVehicle,
      });
      setBusy(false);
      if (!res.ok) Alert.alert('Corrida', res.error);
    })();
  }

  function release() {
    if (!fleetId || busy) return;
    Alert.alert('Desistir', 'Liberar esta corrida para outro entregador?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desistir',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const res = await releaseDriverFromOrder(order!.id, fleetId);
              if (!res.ok) Alert.alert('Corrida', res.error);
              else router.replace('/driver/jobs' as any);
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title={`#${order.id.slice(-6).toUpperCase()}`} fallbackHref="/driver/active" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroBiz}>{order.businessName}</Text>
          <Text style={styles.heroStatus}>{statusLabelPt(order.status)}</Text>
          <Text style={styles.heroPay}>{formatPrice(driverEarningsOf(order))} frete</Text>
        </View>

        <DriverRouteMap order={order} trackDriver={mine} />

                {mine && order.pickupCode && !order.pickupVerifiedAt ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLbl}>Mostre na loja</Text>
            <Text style={styles.codeShop}>
              Pedido da loja {merchantOrderLabel(order)}
            </Text>
            <Text style={styles.codeVal}>{order.pickupCode}</Text>
            <Text style={styles.codeHint}>
              Diga o número do pedido e mostre este código. A loja digita no painel dela para
              liberar.
            </Text>
          </View>
        ) : null}

        {mine && order.status === 'saiu_entrega' ? (
          <TouchableOpacity
            style={styles.deliverCta}
            onPress={() =>
              router.push({
                pathname: '/driver/deliver' as any,
                params: { orderId: order.id },
              })
            }
          >
            <Ionicons name="keypad" size={22} color="#fff" />
            <Text style={styles.deliverCtaText}>Digitar código do cliente</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.section}>Buscar na loja</Text>
        <TouchableOpacity
          style={styles.navCard}
          onPress={() => void openMapsAddress(shopAddress, order.businessName)}
        >
          <Ionicons name="storefront" size={22} color={ACCENT} />
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>{order.businessName}</Text>
            <Text style={styles.navSub}>{shopAddress || 'Abrir no mapa'}</Text>
          </View>
          <Ionicons name="navigate" size={20} color={theme.colors.primary} />
        </TouchableOpacity>

        <Text style={styles.section}>Entregar ao cliente</Text>
        <OrderPersonCard
          role="customer"
          name={order.customerName || 'Cliente'}
          subtitle={order.address}
          bio={order.customerBio}
          photoUrl={order.customerPhotoUrl}
          phone={order.customerPhone}
        />
        <TouchableOpacity
          style={styles.navCard}
          onPress={() => void openMapsAddress(order.address, order.customerName || 'Cliente')}
        >
          <Ionicons name="home" size={22} color="#059669" />
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>Endereço do cliente</Text>
            <Text style={styles.navSub}>{order.address}</Text>
          </View>
          <Ionicons name="navigate" size={20} color={theme.colors.primary} />
        </TouchableOpacity>

        {isKitchenReadyForPickup(order) ? (
          <View style={styles.readyBox}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.readyText}>Pedido pronto na cozinha</Text>
          </View>
        ) : order.status === 'preparando' ? (
          <Text style={styles.wait}>Aguardando a loja marcar como pronto…</Text>
        ) : null}

        <Text style={styles.section}>Itens ({order.items.length})</Text>
        {order.items.map((it, idx) => (
          <View key={it.lineId || `${it.item.id}-${idx}`} style={styles.itemRow}>
            <Text style={styles.itemQty}>{it.quantity}×</Text>
            <Text style={styles.itemName}>{it.item.name}</Text>
          </View>
        ))}

        <View style={styles.actions}>
          {available && !mine && fleetId ? (
            <Button title="Aceitar corrida" onPress={accept} loading={busy} size="lg" />
          ) : null}
          {mine ? (
            <>
              <Button
                title="Abrir chat"
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: '/driver/chat/[orderId]' as any,
                    params: { orderId: order.id },
                  })
                }
                size="lg"
              />
              {!order.pickupVerifiedAt && order.status !== 'saiu_entrega' ? (
                <Button
                  title={busy ? 'Liberando…' : 'Desistir da corrida'}
                  variant="ghost"
                  onPress={release}
                  disabled={busy}
                  style={{ marginTop: 8 }}
                />
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  missing: { textAlign: 'center', marginTop: 40, color: theme.colors.textMuted },
  hero: {
    backgroundColor: '#4C1D95',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  heroBiz: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroStatus: { color: 'rgba(255,255,255,0.8)', marginTop: 4, fontSize: 13 },
  heroPay: { color: '#FDE68A', fontWeight: '800', fontSize: 18, marginTop: 10 },
  codeCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  codeLbl: { color: '#4338CA', fontWeight: '600', fontSize: 13 },
  codeShop: {
    color: '#312E81',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 4,
  },
  codeVal: {
    fontSize: 40,
    letterSpacing: 10,
    fontWeight: '800',
    color: '#312E81',
    marginVertical: 8,
  },
  codeHint: { color: '#6366F1', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  deliverCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  deliverCtaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  section: {
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  navTitle: { fontWeight: '700', color: theme.colors.text },
  navSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  readyBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    padding: 10,
    borderRadius: 10,
    marginVertical: 8,
  },
  readyText: { color: '#065F46', fontWeight: '600' },
  wait: { color: theme.colors.textMuted, fontSize: 13, marginVertical: 6 },
  itemRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  itemQty: { fontWeight: '700', color: theme.colors.textMuted, width: 28 },
  itemName: { flex: 1, color: theme.colors.text },
  actions: { marginTop: 20, gap: 8 },
});
