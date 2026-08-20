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
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatOrderTime, formatWaitLabel } from '@/utils/datetime';
import { formatPrice } from '@/data/businesses';
import { theme } from '@/constants/theme';
import { getValidStaffSession, staffCan, StaffSession } from '@/utils/merchantTeam';
import { StaffPunchGate } from '@/components/StaffPunchGate';
import { Order } from '@/types';

const ACCENT = '#5B21B6';

export default function CashierPanelScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
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
      sess.role === 'cashier' &&
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

  const myOrders = useMemo(() => {
    if (!shop) return [];
    return orders.filter((o) => o.businessId === shop.businessId);
  }, [orders, shop]);

  const readyForPickup = useMemo(
    () =>
      myOrders
        .filter((o) => o.status === 'preparando' && !!o.kitchenReadyAt && !o.pickupVerifiedAt)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [myOrders]
  );

  const activeOrders = useMemo(
    () => myOrders.filter((o) => o.status !== 'cancelado' && o.status !== 'entregue'),
    [myOrders]
  );

  const activeSummary = useMemo(() => {
    const confirmado = activeOrders.filter((o) => o.status === 'confirmado').length;
    const preparando = activeOrders.filter((o) => o.status === 'preparando').length;
    const saiuEntrega = activeOrders.filter((o) => o.status === 'saiu_entrega').length;
    return { confirmado, preparando, saiuEntrega };
  }, [activeOrders]);

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
        <BackHeader title="Caixa" fallbackHref="/merchant/advanced" />
        <View style={styles.emptyBox}>
          <Ionicons name="storefront-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Sem loja liberada</Text>
          <Text style={styles.emptyText}>
            Peça acesso à equipe e aguarde o dono aprovar. Depois entre no painel do caixa.
          </Text>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/merchant/staff/request-access' as any)}
          >
            <Text style={styles.quickBtnText}>Pedir acesso</Text>
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
        role="cashier"
        accent={ACCENT}
        onPunched={(s) => setSession(s)}
      />
    );
  }

  const hasChat = staffCan(session.role, 'chat');
  const hasOrdersList = staffCan(session.role, 'orders');

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Caixa" fallbackHref="/merchant/advanced" />
      <StaffPanelHeader
        shopName={shop.name}
        operatorName={session.name}
        role="cashier"
        title="Caixa"
        subtitle="Retirada por código"
        accent={ACCENT}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="keypad" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>Caixa · Retirada</Text>
              <Text style={styles.heroValue}>
                {readyForPickup.length} pedido{readyForPickup.length !== 1 ? 's' : ''} pronto
                {readyForPickup.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.heroCta}
            onPress={() => router.push('/merchant/pickup' as any)}
            activeOpacity={0.9}
          >
            <Ionicons name="lock-open" size={16} color={ACCENT} />
            <Text style={styles.heroCtaText}>Liberar retirada</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          {hasOrdersList ? (
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => router.push('/merchant/orders' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="list" size={16} color={ACCENT} />
              <Text style={styles.quickBtnText}>Pedidos</Text>
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
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/merchant/pickup' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="keypad" size={16} color={ACCENT} />
            <Text style={styles.quickBtnText}>Retirada</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Prontos para retirada</Text>
          {readyForPickup.length === 0 ? (
            <View style={styles.emptyReady}>
              <Ionicons name="checkmark-circle-outline" size={26} color={theme.colors.textMuted} />
              <Text style={styles.emptyReadyText}>Nenhum pedido esperando retirada agora.</Text>
            </View>
          ) : (
            readyForPickup.map((order) => (
              <ReadyRow key={order.id} order={order} nowMs={nowMs} onPress={() => openOrder(order.id)} />
            ))
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Pedidos ativos</Text>
          <View style={styles.summaryRow}>
            <SummaryCell label="Confirmados" value={activeSummary.confirmado} />
            <SummaryCell label="Na cozinha" value={activeSummary.preparando} />
            <SummaryCell label="Na rua" value={activeSummary.saiuEntrega} />
          </View>
        </View>
      </ScrollView>
    </MobileShell>
  );
}

function ReadyRow({ order, nowMs, onPress }: { order: Order; nowMs: number; onPress: () => void }) {
  const itemCount = order.items.reduce((s, l) => s + l.quantity, 0);
  return (
    <TouchableOpacity style={styles.readyRow} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.readyDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.readyCode}>{merchantOrderLabel(order)}</Text>
        <Text style={styles.readyMeta}>
          Pronto às {formatOrderTime(order.kitchenReadyAt ?? order.createdAt)} ·{' '}
          {formatWaitLabel(order.kitchenReadyAt ?? order.createdAt, nowMs)} · {itemCount} item
          {itemCount !== 1 ? 's' : ''} · {formatPrice(order.total)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3FF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 60 },
  emptyTitle: { fontSize: 17, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyText: { textAlign: 'center', color: theme.colors.textSecondary, lineHeight: 20 },

  content: { paddingHorizontal: 16, paddingBottom: 40 },

  hero: {
    backgroundColor: ACCENT,
    borderRadius: 22,
    padding: 18,
    marginTop: 4,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: theme.fontWeight.bold },
  heroValue: { color: '#fff', fontSize: 22, fontWeight: theme.fontWeight.extrabold, marginTop: 2 },
  heroCta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: theme.radius.full,
    paddingVertical: 13,
  },
  heroCtaText: { color: ACCENT, fontWeight: theme.fontWeight.extrabold, fontSize: 15 },

  quickRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  quickBtnText: { fontSize: 12, fontWeight: theme.fontWeight.bold, color: ACCENT },

  block: {
    marginTop: 18,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    marginBottom: 10,
  },
  emptyReady: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyReadyText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },

  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderLight,
  },
  readyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  readyCode: { fontSize: 14, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  readyMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },

  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    paddingVertical: 12,
  },
  summaryValue: { fontSize: 18, fontWeight: theme.fontWeight.extrabold, color: ACCENT },
  summaryLabel: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2, textAlign: 'center' },
});
