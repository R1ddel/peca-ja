import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveDriverApplication } from '@/utils/partners';
import {
  driverFleetId,
  getDriverOnline,
  driverEarningsOf,
  listDriverActive,
  driverPublicProfile,
} from '@/utils/driverOps';
import {
  DRIVER_OFFER_SECONDS,
  getOfferForDriver,
  offerSecondsLeft,
  queueWaitingCount,
} from '@/utils/driverDispatch';
import { formatPrice } from '@/data/businesses';
import { formatWaitLabel } from '@/utils/datetime';
import { theme } from '@/constants/theme';
import { alertExclusiveOffer } from '@/utils/driverOfferAlert';
import {
  DRIVER_OFFER_POPUP_DECLINE_LIMIT,
  isDriverOfferPopupMuted,
  recordDriverOfferDecline,
  resetDriverOfferDeclines,
} from '@/utils/driverOfferMute';

const ACCENT = '#F59E0B';

export default function DriverJobsScreen() {
  const { user } = useAuth();
  const {
    orders,
    assignDriverToOrder,
    declineDriverOffer,
    runFairDispatch,
    seedFairDispatchDemo,
    fleetOnline,
  } = useOrders();
  const [fleetId, setFleetId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverPhotoUrl, setDriverPhotoUrl] = useState<string | undefined>();
  const [driverBio, setDriverBio] = useState<string | undefined>();
  const [driverVehicle, setDriverVehicle] = useState<string | undefined>();
  const [homePopupMuted, setHomePopupMuted] = useState(false);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [ready, setReady] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const offer = useMemo(
    () => (fleetId ? getOfferForDriver(orders, fleetId, nowMs) : null),
    [orders, fleetId, nowMs]
  );
  const secondsLeft = offer ? offerSecondsLeft(offer, nowMs) : 0;
  const waiting = queueWaitingCount(orders, nowMs);
  const activeJobs = useMemo(
    () => (fleetId ? listDriverActive(orders, fleetId) : []),
    [orders, fleetId]
  );
  const hasActive = activeJobs.length > 0;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const app = await resolveDriverApplication(user?.email);
        if (!alive) return;
        if (!app || app.status !== 'approved') {
          setReady(true);
          return;
        }
        const id = driverFleetId(app);
        setFleetId(id);
        setDriverName(app.name);
        setDriverPhone(app.phone);
        const pub = driverPublicProfile(app);
        setDriverPhotoUrl(pub.photoUrl);
        setDriverBio(pub.bio);
        setDriverVehicle(pub.vehicle);
        setOnline(await getDriverOnline(id));
        setHomePopupMuted(await isDriverOfferPopupMuted(id));
        setReady(true);
        await runFairDispatch();
      })();
      return () => {
        alive = false;
      };
    }, [user?.email, runFairDispatch])
  );

  // Countdown + redispatch when offer expires
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!offer || !offer.offerExpiresAt || hasActive || !online) return;
    void alertExclusiveOffer({
      orderId: offer.id,
      businessName: offer.businessName,
      address: offer.address,
      freteLabel: formatPrice(driverEarningsOf(offer)),
      offerExpiresAt: offer.offerExpiresAt,
    });
  }, [offer?.id, offer?.offerExpiresAt, hasActive, online]);

  useFocusEffect(
    useCallback(() => {
      const poll = setInterval(() => {
        void runFairDispatch();
      }, 4000);
      return () => clearInterval(poll);
    }, [runFairDispatch])
  );
  function acceptOffer() {
    if (!fleetId || !offer) return;
    if (!online) {
      Alert.alert('Offline', 'Ligue o online no painel para aceitar corridas.');
      return;
    }
    if (hasActive) {
      Alert.alert(
        'Corrida ativa',
        'Finalize a entrega atual antes de aceitar outra.'
      );
      return;
    }
    Alert.alert(
      'Aceitar oferta',
      `${offer.businessName}\nFrete ${formatPrice(driverEarningsOf(offer))}\n${offer.address}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceitar',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const res = await assignDriverToOrder(offer.id, {
                id: fleetId,
                name: driverName,
                phone: driverPhone,
                photoUrl: driverPhotoUrl,
                bio: driverBio,
                vehicle: driverVehicle,
              });
              setBusy(false);
              if (!res.ok) {
                Alert.alert('Oferta', res.error);
                void runFairDispatch();
                return;
              }
              await resetDriverOfferDeclines(fleetId);
              setHomePopupMuted(false);
              router.push({
                pathname: '/driver/order/[id]' as any,
                params: { id: offer.id },
              });
            })();
          },
        },
      ]
    );
  }

  function declineOffer() {
    if (!fleetId || !offer) return;
    Alert.alert('Recusar oferta', 'Este pedido vai para outro motoboy.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Recusar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const res = await declineDriverOffer(offer.id, fleetId);
            if (res.ok) {
              const { muted } = await recordDriverOfferDecline(fleetId);
              setHomePopupMuted(muted);
            } else {
              Alert.alert('Oferta', res.error);
            }
            setBusy(false);
          })();
        },
      },
    ]);
  }

  async function seedThree() {
    setSeeding(true);
    try {
      const n = await seedFairDispatchDemo();
      Alert.alert(
        'Pedidos de teste',
        `${n} pedidos prontos na cozinha foram adicionados.\n\nSe você estiver online, a oferta exclusiva aparece aqui (45s). Os outros ficam na fila.`
      );
    } finally {
      setSeeding(false);
    }
  }

  if (!ready) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Ofertas de corrida" fallbackHref="/driver" />
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.hero}>
          <Ionicons name="sparkles" size={22} color="#fff" />
          <Text style={styles.heroText}>
            Fila justa: 1 oferta por vez · {DRIVER_OFFER_SECONDS}s · prioridade
            pra quem fez menos entregas hoje
            {fleetOnline ? ' · frota compartilhada OK' : ' · modo local (sem frota)'}
          </Text>
        </View>

        {homePopupMuted ? (
          <View style={styles.muteNote}>
            <Ionicons name="information-circle" size={18} color="#92400E" />
            <Text style={styles.muteNoteText}>
              Depois de {DRIVER_OFFER_POPUP_DECLINE_LIMIT} recusas, as ofertas não abrem mais na
              tela inicial — ficam só aqui. Aceitar uma corrida volta o aviso na home.
            </Text>
          </View>
        ) : null}

        {!online ? (
          <View style={styles.warn}>
            <Ionicons name="cloud-offline-outline" size={18} color="#92400E" />
            <Text style={styles.warnText}>
              Você está offline. Ligue o online no painel para receber ofertas.
            </Text>
          </View>
        ) : null}

        {hasActive ? (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() =>
              router.push({
                pathname: '/driver/order/[id]' as any,
                params: { id: activeJobs[0].id },
              })
            }
          >
            <Ionicons name="bicycle" size={20} color="#1D4ED8" />
            <Text style={styles.activeText}>
              Você já tem 1 corrida ativa. Finalize antes de receber nova oferta.
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#1D4ED8" />
          </TouchableOpacity>
        ) : null}

        {offer && !hasActive ? (
          <View style={styles.offerCard}>
            <View style={styles.offerTop}>
              <Text style={styles.offerBadge}>OFERTA EXCLUSIVA</Text>
              <Text style={styles.timer}>{secondsLeft}s</Text>
            </View>
            <Text style={styles.title}>{offer.businessName}</Text>
            <Text style={styles.meta}>
              Pronto na cozinha · {formatWaitLabel(offer.kitchenReadyAt || offer.createdAt)} ·{' '}
              {offer.items.length} item(ns)
            </Text>
            <Text style={styles.addr}>{offer.address}</Text>
            <Text style={styles.pay}>
              Frete {formatPrice(driverEarningsOf(offer))}
            </Text>
            <View style={styles.actions}>
              <Button
                title="Aceitar"
                onPress={acceptOffer}
                loading={busy}
                size="md"
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={declineOffer}
                disabled={busy}
              >
                <Text style={styles.declineText}>Recusar</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/driver/order/[id]' as any,
                  params: { id: offer.id },
                })
              }
            >
              <Text style={styles.detailLink}>Ver detalhes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {hasActive ? 'Sem oferta enquanto há corrida ativa' : 'Aguardando oferta'}
            </Text>
            <Text style={styles.emptyText}>
              {waiting > 0
                ? `${waiting} pedido(s) na fila — o sistema oferece em ordem justa.`
                : 'Quando a loja marcar pronto, a oferta chega só pra você (ou pro próximo da fila).'}
            </Text>
          </View>
        )}

        {waiting > 0 && offer ? (
          <Text style={styles.queueHint}>
            + {waiting} pedido(s) aguardando na fila (ainda não oferecidos a
            ninguém ou expirados)
          </Text>
        ) : null}

        {__DEV__ ? (
          <TouchableOpacity
            style={styles.seedBtn}
            onPress={() => void seedThree()}
            disabled={seeding}
          >
            {seeding ? (
              <ActivityIndicator color={ACCENT} />
            ) : (
              <>
                <Ionicons name="flask-outline" size={18} color={ACCENT} />
                <Text style={styles.seedText}>
                  Teste: jogar 3 pedidos prontos na fila
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  hero: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#B45309',
    borderRadius: 14,
    padding: 14,
  },
  heroText: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 13, lineHeight: 18 },
  muteNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  muteNoteText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  warn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
  },
  warnText: { flex: 1, color: '#92400E', fontSize: 13, lineHeight: 18 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 12,
  },
  activeText: { flex: 1, color: '#1E3A8A', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  offerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: ACCENT,
    gap: 8,
  },
  offerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.6,
  },
  timer: {
    fontSize: 22,
    fontWeight: '900',
    color: ACCENT,
    fontVariant: ['tabular-nums'],
  },
  title: { fontWeight: '800', color: theme.colors.text, fontSize: 18 },
  meta: { color: theme.colors.textMuted, fontSize: 12 },
  addr: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  pay: { fontWeight: '800', color: '#059669', fontSize: 18, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  declineBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  declineText: { color: theme.colors.textSecondary, fontWeight: '700', fontSize: 13 },
  detailLink: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  empty: { alignItems: 'center', paddingTop: 28, gap: 8, paddingHorizontal: 8 },
  emptyTitle: { fontWeight: '800', fontSize: 17, color: theme.colors.text },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  queueHint: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  seedBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: 'dashed',
  },
  seedText: { color: ACCENT, fontWeight: '700', fontSize: 13 },
});
