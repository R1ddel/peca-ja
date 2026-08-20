import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { BackHeader } from '@/components/BackHeader';
import { StaffPanelHeader } from '@/components/StaffPanelHeader';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { MerchantShop, patchShop } from '@/utils/merchantShop';
import { MerchantApplication, formatPlanPaidUntil } from '@/utils/partners';
import { buildMerchantInsights } from '@/utils/merchantInsights';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatOrderTime, formatWaitLabel } from '@/utils/datetime';
import { formatPrice } from '@/data/businesses';
import { orderStatusConfig, theme } from '@/constants/theme';
import { MERCHANT_PLANS, formatPlanPrice } from '@/constants/plans';
import {
  getValidStaffSession,
  staffCan,
  listPendingAccessRequests,
  StaffPermission,
  StaffSession,
  StaffAccessRequest,
  isApplicationOwnerEmail,
  logoutStaff,
} from '@/utils/merchantTeam';
import { listTodayPunches, StaffPunch } from '@/utils/merchantPunch';
import { PunchLogBlock } from '@/components/PunchLogBlock';
import { StaffAccessRequestsBlock } from '@/components/StaffAccessRequestsBlock';
import { OwnerPinGate } from '@/components/OwnerPinGate';
import { countMerchantUnread } from '@/services/orderChat';
import { shareDaySummary } from '@/utils/merchantDayExport';
import { Order } from '@/types';

const ACCENT = '#0F766E';
const KITCHEN_STATUSES = new Set(['confirmado', 'preparando']);

type ActionDef = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  href: string;
  perm: StaffPermission;
};

const ACTIONS: ActionDef[] = [
  { icon: 'flash', label: 'Pedidos', color: '#FF6B35', href: '/merchant/orders', perm: 'orders' },
  { icon: 'restaurant', label: 'Cardápio', color: '#00A86B', href: '/merchant/menu', perm: 'menu' },
  { icon: 'pricetag', label: 'Promos', color: '#E11D48', href: '/merchant/promos', perm: 'promos' },
  { icon: 'wallet', label: 'Saldo', color: '#059669', href: '/merchant/wallet', perm: 'wallet' },
  { icon: 'people', label: 'Equipe', color: '#0EA5E9', href: '/merchant/team', perm: 'team' },
  { icon: 'storefront', label: 'Lojas', color: '#F59E0B', href: '/merchant/stores', perm: 'stores' },
  { icon: 'analytics', label: 'Insights', color: '#7C3AED', href: '/merchant/insights', perm: 'insights' },
  { icon: 'cloud', label: 'Sync', color: '#6366F1', href: '/merchant/sync', perm: 'sync' },
  { icon: 'settings', label: 'Ajustes', color: '#64748B', href: '/merchant/settings', perm: 'settings' },
  {
    icon: 'chatbubbles',
    label: 'Conversas',
    color: '#EC4899',
    href: '/merchant/chat',
    perm: 'chat',
  },
  { icon: 'keypad', label: 'Retirada', color: '#8B5CF6', href: '/merchant/pickup', perm: 'pickup' },
];

export default function OwnerPanelScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<StaffSession | null>(null);
  const [app, setApp] = useState<MerchantApplication | null>(null);
  const [shop, setShop] = useState<MerchantShop | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<StaffAccessRequest[]>([]);
  const [punches, setPunches] = useState<StaffPunch[]>([]);
  const [chatUnread, setChatUnread] = useState(0);

  const load = useCallback(async () => {
    const { app: foundApp, shop: foundShop } = await resolveOperatorMerchantContext(user?.email);
    setApp(foundApp);
    setShop(foundShop);

    const sess = await getValidStaffSession();
    if (
      sess &&
      foundShop &&
      foundApp &&
      sess.role === 'owner' &&
      sess.businessId === foundShop.businessId &&
      isApplicationOwnerEmail(user?.email, foundApp.email)
    ) {
      setSession(sess);
    } else {
      if (sess?.role === 'owner' && !isApplicationOwnerEmail(user?.email, foundApp?.email)) {
        await logoutStaff();
      }
      setSession(null);
    }

    if (foundShop) {
      const pending = await listPendingAccessRequests(foundShop.businessId);
      setPendingRequests(pending);
      setPendingCount(pending.length);
      setPunches(await listTodayPunches(foundShop.businessId));
      const shopOrders = orders.filter((o) => o.businessId === foundShop.businessId);
      setChatUnread(await countMerchantUnread(shopOrders));
    } else {
      setPendingRequests([]);
      setPendingCount(0);
      setPunches([]);
      setChatUnread(0);
    }
    setLoading(false);
  }, [user?.email, orders]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
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
        <BackHeader title="Dono" fallbackHref="/merchant/advanced" />
        <View style={styles.emptyBox}>
          <Ionicons name="storefront-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Nenhuma loja encontrada</Text>
          <Text style={styles.emptyText}>
            Cadastre sua loja com o e-mail da compra para liberar o painel do dono.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/partner/merchant-apply' as any)}
          >
            <Text style={styles.emptyBtnText}>Cadastrar loja</Text>
          </TouchableOpacity>
        </View>
      </MobileShell>
    );
  }

  if (!isApplicationOwnerEmail(user?.email, app.email)) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Dono" fallbackHref="/merchant/advanced" />
        <View style={styles.emptyBox}>
          <Ionicons name="lock-closed-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Acesso só do dono</Text>
          <Text style={styles.emptyText}>
            O painel do dono abre apenas com o e-mail cadastrado na compra da loja (
            {app.email}). Funcionários pedem acesso e entram no painel da função
            (cozinha, caixa ou gerente).
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => {
              void logoutStaff();
              router.replace('/merchant/advanced' as any);
            }}
          >
            <Text style={styles.emptyBtnText}>Ir para painéis da equipe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: theme.colors.surface, marginTop: 8 }]}
            onPress={() => router.push('/merchant/staff/request-access' as any)}
          >
            <Text style={[styles.emptyBtnText, { color: ACCENT }]}>Pedir acesso à equipe</Text>
          </TouchableOpacity>
        </View>
      </MobileShell>
    );
  }

  if (!session) {
    return (
      <OwnerPinGate
        businessId={shop.businessId}
        shopName={shop.name}
        ownerName={app.ownerName || user?.name || 'Dono'}
        ownerEmail={app.email}
        actorEmail={user?.email}
        accent={ACCENT}
        onEntered={(s) => setSession(s)}
      />
    );
  }

  const visibleActions = ACTIONS.filter((a) => staffCan(session.role, a.perm));
  const plan = app.plan ? MERCHANT_PLANS[app.plan] : null;
  const paidUntil = formatPlanPaidUntil(app);

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Dono" fallbackHref="/merchant/advanced" />
      <StaffPanelHeader
        shopName={shop.name}
        operatorName={session.name}
        role="owner"
        title="Painel do dono"
        subtitle={shop.isOpen ? 'Loja aberta agora' : 'Loja fechada'}
        accent={ACCENT}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <KpiCell label="Entregues" value={String(insights.deliveredToday)} />
        </View>

        <View style={styles.daySummary}>
          <View style={styles.daySummaryHead}>
            <Ionicons name="today-outline" size={18} color={ACCENT} />
            <Text style={styles.daySummaryTitle}>Resumo de hoje</Text>
          </View>
          <Text style={styles.daySummaryLine}>
            {insights.todayOrders} pedido{insights.todayOrders === 1 ? '' : 's'} ·{' '}
            {insights.canceledToday} cancelamento{insights.canceledToday === 1 ? '' : 's'} ·{' '}
            {chatUnread} conversa{chatUnread === 1 ? '' : 's'} não lida
            {chatUnread === 1 ? '' : 's'}
          </Text>
          <Text style={styles.daySummaryHint}>
            {insights.canceledToday > 0
              ? 'Há cancelamentos hoje — exporte o resumo para guardar os motivos.'
              : 'Tudo sob controle. Exporte o resumo quando quiser guardar o dia.'}
          </Text>
          <TouchableOpacity
            style={styles.exportBtn}
            activeOpacity={0.88}
            onPress={() => {
              const latestByMember = new Map<string, (typeof punches)[number]>();
              const chronological = [...punches].sort(
                (a, b) => +new Date(a.punchedAt) - +new Date(b.punchedAt)
              );
              for (const p of chronological) latestByMember.set(p.memberId, p);
              const onShiftNames = [...latestByMember.values()]
                .filter((p) => !p.kind || p.kind === 'in')
                .map((p) => p.memberName);
              void shareDaySummary({
                shopName: shop.name,
                orders: myOrders,
                chatUnread,
                onShiftNames,
              }).catch(() =>
                Alert.alert('Exportar', 'Não foi possível compartilhar o resumo.')
              );
            }}
          >
            <Ionicons name="share-outline" size={16} color="#fff" />
            <Text style={styles.exportBtnText}>Exportar resumo do dia</Text>
          </TouchableOpacity>
        </View>

        <StaffAccessRequestsBlock
          requests={pendingRequests}
          reviewerName={session.name}
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
        <View style={styles.grid}>
          {visibleActions.map((a) => (
            <TouchableOpacity
              key={a.href}
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => router.push(a.href as any)}
            >
              <View style={[styles.cardIcon, { backgroundColor: a.color + '18' }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
                {a.perm === 'team' && pendingCount > 0 ? (
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{pendingCount}</Text>
                  </View>
                ) : null}
                {a.perm === 'chat' && chatUnread > 0 ? (
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{chatUnread}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardLabel}>
                {a.perm === 'team' && pendingCount > 0
                  ? `Equipe · ${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`
                  : a.perm === 'chat' && chatUnread > 0
                    ? `Conversas · ${chatUnread}`
                    : a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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

function KpiCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiCell}>
      <Text style={styles.kpiValue}>{value}</Text>
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
  kpiCell: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: 14, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  kpiLabel: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },

  daySummary: {
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
    gap: 6,
  },
  daySummaryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  daySummaryTitle: {
    fontSize: 15,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  daySummaryLine: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
    fontWeight: theme.fontWeight.semibold,
  },
  daySummaryHint: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },
  exportBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  exportBtnText: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: 12 },

  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
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
