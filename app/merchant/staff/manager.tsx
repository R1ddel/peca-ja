import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { BackHeader } from '@/components/BackHeader';
import { StaffPanelHeader } from '@/components/StaffPanelHeader';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { MerchantShop } from '@/utils/merchantShop';
import { buildMerchantInsights } from '@/utils/merchantInsights';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatOrderTime, formatWaitLabel } from '@/utils/datetime';
import { formatPrice } from '@/data/businesses';
import { orderStatusConfig, theme } from '@/constants/theme';
import { StaffPunchGate } from '@/components/StaffPunchGate';
import { PunchLogBlock } from '@/components/PunchLogBlock';
import {
  getValidStaffSession,
  staffCan,
  StaffPermission,
  StaffSession,
} from '@/utils/merchantTeam';
import { listTodayPunches, StaffPunch } from '@/utils/merchantPunch';
import { Order } from '@/types';

const ACCENT = '#0369A1';
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
  { icon: 'analytics', label: 'Insights', color: '#7C3AED', href: '/merchant/insights', perm: 'insights' },
  { icon: 'cloud', label: 'Sync', color: '#6366F1', href: '/merchant/sync', perm: 'sync' },
  { icon: 'settings', label: 'Ajustes', color: '#64748B', href: '/merchant/settings', perm: 'settings' },
  { icon: 'chatbubbles', label: 'Conversas', color: '#EC4899', href: '/merchant/chat', perm: 'chat' },
  { icon: 'keypad', label: 'Retirada', color: '#8B5CF6', href: '/merchant/pickup', perm: 'pickup' },
];

export default function ManagerPanelScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<StaffSession | null>(null);
  const [shop, setShop] = useState<MerchantShop | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [punches, setPunches] = useState<StaffPunch[]>([]);

  const load = useCallback(async () => {
    const found = (await resolveOperatorMerchantContext(user?.email)).shop;
    const sess = await getValidStaffSession();
    const punched =
      !!found &&
      !!sess &&
      sess.role === 'manager' &&
      sess.businessId === found.businessId;
    setShop(found);
    setSession(punched ? sess : null);
    if (found) {
      setPunches(await listTodayPunches(found.businessId));
    } else {
      setPunches([]);
    }
    setLoading(false);
  }, [user?.email]);

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

  if (!shop) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Gerente" fallbackHref="/merchant/advanced" />
        <View style={styles.emptyBox}>
          <Ionicons name="storefront-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Sem loja liberada</Text>
          <Text style={styles.emptyText}>
            Peça acesso à equipe e aguarde o dono aprovar. Depois entre no painel do gerente.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/merchant/staff/request-access' as any)}
          >
            <Text style={styles.emptyBtnText}>Pedir acesso</Text>
          </TouchableOpacity>
        </View>
      </MobileShell>
    );
  }

  if (!session) {
    return (
      <StaffPunchGate
        businessId={shop.businessId}
        shopName={shop.name}
        role="manager"
        accent={ACCENT}
        onPunched={(s) => {
          setSession(s);
          void listTodayPunches(shop.businessId).then(setPunches);
        }}
      />
    );
  }

  const visibleActions = ACTIONS.filter((a) => staffCan(session.role, a.perm));

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Gerente" fallbackHref="/merchant/advanced" />
      <StaffPanelHeader
        shopName={shop.name}
        operatorName={session.name}
        role="manager"
        title="Painel Gerente"
        subtitle={shop.isOpen ? 'Loja aberta agora' : 'Loja fechada'}
        accent={ACCENT}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.kpiRow}>
          <KpiCell label="Líquido hoje" value={formatPrice(insights.todaySales)} />
          <KpiCell label="Pedidos" value={String(insights.todayOrders)} />
          <KpiCell label="Cozinha" value={String(insights.kitchenCount)} />
          <KpiCell label="Entregues" value={String(insights.deliveredToday)} />
        </View>

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
              </View>
              <Text style={styles.cardLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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

  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  kpiCell: { flex: 1, alignItems: 'center' },
  kpiValue: { fontSize: 14, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
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
  cardLabel: { fontSize: 12, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },

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
    backgroundColor: '#E0F2FE',
    borderRadius: 14,
    padding: 12,
  },
  tipText: { flex: 1, fontSize: 12, color: '#075985', lineHeight: 17 },
});
