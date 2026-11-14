import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import { DriverOfferPopup } from '@/components/DriverOfferPopup';
import { FleetStatusChip } from '@/components/FleetStatusChip';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import {
  DriverApplication,
  partnerStatusLabel,
  resolveDriverApplication,
  pullDriverStatusFromHq,
  setPartnerStatus,
  driverOnboardingGate,
  isDriverPanelUnlocked,
} from '@/utils/partners';
import {
  driverFleetId,
  getDriverOnline,
  setDriverOnline,
  listAvailableJobs,
  listDriverActive,
  listDriverHistory,
  driverEarningsOf,
  statusLabelPt,
  driverPublicProfile,
} from '@/utils/driverOps';
import {
  driverCanTakeCity,
  getOfferForDriver,
  offerSecondsLeft,
} from '@/utils/driverDispatch';
import { alertExclusiveOffer } from '@/utils/driverOfferAlert';
import {
  DRIVER_OFFER_POPUP_DECLINE_LIMIT,
  isDriverOfferPopupMuted,
  recordDriverOfferDecline,
  resetDriverOfferDeclines,
} from '@/utils/driverOfferMute';
import { formatPrice } from '@/data/businesses';
import {
  driverAvailableBalance,
  syncDriverWalletFromOrders,
} from '@/utils/driverWallet';
import { DriverRouteMap } from '@/components/DriverRouteMap';
import { DriverLeagueCard } from '@/components/DriverLeagueCard';
import { ActiveRunsBlock } from '@/components/ActiveRunsBlock';
import { DriverTermsPanelSection } from '@/components/DriverTermsPanelSection';
import {
  buildLeagueSnapshot,
  type LeagueSnapshot,
} from '@/utils/driverLeague';
import {
  LEAGUE_DEMO_ACCOUNTS,
  buildLeagueDemoOrders,
  LEAGUE_ORDER_PREFIX,
} from '@/utils/seedDriverLeagueDemo';
import { theme } from '@/constants/theme';
import { sendDriverHeartbeat } from '@/services/driverHeartbeat';
import { usePublishDriverLocation } from '@/hooks/usePublishDriverLocation';
import { DriverGpsBanner } from '@/components/DriverGpsBanner';

const ACCENT = '#7C3AED';
const LEAGUE_SEED_FLAG = '@pecaja_league_demo_seeded_v1';

type ActionDef = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  href: string;
  badge?: number;
};

export default function DriverPanelScreen() {
  const { user } = useAuth();
  const {
    orders,
    seedDriverLeagueDemo,
    seedFairDispatchDemo,
    fleetOnline,
    fleetPersistence,
    runFairDispatch,
    assignDriverToOrder,
    declineDriverOffer,
  } = useOrders();
  const [app, setApp] = useState<DriverApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [balance, setBalance] = useState(0);
  const [league, setLeague] = useState<LeagueSnapshot | null>(null);
  const [leagueLoading, setLeagueLoading] = useState(true);
  const [seedingLeague, setSeedingLeague] = useState(false);
  const [seedingRide, setSeedingRide] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [offerBusy, setOfferBusy] = useState(false);
  const [popupDismissedId, setPopupDismissedId] = useState<string | null>(null);
  /** Após 2 recusas no dia, ofertas só na aba Disponíveis. */
  const [offersInTabOnly, setOffersInTabOnly] = useState(false);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const hasLoadedRef = useRef(false);

  const fleetId = app ? driverFleetId(app) : null;

  const jobs = useMemo(
    () => listAvailableJobs(orders).filter((order) => driverCanTakeCity(app?.city, order.city)),
    [orders, app?.city]
  );
  const active = useMemo(
    () => (fleetId ? listDriverActive(orders, fleetId) : []),
    [orders, fleetId]
  );
  const history = useMemo(
    () => (fleetId ? listDriverHistory(orders, fleetId) : []),
    [orders, fleetId]
  );

  const gpsStatus = usePublishDriverLocation(
    app && fleetId
      ? {
          fleetId,
          applicationId: app.id,
          name: app.name,
          phone: app.phone,
          city: app.city,
        }
      : null,
    !!app && !!fleetId && online
  );
  const offer = useMemo(
    () => (fleetId && app ? getOfferForDriver(orders, fleetId, nowMs, app.city ?? '') : null),
    [orders, fleetId, nowMs, app]
  );
  const secondsLeft = offer ? offerSecondsLeft(offer, nowMs) : 0;
  const showOfferPopup =
    !!offer &&
    online &&
    active.length === 0 &&
    !offersInTabOnly &&
    popupDismissedId !== offer.id;
  const disponiveisBadge =
    jobs.length + (offersInTabOnly && offer && active.length === 0 ? 1 : 0);
  const todayEarned = useMemo(() => {
    if (!fleetId) return 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return history
      .filter((o) => o.status === 'entregue' && +new Date(o.deliveryVerifiedAt || o.updatedAt) >= +start)
      .reduce((s, o) => s + driverEarningsOf(o), 0);
  }, [history, fleetId]);

  const refresh = useCallback(async () => {
    // Não piscar a tela inteira em refreshs seguintes (sync da frota mudava
    // `orders` → recriava este callback → useFocusEffect rodava de novo).
    if (!hasLoadedRef.current) setLoading(true);
    try {
      // Wipe forçado só no login — aqui só abre o painel com a sessão atual.
      const found = await resolveDriverApplication(user?.email);
      setApp(found);

      if (found && isDriverPanelUnlocked(found)) {
        const id = driverFleetId(found);
        setOnline(await getDriverOnline(id));
        const snapshot = ordersRef.current;
        const w = await syncDriverWalletFromOrders(id, found.id, snapshot);
        setBalance(driverAvailableBalance(w));

        if (!hasLoadedRef.current) setLeagueLoading(true);
        let ordersForLeague = snapshot;
        if (__DEV__) {
          try {
            const seeded = await AsyncStorage.getItem(LEAGUE_SEED_FLAG);
            if (!seeded) {
              await seedDriverLeagueDemo();
              await AsyncStorage.setItem(LEAGUE_SEED_FLAG, '1');
              const leagueOrders = buildLeagueDemoOrders();
              ordersForLeague = [
                ...leagueOrders,
                ...snapshot.filter((o) => !o.id.startsWith(LEAGUE_ORDER_PREFIX)),
              ];
            }
          } catch {
            /* ignore */
          }
        }

        const snap = await buildLeagueSnapshot(ordersForLeague, id);
        setLeague(snap);
        setLeagueLoading(false);
      }
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [user?.email, seedDriverLeagueDemo]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useFocusEffect(
    useCallback(() => {
      if (!fleetId) {
        setOffersInTabOnly(false);
        return;
      }
      let cancelled = false;
      void isDriverOfferPopupMuted(fleetId).then((muted) => {
        if (!cancelled) setOffersInTabOnly(muted);
      });
      return () => {
        cancelled = true;
      };
    }, [fleetId])
  );

  async function ensureLeagueSample() {
    setSeedingLeague(true);
    try {
      const res = await seedDriverLeagueDemo();
      await AsyncStorage.setItem(LEAGUE_SEED_FLAG, '1');
      const leagueOrders = buildLeagueDemoOrders();
      const merged = [
        ...leagueOrders,
        ...orders.filter((o) => !o.id.startsWith(LEAGUE_ORDER_PREFIX)),
      ];
      if (fleetId) {
        const snap = await buildLeagueSnapshot(merged, fleetId);
        setLeague(snap);
      }
      Alert.alert(
        'Amostra da Liga pronta',
        `${res.drivers} motoboys + ${res.orders} entregas na semana.\n\nSenha de todos: liga123\n\n` +
          LEAGUE_DEMO_ACCOUNTS.map(
            (a) => `• ${a.name.split(/\s+/)[0]} — ${a.email}`
          ).join('\n')
      );
    } finally {
      setSeedingLeague(false);
    }
  }

  async function sendTestRide() {
    if (!online) {
      Alert.alert('Online', 'Ligue o switch ON para receber a oferta na tela.');
      return;
    }
    if (active.length > 0) {
      Alert.alert(
        'Corrida ativa',
        'Finalize a entrega atual antes de pedir uma oferta de teste.'
      );
      return;
    }
    setSeedingRide(true);
    try {
      setPopupDismissedId(null);
      const n = await seedFairDispatchDemo();
      await runFairDispatch();
      Alert.alert(
        'Corrida na fila',
        `${n} pedido(s) prontos. Em instantes o pop-up aparece nesta tela (fique online).`
      );
    } finally {
      setSeedingRide(false);
    }
  }

  async function toggleOnline(value: boolean) {
    if (!fleetId || !app) return;
    setOnline(value);
    await setDriverOnline(fleetId, value);
    const hb = await sendDriverHeartbeat(
      {
        fleetId,
        applicationId: app.id,
        name: app.name,
        phone: app.phone,
        city: app.city,
      },
      value
    );
    if (hb.blocked) {
      setOnline(false);
      await setDriverOnline(fleetId, false);
      Alert.alert(
        'Conta bloqueada',
        hb.message || 'Seu acesso foi suspenso pelo suporte Peça Já.'
      );
    }
  }

  // Mantém presença na frota enquanto online (outros aparelhos veem)
  useFocusEffect(
    useCallback(() => {
      if (!app || !fleetId || !online) return;
      let alive = true;
      const beat = async () => {
        if (!alive) return;
        const hb = await sendDriverHeartbeat(
          {
            fleetId,
            applicationId: app.id,
            name: app.name,
            phone: app.phone,
            city: app.city,
          },
          true
        );
        if (hb.blocked && alive) {
          setOnline(false);
          await setDriverOnline(fleetId, false);
          Alert.alert(
            'Conta bloqueada',
            hb.message || 'Seu acesso foi suspenso pelo suporte Peça Já.'
          );
        }
      };
      void beat();
      const id = setInterval(() => void beat(), 20_000);
      return () => {
        alive = false;
        clearInterval(id);
      };
    }, [app, fleetId, online])
  );

  // Countdown + redispatch na home (oferta aparece no pop-up)
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!online || !fleetId) return;
      void runFairDispatch();
      const poll = setInterval(() => void runFairDispatch(), 4000);
      return () => clearInterval(poll);
    }, [online, fleetId, runFairDispatch])
  );

  useEffect(() => {
    if (offer?.id && popupDismissedId && popupDismissedId !== offer.id) {
      setPopupDismissedId(null);
    }
  }, [offer?.id, popupDismissedId]);

  useEffect(() => {
    if (!offer || !offer.offerExpiresAt || !showOfferPopup) return;
    void alertExclusiveOffer({
      orderId: offer.id,
      businessName: offer.businessName,
      address: offer.address,
      freteLabel: formatPrice(driverEarningsOf(offer)),
      offerExpiresAt: offer.offerExpiresAt,
    });
  }, [offer?.id, offer?.offerExpiresAt, showOfferPopup]);

  async function acceptHomeOffer() {
    if (!fleetId || !app || !offer) return;
    setOfferBusy(true);
    try {
      const res = await assignDriverToOrder(offer.id, {
        id: fleetId,
        name: app.name,
        phone: app.phone,
        ...driverPublicProfile(app),
      });
      if (!res.ok) {
        Alert.alert('Oferta', res.error);
        void runFairDispatch();
        return;
      }
      await resetDriverOfferDeclines(fleetId);
      setOffersInTabOnly(false);
    } finally {
      setOfferBusy(false);
    }
  }

  function declineHomeOffer() {
    if (!fleetId || !offer) return;
    Alert.alert('Recusar oferta', 'Este pedido vai para outro motoboy.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Recusar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setOfferBusy(true);
            const res = await declineDriverOffer(offer.id, fleetId);
            if (res.ok) {
              const { muted, count } = await recordDriverOfferDecline(fleetId);
              setOffersInTabOnly(muted);
              if (muted) {
                Alert.alert(
                  'Ofertas na aba Disponíveis',
                  `Você recusou ${count} corridas hoje. Novas ofertas não vão mais abrir na tela inicial — abra Disponíveis para ver e aceitar.`
                );
              }
            } else {
              Alert.alert('Oferta', res.error);
            }
            setOfferBusy(false);
          })();
        },
      },
    ]);
  }

  async function approveDev() {
    if (!app) return;
    const updated = await setPartnerStatus(app.id, 'approved');
    if (updated?.role === 'driver') setApp(updated);
  }

  const actions: ActionDef[] = [
    {
      icon: 'flash',
      label: 'Disponíveis',
      color: '#F59E0B',
      href: '/driver/jobs',
      badge: disponiveisBadge,
    },
    { icon: 'bicycle', label: 'Em rota', color: ACCENT, href: '/driver/active', badge: active.length },
    { icon: 'trophy', label: 'Liga', color: '#FBBF24', href: '/driver/league' },
    { icon: 'keypad', label: 'Entregar', color: '#059669', href: '/driver/deliver' },
    { icon: 'chatbubbles', label: 'Chats', color: '#EC4899', href: '/driver/chat' },
    { icon: 'wallet', label: 'Ganhos', color: '#0EA5E9', href: '/driver/wallet' },
    { icon: 'time', label: 'Histórico', color: '#64748B', href: '/driver/history' },
    { icon: 'settings', label: 'Ajustes', color: '#475569', href: '/driver/settings' },
  ];

  if (loading) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </MobileShell>
    );
  }

  if (!app) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Painel do entregador" fallbackHref="/(tabs)/profile" preferFallback />
        <View style={styles.empty}>
          <Ionicons name="bicycle-outline" size={44} color={ACCENT} />
          <Text style={styles.emptyTitle}>Entre no painel</Text>
          <Text style={styles.emptyText}>
            Faça login ou cadastre moto/CNH e assine o termo de responsabilidade para começar.
          </Text>
          <Button
            title="Entrar / criar conta"
            onPress={() => router.push('/driver/login' as any)}
            size="lg"
          />
        </View>
      </MobileShell>
    );
  }

  const gate = driverOnboardingGate(app);

  // Termo pendente: painel abre mesmo assim (bloco do termo no final).
  // Só bloqueia rejeitado; pending mostra status.
  if (gate === 'rejected') {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Painel do entregador" fallbackHref="/(tabs)/profile" preferFallback />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusValue}>{partnerStatusLabel(app)}</Text>
            <Text style={styles.bizName}>{app.name}</Text>
          </View>
          <View style={styles.infoBoxErr}>
            <Ionicons name="close-circle" size={18} color={theme.colors.error} />
            <Text style={styles.infoText}>
              Candidatura recusada. Fale com o suporte ou envie um novo cadastro pelo login.
            </Text>
          </View>
          <Button
            title="Sair / trocar conta"
            variant="outline"
            onPress={() => router.replace('/driver/login' as any)}
            style={{ marginTop: theme.spacing.md }}
          />
        </ScrollView>
      </MobileShell>
    );
  }

  if (gate === 'pending') {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Painel do entregador" fallbackHref="/(tabs)/profile" preferFallback />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusValue}>{partnerStatusLabel(app)}</Text>
            <Text style={styles.bizName}>{app.name}</Text>
            <Text style={styles.meta}>
              {app.vehicle} · {app.email}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Ionicons name="time-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.infoText}>
              Termo assinado. Seu cadastro está em análise. Quando aprovarmos, você liga o online e
              aceita corridas. Se o HQ já aprovou, toque em “Atualizar status”.
            </Text>
          </View>
          <Button
            title="Atualizar status"
            onPress={() => {
              void (async () => {
                setLoading(true);
                try {
                  const next = await pullDriverStatusFromHq(app);
                  setApp(next);
                  if (next.status === 'approved') {
                    Alert.alert('Aprovado', 'Cadastro liberado. Você já pode ficar online.');
                    await refresh();
                    return;
                  }
                  if (next.status === 'rejected') {
                    Alert.alert('Recusado', 'Este cadastro foi recusado no painel.');
                    return;
                  }
                  Alert.alert(
                    'Ainda em análise',
                    'A nuvem ainda marca como pendente. Confirme no HQ se o e-mail é o mesmo deste aparelho e toque de novo.'
                  );
                } finally {
                  setLoading(false);
                }
              })();
            }}
            style={{ marginTop: theme.spacing.md }}
          />
          <DriverTermsPanelSection app={app} />
          <Button
            title="Sair / trocar conta"
            variant="outline"
            onPress={() => router.replace('/driver/login' as any)}
            style={{ marginTop: theme.spacing.md }}
          />
          {__DEV__ && (
            <Button
              title="[DEV] Aprovar entregador"
              variant="outline"
              onPress={() => void approveDev()}
              style={{ marginTop: theme.spacing.sm }}
            />
          )}
        </ScrollView>
      </MobileShell>
    );
  }

  if (gate === 'terms') {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Painel do entregador" fallbackHref="/(tabs)/profile" preferFallback />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusValue}>{partnerStatusLabel(app)}</Text>
            <Text style={styles.bizName}>{app.name}</Text>
            <Text style={styles.meta}>
              {app.vehicle} · {app.email}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Ionicons name="document-text-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.infoText}>
              Para liberar o painel, leia e assine o termo de responsabilidade abaixo.
            </Text>
          </View>
          <DriverTermsPanelSection app={app} />
          <Button
            title="Sair / trocar conta"
            variant="outline"
            onPress={() => router.replace('/driver/login' as any)}
            style={{ marginTop: theme.spacing.md }}
          />
        </ScrollView>
      </MobileShell>
    );
  }

  // gate === 'ready'
  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Painel do entregador" fallbackHref="/(tabs)/profile" preferFallback />
      <DriverOfferPopup
        visible={showOfferPopup}
        order={offer}
        secondsLeft={secondsLeft}
        busy={offerBusy}
        onAccept={() => void acceptHomeOffer()}
        onDecline={declineHomeOffer}
        onDismiss={() => offer && setPopupDismissedId(offer.id)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Olá, {app.name.split(/\s+/)[0]}</Text>
            <TouchableOpacity
              onPress={() => router.push('/driver/settings' as any)}
              activeOpacity={0.75}
              hitSlop={8}
            >
              <Text style={styles.heroMeta}>
                {app.vehicleType || app.vehicle} ·{' '}
                {online
                  ? gpsStatus === 'denied' || gpsStatus === 'unavailable'
                    ? 'Online — cliente não vê seu GPS'
                    : 'Online — recebendo corridas'
                  : 'Offline'}
                {' · '}
                <Text style={styles.heroMetaLink}>trocar veículo</Text>
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.onlineRow}>
            <Text style={styles.onlineLbl}>{online ? 'ON' : 'OFF'}</Text>
            <Switch
              value={online}
              onValueChange={(v) => void toggleOnline(v)}
              trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
              thumbColor={online ? ACCENT : '#f4f4f5'}
            />
          </View>
        </View>

        <DriverGpsBanner status={online ? gpsStatus : 'idle'} />

        <FleetStatusChip online={fleetOnline} persistence={fleetPersistence} />

        {offersInTabOnly && online ? (
          <TouchableOpacity
            style={styles.offersTabBanner}
            activeOpacity={0.9}
            onPress={() => router.push('/driver/jobs' as any)}
            accessibilityRole="button"
            accessibilityLabel="Abrir ofertas em Disponíveis"
          >
            <Ionicons name="flash" size={18} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.offersTabBannerTitle}>
                Ofertas só em Disponíveis
              </Text>
              <Text style={styles.offersTabBannerBody}>
                Depois de {DRIVER_OFFER_POPUP_DECLINE_LIMIT} recusas, elas não abrem mais na
                tela inicial
                {offer && active.length === 0 ? ' · tem oferta esperando' : ''}.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#92400E" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{formatPrice(balance)}</Text>
            <Text style={styles.statLbl}>Saldo</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{formatPrice(todayEarned)}</Text>
            <Text style={styles.statLbl}>Hoje</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={[styles.stat, active.length > 0 && styles.statHot]}>
            <Text style={[styles.statVal, active.length > 0 && styles.statValHot]}>
              {active.length}
            </Text>
            <Text style={styles.statLbl}>Em rota</Text>
          </View>
        </View>

        <ActiveRunsBlock
          variant="driver"
          orders={active.slice(0, 4)}
          accent={ACCENT}
          onPressOrder={(id) =>
            router.push({ pathname: '/driver/order/[id]' as any, params: { id } })
          }
          onSeeAll={() => router.push('/driver/active' as any)}
          emptyHint="Aceite uma oferta — a corrida ativa fica destacada aqui."
        />

        {active[0] ? (
          <View style={styles.routeFeature}>
            <View style={styles.routeFeatureTop}>
              <View style={styles.routeLivePill}>
                <View style={styles.routeLiveDot} />
                <Text style={styles.routeLiveText}>EM ROTA AGORA</Text>
              </View>
              <Text style={styles.routeFrete}>
                {formatPrice(driverEarningsOf(active[0]))}
              </Text>
            </View>
            <Text style={styles.routeBiz} numberOfLines={1}>
              {active[0].businessName}
            </Text>
            <Text style={styles.routePhase}>
              {active[0].pickupVerifiedAt || active[0].status === 'saiu_entrega'
                ? 'Destino: cliente'
                : 'Destino: loja para retirada'}
              {' · '}
              {statusLabelPt(active[0].status)}
            </Text>
            <Text style={styles.routeAddr} numberOfLines={2}>
              {active[0].address}
            </Text>
            <DriverRouteMap order={active[0]} trackDriver featured />
            <View style={styles.routeActions}>
              <TouchableOpacity
                style={styles.routeNavBtn}
                activeOpacity={0.88}
                onPress={() =>
                  router.push({
                    pathname: '/driver/nav/[id]' as any,
                    params: { id: active[0].id },
                  })
                }
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.routeNavBtnText}>Abrir navegação</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.routeDetailBtn}
                activeOpacity={0.88}
                onPress={() =>
                  router.push({
                    pathname: '/driver/order/[id]' as any,
                    params: { id: active[0].id },
                  })
                }
              >
                <Text style={styles.routeDetailBtnText}>Detalhes</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <DriverLeagueCard league={league} loading={leagueLoading} />

        {__DEV__ ? (
          <>
            <TouchableOpacity
              style={styles.testRideBtn}
              onPress={() => void sendTestRide()}
              disabled={seedingRide}
              activeOpacity={0.85}
            >
              {seedingRide ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash" size={20} color="#fff" />
                  <Text style={styles.testRideBtnText}>Enviar corrida de teste</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sampleBtn}
              onPress={() => void ensureLeagueSample()}
              disabled={seedingLeague}
              activeOpacity={0.85}
            >
              {seedingLeague ? (
                <ActivityIndicator color="#FBBF24" />
              ) : (
                <>
                  <Ionicons name="people-outline" size={18} color="#FBBF24" />
                  <Text style={styles.sampleBtnText}>
                    Carregar amostra · 4 motoboys na Liga
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        {!online ? (
          <View style={styles.infoBox}>
            <Ionicons name="moon-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.infoText}>
              Você está offline. Ligue o switch para aparecer nas corridas disponíveis.
            </Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.href}
              style={styles.action}
              activeOpacity={0.88}
              onPress={() => router.push(a.href as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color + '22' }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
                {a.badge && a.badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{a.badge > 9 ? '9+' : a.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Disponíveis na fila</Text>
        {offersInTabOnly ? (
          <TouchableOpacity
            style={styles.mutedTabHint}
            activeOpacity={0.88}
            onPress={() => router.push('/driver/jobs' as any)}
          >
            <Text style={styles.mutedInline}>
              Fila e ofertas exclusivas estão na aba Disponíveis — toque para abrir.
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            {active.length === 0 && jobs.length === 0 ? (
              <Text style={styles.mutedInline}>
                Nenhuma oferta agora. Quando a cozinha marcar pronto, aparece em Disponíveis.
              </Text>
            ) : null}

            {online &&
              jobs.slice(0, 3).map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.card}
                  activeOpacity={0.88}
                  onPress={() => router.push('/driver/jobs' as any)}
                >
              <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  Nova · {order.businessName}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {formatPrice(driverEarningsOf(order))} · {order.address}
                </Text>
              </View>
              <Text style={styles.acceptHint}>Ver</Text>
            </TouchableOpacity>
          ))}
          </>
        )}

        <DriverTermsPanelSection app={app} />
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 24, paddingTop: 48, gap: 10 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4C1D95',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  hello: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  heroMetaLink: {
    color: '#FDE68A',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  onlineRow: { alignItems: 'center', gap: 4 },
  onlineLbl: { color: '#fff', fontWeight: '700', fontSize: 11 },
  stats: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    marginBottom: 12,
  },
  testRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
  },
  testRideBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  sampleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(46,16,101,0.06)',
  },
  sampleBtnText: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 13,
  },
  stat: { flex: 1, alignItems: 'center' },
  statHot: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    marginHorizontal: 4,
    paddingVertical: 2,
  },
  statVal: { fontWeight: '800', color: theme.colors.text, fontSize: 16 },
  statValHot: { color: ACCENT },
  statLbl: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  statDiv: { width: 1, backgroundColor: theme.colors.border },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  action: {
    width: '22%',
    minWidth: 72,
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  sectionTitle: {
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    fontSize: 15,
  },
  routeFeature: {
    marginTop: 4,
    marginBottom: 14,
    backgroundColor: '#F5F3FF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#7C3AED',
    padding: 14,
    gap: 6,
  },
  routeFeatureTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  routeLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4C1D95',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  routeLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  routeLiveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  routeFrete: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
  },
  routeBiz: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E1B4B',
  },
  routePhase: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6D28D9',
  },
  routeAddr: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
  routeActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  routeNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 13,
  },
  routeNavBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  routeDetailBtn: {
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    backgroundColor: '#fff',
  },
  routeDetailBtnText: {
    color: '#7C3AED',
    fontWeight: '800',
    fontSize: 14,
  },
  mutedInline: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  mutedTabHint: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 8,
  },
  offersTabBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 12,
  },
  offersTabBannerTitle: {
    color: '#92400E',
    fontWeight: '800',
    fontSize: 14,
  },
  offersTabBannerBody: {
    color: '#A16207',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontWeight: '700', color: theme.colors.text },
  cardSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  acceptHint: { color: ACCENT, fontWeight: '700', fontSize: 12 },
  statusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  statusLabel: { fontSize: 11, color: theme.colors.textMuted },
  statusValue: { fontSize: 20, fontWeight: '800', color: ACCENT, marginTop: 2 },
  bizName: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginTop: 8 },
  meta: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.accentSoft,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoBoxErr: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.errorLight,
    padding: 12,
    borderRadius: 12,
  },
  infoText: { flex: 1, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
});
