import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
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
import { MerchantShop } from '@/utils/merchantShop';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatOrderTime, formatWaitLabel, minutesSince } from '@/utils/datetime';
import { formatPrice } from '@/data/businesses';
import { orderStatusConfig, theme } from '@/constants/theme';
import {
  getValidStaffSession,
  staffCan,
  StaffSession,
} from '@/utils/merchantTeam';
import { StaffPunchGate } from '@/components/StaffPunchGate';
import { Order } from '@/types';

const ACCENT = '#C2410C';
const KITCHEN_STATUSES = new Set(['confirmado', 'preparando']);
/** Depois disso, o tempo na fila fica vermelho. */
const WAIT_WARN_MIN = 12;

export default function KitchenPanelScreen() {
  const { user } = useAuth();
  const { orders, markOrderPreparing, markOrderKitchenReady } = useOrders();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<StaffSession | null>(null);
  const [shop, setShop] = useState<MerchantShop | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    const found = (await resolveOperatorMerchantContext(user?.email)).shop;
    const sess = await getValidStaffSession();
    const punched =
      !!found &&
      !!sess &&
      sess.role === 'kitchen' &&
      sess.businessId === found.businessId;
    setShop(found);
    setSession(punched ? sess : null);
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

  const queue = useMemo(() => {
    if (!shop) return [];
    return orders
      .filter((o) => o.businessId === shop.businessId && KITCHEN_STATUSES.has(o.status))
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  }, [orders, shop]);

  function openOrder(id: string) {
    router.push({ pathname: '/merchant/order/[id]' as any, params: { id } });
  }

  function acceptOrder(order: Order) {
    const res = markOrderPreparing(order.id);
    if (!res.ok) Alert.alert('Preparar', res.error);
  }

  function markReady(order: Order) {
    const res = markOrderKitchenReady(order.id);
    if (!res.ok) Alert.alert('Pronto', res.error);
  }

  function nextStep(order: Order) {
    if (order.status === 'confirmado') {
      acceptOrder(order);
      return;
    }
    if (order.status === 'preparando' && !order.kitchenReadyAt) {
      markReady(order);
      return;
    }
    openOrder(order.id);
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
        <BackHeader title="Cozinha" fallbackHref="/merchant/advanced" />
        <View style={styles.emptyBox}>
          <Ionicons name="storefront-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Sem loja liberada</Text>
          <Text style={styles.emptyText}>
            Peça acesso à equipe e aguarde o dono aprovar. Depois entre com seu e-mail e PIN.
          </Text>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => router.push('/merchant/staff/request-access' as any)}
          >
            <Text style={styles.acceptBtnText}>Pedir acesso</Text>
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
        role="kitchen"
        accent={ACCENT}
        onPunched={(s) => setSession(s)}
      />
    );
  }

  const hasChat = staffCan(session.role, 'chat');
  const hasOrdersList = staffCan(session.role, 'orders');

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Cozinha" fallbackHref="/merchant/advanced" />
      <StaffPanelHeader
        shopName={shop.name}
        operatorName={session.name}
        role="kitchen"
        title="Fila da cozinha"
        subtitle={`${queue.length} pedido(s) na fila`}
        accent={ACCENT}
      />

      <View style={styles.quickRow}>
        {hasOrdersList ? (
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/merchant/orders' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="list" size={16} color={ACCENT} />
            <Text style={styles.quickBtnText}>Pedidos lista</Text>
          </TouchableOpacity>
        ) : null}
        {hasChat ? (
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/merchant/chat' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubbles" size={16} color={ACCENT} />
            <Text style={styles.quickBtnText}>Chat</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyQueue}>
            <View style={styles.emptyQueueIcon}>
              <Ionicons name="flame-outline" size={30} color={ACCENT} />
            </View>
            <Text style={styles.emptyQueueTitle}>Fila vazia</Text>
            <Text style={styles.emptyQueueText}>
              Assim que um pedido for pago, ele aparece aqui na ordem de chegada.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const cfg = orderStatusConfig[item.status] ?? orderStatusConfig.confirmado;
          const itemCount = item.items.reduce((s, l) => s + l.quantity, 0);
          const ready = item.status === 'preparando' && !!item.kitchenReadyAt;
          const waitMins = minutesSince(item.createdAt, nowMs);
          const waitHot = waitMins >= WAIT_WARN_MIN;
          const waitLabel = formatWaitLabel(item.createdAt, nowMs);
          const nextLabel =
            item.status === 'confirmado'
              ? 'Iniciar preparo'
              : ready
                ? 'Ver pedido'
                : 'Marcar pronto';
          return (
            <TouchableOpacity
              style={[
                styles.ticket,
                index === 0 && styles.ticketNext,
                waitHot && styles.ticketHot,
              ]}
              onPress={() => openOrder(item.id)}
              activeOpacity={0.88}
            >
              <View style={styles.ticketPos}>
                <Text style={[styles.ticketPosNum, index === 0 && styles.ticketPosNumNext]}>
                  {index + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.ticketTop}>
                  <Text style={styles.ticketCode}>{merchantOrderLabel(item)}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: (ready ? theme.colors.primary : cfg.color) + '22' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: ready ? theme.colors.primary : cfg.color },
                      ]}
                    >
                      {ready ? 'Pronto' : cfg.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.ticketMeta}>
                  Feito às {formatOrderTime(item.createdAt)} ·{' '}
                  <Text style={waitHot ? styles.waitHot : undefined}>{waitLabel}</Text>
                  {waitHot ? ' ⚠' : ''} · {itemCount} item{itemCount !== 1 ? 's' : ''} ·{' '}
                  {formatPrice(item.total)}
                </Text>
                <TouchableOpacity
                  style={[styles.acceptBtn, ready && styles.acceptBtnReady]}
                  onPress={() => nextStep(item)}
                  hitSlop={6}
                >
                  <Ionicons
                    name={
                      item.status === 'confirmado'
                        ? 'flame'
                        : ready
                          ? 'eye'
                          : 'checkmark-circle'
                    }
                    size={13}
                    color="#fff"
                  />
                  <Text style={styles.acceptBtnText}>{nextLabel}</Text>
                </TouchableOpacity>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          );
        }}
      />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF7ED' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyText: { textAlign: 'center', color: theme.colors.textSecondary, lineHeight: 20 },

  quickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FDBA9422',
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  quickBtnText: { fontSize: 12, fontWeight: theme.fontWeight.bold, color: ACCENT },

  list: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyQueue: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 24 },
  emptyQueueIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyQueueTitle: { fontSize: 17, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyQueueText: { textAlign: 'center', color: theme.colors.textSecondary, lineHeight: 20 },

  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDBA9433',
  },
  ticketNext: { borderColor: ACCENT, borderWidth: 1.5, backgroundColor: '#FFF1E6' },
  ticketHot: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  ticketPos: { width: 28, alignItems: 'center' },
  ticketPosNum: { fontSize: 17, fontWeight: theme.fontWeight.extrabold, color: theme.colors.textMuted },
  ticketPosNumNext: { color: ACCENT },
  ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ticketCode: { fontSize: 15, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  ticketMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  waitHot: { color: '#DC2626', fontWeight: theme.fontWeight.bold },
  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: theme.fontWeight.bold },
  acceptBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
  },
  acceptBtnReady: { backgroundColor: theme.colors.primary },
  acceptBtnText: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: 12 },
});
