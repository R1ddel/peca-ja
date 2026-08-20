import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { BackHeader } from '@/components/BackHeader';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveActiveMerchantContext } from '@/utils/merchantStores';
import { MerchantShop, patchShop } from '@/utils/merchantShop';
import {
  MerchantApplication,
  formatPlanPaidUntil,
  isMerchantPanelUnlocked,
  merchantOnboardingGate,
} from '@/utils/partners';
import { buildMerchantInsights } from '@/utils/merchantInsights';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatOrderTime, formatWaitLabel } from '@/utils/datetime';
import { formatPrice } from '@/data/businesses';
import { orderStatusConfig, theme } from '@/constants/theme';
import { MERCHANT_PLANS, formatPlanPrice } from '@/constants/plans';
import { listPendingAccessRequests, logoutStaff, StaffAccessRequest } from '@/utils/merchantTeam';
import { listTodayPunches, StaffPunch } from '@/utils/merchantPunch';
import { PunchLogBlock } from '@/components/PunchLogBlock';
import { StaffAccessRequestsBlock } from '@/components/StaffAccessRequestsBlock';
import { countMerchantUnread } from '@/services/orderChat';
import {
  needsPizzaSeed,
  seedPizzaMerchantCatalog,
} from '@/utils/seedPizzaMerchant';
import { Order } from '@/types';
import {
  ActiveRunsBlock,
  listMerchantActiveRuns,
} from '@/components/ActiveRunsBlock';
import { FleetStatusChip } from '@/components/FleetStatusChip';
import { CustomerLiveMap } from '@/components/CustomerLiveMap';

const ACCENT = '#0F766E';
const KITCHEN_STATUSES = new Set(['confirmado', 'preparando']);

type ActionDef = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  href: string;
};

const PRIMARY_ACTIONS: ActionDef[] = [
  { icon: 'flash', label: 'Pedidos', color: '#FF6B35', href: '/merchant/orders' },
  { icon: 'restaurant', label: 'Cardápio', color: '#00A86B', href: '/merchant/menu' },
  { icon: 'wallet', label: 'Saldo', color: '#059669', href: '/merchant/wallet' },
  { icon: 'chatbubbles', label: 'Conversas', color: '#EC4899', href: '/merchant/chat' },
];

const MORE_ACTIONS: ActionDef[] = [
  { icon: 'pricetag', label: 'Promos', color: '#E11D48', href: '/merchant/promos' },
  { icon: 'people', label: 'Equipe', color: '#0EA5E9', href: '/merchant/team' },
  { icon: 'storefront', label: 'Lojas', color: '#F59E0B', href: '/merchant/stores' },
  { icon: 'analytics', label: 'Insights', color: '#7C3AED', href: '/merchant/insights' },
  { icon: 'cloud', label: 'Sync', color: '#6366F1', href: '/merchant/sync' },
  { icon: 'settings', label: 'Ajustes', color: '#64748B', href: '/merchant/settings' },
  { icon: 'keypad', label: 'Retirada', color: '#8B5CF6', href: '/merchant/pickup' },
];

/**
 * Painel único do comércio — como antes (sem PIN / sem gate de função).
 * Sistema avançado fica em /merchant/advanced.
 */
export default function MerchantHomeScreen() {
  const { user } = useAuth();
  const { orders, fleetOnline, fleetPersistence } = useOrders();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<MerchantApplication | null>(null);
  const [shop, setShop] = useState<MerchantShop | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<StaffAccessRequest[]>([]);
  const [punches, setPunches] = useState<StaffPunch[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    // Não piscar spinner a cada sync de pedidos/frota.
    if (!hasLoadedRef.current) setLoading(true);
    try {
      // Limpa sessão antiga de PIN/função pra não bagunçar a loja do dono.
      await logoutStaff();
      const { app: foundApp, shop: foundShop } = await resolveActiveMerchantContext(user?.email);
      let nextShop = foundShop;
      if (foundApp && nextShop && needsPizzaSeed(nextShop)) {
        try {
          const seeded = await seedPizzaMerchantCatalog(foundApp.id);
          if (seeded) nextShop = seeded.shop;
        } catch {
          // seed opcional
        }
      }
      setApp(foundApp);
      setShop(nextShop);
      if (nextShop) {
        const pending = await listPendingAccessRequests(nextShop.businessId);
        setPendingRequests(pending);
        setPendingCount(pending.length);
        setPunches(await listTodayPunches(nextShop.businessId));
        const shopOrders = ordersRef.current.filter((o) => o.businessId === nextShop!.businessId);
        setChatUnread(await countMerchantUnread(shopOrders));
      } else {
        setPendingRequests([]);
        setPendingCount(0);
        setPunches([]);
        setChatUnread(0);
      }
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void load();
      setNowMs(Date.now());
      const tick = setInterval(() => setNowMs(Date.now()), 20000);
      return () => clearInterval(tick);
    }, [load])
  );

  const myOrders = useMemo(() => {
    if (!shop) return [];
    return orders.filter((o) => o.businessId === shop.businessId);
  }, [orders, shop]);

  const insights = useMemo(() => buildMerchantInsights(myOrders), [myOrders]);

  const kitchenQueue = useMemo(() => {
    return myOrders
      .filter((o) => KITCHEN_STATUSES.has(o.status))
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .slice(0, 5);
  }, [myOrders]);

  const activeRuns = useMemo(() => {
    if (!shop) return [];
    return listMerchantActiveRuns(myOrders, shop.businessId).slice(0, 6);
  }, [myOrders, shop]);

  const awaitingPickup = useMemo(() => {
    if (!shop) return [];
    return myOrders.filter(
      (o) =>
        o.businessId === shop.businessId &&
        o.status === 'preparando' &&
        !!o.kitchenReadyAt &&
        !o.pickupVerifiedAt
    );
  }, [myOrders, shop]);

  async function toggleOpen(value: boolean) {
    if (!app) return;
    const updated = await patchShop(app.id, { isOpen: value });
    if (updated) setShop(updated);
  }

  function openOrder(id: string) {
    router.push({ pathname: '/merchant/order/[id]' as any, params: { id } });
  }

  if (loading) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </MobileShell>
    );
  }

  if (!shop || !app) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Painel do comércio" fallbackHref="/(tabs)/profile" />
        <View style={styles.emptyBox}>
          <Ionicons name="storefront-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Painel do dono</Text>
          <Text style={styles.emptyText}>
            Este hub é só para o e-mail cadastrado na compra da loja. Se você é da equipe,
            peça acesso e entre pelo sistema avançado na sua função.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/merchant/advanced' as any)}
          >
            <Text style={styles.emptyBtnText}>Sistema avançado / equipe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: theme.colors.surface, marginTop: 8 }]}
            onPress={() => router.push('/merchant/staff/request-access' as any)}
          >
            <Text style={[styles.emptyBtnText, { color: ACCENT }]}>Pedir acesso</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: theme.colors.surface, marginTop: 8 }]}
            onPress={() => router.push('/partner' as any)}
          >
            <Text style={[styles.emptyBtnText, { color: ACCENT }]}>Cadastrar minha loja</Text>
          </TouchableOpacity>
        </View>
      </MobileShell>
    );
  }

  const plan = app.plan ? MERCHANT_PLANS[app.plan] : null;
  const paidUntil = formatPlanPaidUntil(app);
  const unlocked = isMerchantPanelUnlocked(app);
  const gate = merchantOnboardingGate(app);
  const gateHref =
    gate === 'pay'
      ? '/partner/pay'
      : gate === 'terms'
        ? '/partner/terms'
        : '/partner/plans';
  const gateLabel =
    gate === 'pay'
      ? 'Concluir pagamento'
      : gate === 'terms'
        ? 'Aceitar termo'
        : 'Escolher plano';

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Painel do comércio" fallbackHref="/(tabs)/profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.shopName}>{shop.name}</Text>
        <Text style={styles.shopSub}>
          {shop.isOpen ? 'Loja aberta · recebendo pedidos' : 'Loja fechada'}
        </Text>

        <FleetStatusChip online={fleetOnline} persistence={fleetPersistence} />

        {!unlocked ? (
          <TouchableOpacity
            style={styles.lockBanner}
            activeOpacity={0.9}
            onPress={() =>
              router.push({ pathname: gateHref as any, params: { id: app.id } })
            }
          >
            <Ionicons name="lock-open-outline" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Assinatura pendente</Text>
              <Text style={styles.lockSub}>Toque para {gateLabel.toLowerCase()} e liberar tudo</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.openRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.openTitle}>{shop.isOpen ? 'Loja aberta' : 'Loja fechada'}</Text>
            <Text style={styles.openHint}>
              {shop.isOpen ? 'Recebendo pedidos agora' : 'Clientes não conseguem pedir'}
            </Text>
          </View>
          <Switch
            value={shop.isOpen}
            onValueChange={(v) => void toggleOpen(v)}
            trackColor={{ false: '#D1D5DB', true: '#99F6E4' }}
            thumbColor={shop.isOpen ? ACCENT : '#f4f3f4'}
          />
        </View>

        <View style={styles.kpiRow}>
          <KpiCell label="Líquido hoje" value={formatPrice(insights.todaySales)} />
          <KpiCell label="Pedidos" value={String(insights.todayOrders)} />
          <KpiCell label="Cozinha" value={String(insights.kitchenCount)} />
          <KpiCell label="Em rota" value={String(activeRuns.length)} highlight={activeRuns.length > 0} />
        </View>

        {awaitingPickup.length > 0 ? (
          <TouchableOpacity
            style={styles.pickupBanner}
            activeOpacity={0.9}
            onPress={() =>
              router.push({
                pathname: '/merchant/pickup' as any,
                params: { orderId: awaitingPickup[0].id },
              })
            }
          >
            <View style={styles.pickupBannerIcon}>
              <Ionicons name="keypad" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickupBannerTitle}>
                {awaitingPickup.length === 1
                  ? `Liberar ${merchantOrderLabel(awaitingPickup[0])}`
                  : `${awaitingPickup.length} pedidos aguardando código`}
              </Text>
              <Text style={styles.pickupBannerSub} numberOfLines={1}>
                {awaitingPickup[0].driverName
                  ? `${awaitingPickup[0].driverName} · digite o código da tela dele`
                  : 'Digite o código do motoboy — o pedido certo aparece sozinho'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}

        <ActiveRunsBlock
          variant="merchant"
          orders={activeRuns}
          accent={ACCENT}
          onPressOrder={openOrder}
          onPickupCode={(id) =>
            router.push({
              pathname: '/merchant/pickup' as any,
              params: { orderId: id },
            })
          }
          onSeeAll={() => router.push('/merchant/orders' as any)}
          emptyHint="Quando um motoboy aceitar, a corrida aparece aqui em destaque."
        />

        {activeRuns[0] ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => openOrder(activeRuns[0].id)}
          >
            <CustomerLiveMap order={activeRuns[0]} viewer="merchant" height={200} />
          </TouchableOpacity>
        ) : null}

        <StaffAccessRequestsBlock
          requests={pendingRequests}
          reviewerName={app.ownerName || user?.name || 'Dono'}
          accent={ACCENT}
          onChanged={() => void load()}
        />

        <PunchLogBlock
          punches={punches}
          accent={ACCENT}
          nowMs={nowMs}
          onRefresh={() => void listTodayPunches(shop.businessId).then(setPunches)}
          onSeeReport={() => router.push('/merchant/punches' as any)}
        />

        <Text style={styles.sectionLabel}>Operação</Text>
        <View style={styles.primaryOps}>
          {PRIMARY_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.href}
              style={[styles.primaryCard, !unlocked && styles.cardDim]}
              activeOpacity={0.88}
              disabled={!unlocked && a.href !== '/merchant/settings'}
              onPress={() => {
                if (!unlocked) {
                  router.push({ pathname: gateHref as any, params: { id: app.id } });
                  return;
                }
                router.push(a.href as any);
              }}
            >
              <View style={[styles.primaryIcon, { backgroundColor: a.color + '18' }]}>
                <Ionicons name={a.icon} size={24} color={a.color} />
                {a.href === '/merchant/chat' && chatUnread > 0 ? (
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{chatUnread}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.primaryLabel}>
                {a.href === '/merchant/chat' && chatUnread > 0
                  ? `Conversas · ${chatUnread}`
                  : a.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Mais ferramentas</Text>
        <View style={styles.grid}>
          {MORE_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.href}
              style={[styles.card, !unlocked && styles.cardDim]}
              activeOpacity={0.88}
              onPress={() => {
                if (!unlocked) {
                  router.push({ pathname: gateHref as any, params: { id: app.id } });
                  return;
                }
                router.push(a.href as any);
              }}
            >
              <View style={[styles.cardIcon, { backgroundColor: a.color + '18' }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
                {a.href === '/merchant/team' && pendingCount > 0 ? (
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{pendingCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardLabel}>
                {a.href === '/merchant/team' && pendingCount > 0
                  ? `Equipe · ${pendingCount}`
                  : a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.advancedCard}
          activeOpacity={0.9}
          onPress={() => router.push('/merchant/advanced' as any)}
        >
          <View style={styles.advancedIcon}>
            <Ionicons name="layers" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.advancedTitle}>Sistema avançado</Text>
            <Text style={styles.advancedSub}>
              Painéis de caixa, cozinha, gerente e dono
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.planCard}
          activeOpacity={0.88}
          onPress={() => router.push({ pathname: '/partner/plans' as any, params: { id: app.id } })}
        >
          <View style={styles.planIcon}>
            <Ionicons name="diamond" size={20} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>{plan?.label ?? 'Escolher plano'}</Text>
            <Text style={styles.planHint}>
              {plan
                ? `${formatPlanPrice(plan.monthlyPrice)}/mês${paidUntil ? ` · até ${paidUntil}` : ''}`
                : 'Assine para liberar o painel'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.block}>
          <View style={styles.blockHead}>
            <View>
              <Text style={styles.blockTitle}>Fila da cozinha</Text>
              <Text style={styles.blockHint}>Os 5 mais antigos primeiro</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/merchant/orders' as any)}>
              <Text style={[styles.link, { color: ACCENT }]}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {kitchenQueue.length === 0 ? (
            <View style={styles.queueEmpty}>
              <Ionicons name="checkmark-circle-outline" size={26} color={theme.colors.textMuted} />
              <Text style={styles.queueEmptyText}>Cozinha livre no momento.</Text>
            </View>
          ) : (
            kitchenQueue.map((order, index) => (
              <QueueTicket
                key={order.id}
                order={order}
                position={index + 1}
                nowMs={nowMs}
                onPress={() => openOrder(order.id)}
              />
            ))
          )}
        </View>

        {insights.tip ? (
          <View style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={16} color={ACCENT} />
            <Text style={styles.tipText}>{insights.tip}</Text>
          </View>
        ) : null}
      </ScrollView>
    </MobileShell>
  );
}

function KpiCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.kpiCell, highlight && styles.kpiCellHot]}>
      <Text style={[styles.kpiValue, highlight && styles.kpiValueHot]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function QueueTicket({
  order,
  position,
  nowMs,
  onPress,
}: {
  order: Order;
  position: number;
  nowMs: number;
  onPress: () => void;
}) {
  const cfg = orderStatusConfig[order.status] ?? orderStatusConfig.confirmado;
  return (
    <TouchableOpacity style={styles.ticket} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.ticketPos}>
        <Text style={styles.ticketPosNum}>{position}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.ticketTop}>
          <Text style={styles.ticketCode}>{merchantOrderLabel(order)}</Text>
          <View style={[styles.statusPill, { backgroundColor: cfg.color + '22' }]}>
            <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={styles.ticketMeta}>
          {formatOrderTime(order.createdAt)} · {formatWaitLabel(order.createdAt, nowMs)} ·{' '}
          {order.items.length} item(ns) · {formatPrice(order.total)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  shopName: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  shopSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2, marginBottom: 8 },
  lockBanner: {
    marginTop: 10,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#B45309',
    borderRadius: 16,
    padding: 14,
  },
  lockTitle: { color: '#fff', fontSize: 14, fontWeight: theme.fontWeight.extrabold },
  lockSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  emptyBox: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyText: { textAlign: 'center', color: theme.colors.textSecondary, lineHeight: 20 },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
  },
  emptyBtnText: { color: '#fff', fontWeight: theme.fontWeight.bold },

  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  openTitle: { fontSize: 15, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  openHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  pickupBanner: {
    marginTop: 12,
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickupBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupBannerTitle: {
    color: '#fff',
    fontWeight: theme.fontWeight.extrabold,
    fontSize: 15,
  },
  pickupBannerSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    marginTop: 2,
  },
  kpiCell: { flex: 1, alignItems: 'center' },
  kpiCellHot: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingVertical: 4,
  },
  kpiValue: { fontSize: 14, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  kpiValueHot: { color: '#047857' },
  kpiLabel: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },

  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  primaryOps: { gap: 8 },
  primaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  primaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  cardDim: { opacity: 0.55 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cardBadgeText: { color: '#fff', fontSize: 10, fontWeight: theme.fontWeight.bold },
  cardLabel: { fontSize: 12, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },

  advancedCard: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
  },
  advancedIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedTitle: { color: '#fff', fontSize: 16, fontWeight: theme.fontWeight.extrabold },
  advancedSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2, lineHeight: 16 },

  planCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDFA',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  planIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: { fontSize: 14, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  planHint: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },

  block: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  blockHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  blockTitle: { fontSize: 16, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  blockHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  link: { fontWeight: theme.fontWeight.bold, fontSize: 13 },

  queueEmpty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  queueEmptyText: { fontSize: 13, color: theme.colors.textMuted },

  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: theme.colors.background,
  },
  ticketPos: { width: 26, alignItems: 'center' },
  ticketPosNum: { fontSize: 16, fontWeight: theme.fontWeight.extrabold, color: theme.colors.textMuted },
  ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ticketCode: { fontSize: 14, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  ticketMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 10, fontWeight: theme.fontWeight.bold },

  tipBox: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    padding: 12,
  },
  tipText: { flex: 1, fontSize: 12, color: '#115E59', lineHeight: 17 },
});
