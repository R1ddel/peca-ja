import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { formatPrice } from '@/data/businesses';
import { orderStatusConfig, theme } from '@/constants/theme';
import { Order } from '@/types';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import {
  formatOrderTime,
  formatWaitLabel,
} from '@/utils/datetime';

type Filter = 'ativos' | 'cozinha' | 'rota' | 'todos';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ativos', label: 'Ativos' },
  { id: 'cozinha', label: 'Cozinha' },
  { id: 'rota', label: 'Na rua' },
  { id: 'todos', label: 'Todos' },
];

export default function MerchantOrdersScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [tab, setTab] = useState<Filter>('ativos');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { shop } = await resolveOperatorMerchantContext(user?.email);
    setBusinessId(shop?.businessId ?? null);
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void load();
      setNowMs(Date.now());
      const tick = setInterval(() => setNowMs(Date.now()), 30000);
      return () => clearInterval(tick);
    }, [load])
  );

  const mine = useMemo(() => {
    if (!businessId) return [];
    return orders
      .filter((o) => o.businessId === businessId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [orders, businessId]);

  const list = useMemo(() => {
    let rows = mine;
    if (tab === 'ativos') {
      rows = rows.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado');
    } else if (tab === 'cozinha') {
      rows = rows.filter((o) => o.status === 'confirmado' || o.status === 'preparando');
    } else if (tab === 'rota') {
      rows = rows.filter((o) => o.status === 'saiu_entrega');
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter(
        (o) =>
          o.id.toLowerCase().includes(needle) ||
          o.address.toLowerCase().includes(needle) ||
          o.items.some((i) => i.item.name.toLowerCase().includes(needle))
      );
    }
    return rows;
  }, [mine, tab, q]);

  const kitchen = mine.filter((o) => o.status === 'confirmado' || o.status === 'preparando')
    .length;

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Pedidos" fallbackHref="/merchant" />

      <LinearGradient colors={['#1E3A2F', '#007A4D']} style={styles.banner}>
        <View>
          <Text style={styles.bannerLabel}>Fila ao vivo</Text>
          <Text style={styles.bannerValue}>
            {kitchen} na cozinha · {mine.filter((o) => o.status === 'saiu_entrega').length} na rua
          </Text>
        </View>
        <TouchableOpacity
          style={styles.bannerBtn}
          onPress={() => router.push('/merchant/pickup' as any)}
        >
          <Ionicons name="keypad" size={16} color={theme.colors.secondary} />
          <Text style={styles.bannerBtnText}>Retirada</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por código, endereço ou item"
          placeholderTextColor={theme.colors.textMuted}
        />
      </View>

      <View style={styles.tabs}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.tab, tab === f.id && styles.tabOn]}
            onPress={() => setTab(f.id)}
          >
            <Text style={[styles.tabText, tab === f.id && styles.tabTextOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nada por aqui</Text>
            <Text style={styles.emptyText}>
              Pedidos pagos da sua loja aparecem nesta fila em tempo real.
            </Text>
          </View>
        }
        renderItem={({ item }) => <OrderCard order={item} nowMs={nowMs} />}
      />
    </MobileShell>
  );
}

function OrderCard({ order, nowMs }: { order: Order; nowMs: number }) {
  const { markOrderPreparing, markOrderKitchenReady } = useOrders();
  const cfg = orderStatusConfig[order.status];
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const urgent = order.status === 'confirmado' || order.status === 'preparando';
  const ready = !!order.kitchenReadyAt && order.status === 'preparando';
  const statusText = ready ? 'Pronto p/ retirada' : cfg.label;

  function quickAccept() {
    const res = markOrderPreparing(order.id);
    if (!res.ok) {
      Alert.alert('Preparar', res.error);
    }
  }

  function quickReady() {
    const res = markOrderKitchenReady(order.id);
    if (!res.ok) {
      Alert.alert('Pronto', res.error);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.card, urgent && styles.cardUrgent, ready && styles.cardReady]}
      onPress={() =>
        router.push({ pathname: '/merchant/order/[id]' as any, params: { id: order.id } })
      }
      activeOpacity={0.88}
    >
      <View
        style={[styles.accent, { backgroundColor: ready ? theme.colors.primary : cfg.color }]}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.orderId}>{merchantOrderLabel(order)}</Text>
          <View
            style={[
              styles.pill,
              { backgroundColor: (ready ? theme.colors.primary : cfg.color) + '22' },
            ]}
          >
            <Text
              style={[styles.pillText, { color: ready ? theme.colors.primary : cfg.color }]}
            >
              {statusText}
            </Text>
          </View>
        </View>
        <Text style={styles.meta}>
          Feito às {formatOrderTime(order.createdAt)} · {formatWaitLabel(order.createdAt, nowMs)} ·{' '}
          {itemCount} item{itemCount !== 1 ? 's' : ''} · {formatPrice(order.total)}
        </Text>
        <Text style={styles.addr} numberOfLines={1}>
          {order.address}
        </Text>
        <View style={styles.preview}>
          {order.items.slice(0, 4).map((line) => (
            <Text key={line.lineId} style={styles.previewItem} numberOfLines={1}>
              {line.quantity}× {line.item.name}
              {line.note ? ' · obs' : ''}
            </Text>
          ))}
          {order.items.length > 4 && (
            <Text style={styles.previewItem}>+{order.items.length - 4} itens</Text>
          )}
        </View>

        {order.status === 'confirmado' && (
          <TouchableOpacity style={styles.quickBtn} onPress={quickAccept}>
            <Ionicons name="flame" size={14} color="#fff" />
            <Text style={styles.quickBtnText}>Aceitar preparo</Text>
          </TouchableOpacity>
        )}
        {order.status === 'preparando' && !order.kitchenReadyAt && (
          <TouchableOpacity style={[styles.quickBtn, styles.quickBtnReady]} onPress={quickReady}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.quickBtnText}>Pronto p/ retirada</Text>
          </TouchableOpacity>
        )}
        {ready && (
          <View style={styles.readyBlock}>
            <Text style={styles.hintReady}>
              {order.driverName
                ? `Aguardando código de ${order.driverName}`
                : 'Aguardando código do entregador'}
            </Text>
            <Text style={styles.readyItems} numberOfLines={2}>
              {order.items
                .slice(0, 3)
                .map((l) => `${l.quantity}× ${l.item.name}`)
                .join(' · ')}
            </Text>
            <TouchableOpacity
              style={styles.pickupCta}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push({
                  pathname: '/merchant/pickup' as any,
                  params: { orderId: order.id },
                });
              }}
            >
              <Ionicons name="keypad" size={14} color="#fff" />
              <Text style={styles.quickBtnText}>Digitar código · {merchantOrderLabel(order)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  banner: {
    marginHorizontal: theme.spacing.md,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  bannerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: theme.fontWeight.bold },
  bannerValue: { color: '#fff', fontWeight: theme.fontWeight.bold, marginTop: 2, fontSize: 14 },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
  bannerBtnText: { fontWeight: theme.fontWeight.bold, color: theme.colors.secondary, fontSize: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: 10,
  },
  search: { flex: 1, paddingVertical: 12, color: theme.colors.text, fontSize: 14 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    gap: 6,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  tabOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { fontSize: 11, fontWeight: theme.fontWeight.semibold, color: theme.colors.textMuted },
  tabTextOn: { color: '#fff' },
  list: { padding: theme.spacing.md, paddingTop: 4, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    overflow: 'hidden',
    paddingRight: 10,
  },
  cardUrgent: { borderColor: '#FFB80066' },
  cardReady: { borderColor: theme.colors.primary + '66' },
  accent: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 14, paddingLeft: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontWeight: theme.fontWeight.extrabold, color: theme.colors.text, fontSize: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  pillText: { fontSize: 11, fontWeight: theme.fontWeight.bold },
  meta: { marginTop: 6, color: theme.colors.text, fontWeight: theme.fontWeight.semibold, fontSize: 13 },
  addr: { marginTop: 4, color: theme.colors.textSecondary, fontSize: 12 },
  preview: { marginTop: 8, gap: 2 },
  previewItem: { fontSize: 12, color: theme.colors.textMuted },
  quickBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
  quickBtnReady: {
    backgroundColor: '#059669',
  },
  quickBtnText: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: 12 },
  hint: { marginTop: 8, fontSize: 11, color: theme.colors.textMuted },
  hintReady: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  readyBlock: { marginTop: 8, gap: 6 },
  readyItems: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 16 },
  pickupCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
});
