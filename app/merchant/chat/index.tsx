import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveMerchantApplication } from '@/utils/partners';
import { getShopByApplicationId } from '@/utils/merchantShop';
import { listMerchantThreads, MerchantThread } from '@/services/orderChat';
import { theme } from '@/constants/theme';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';

type FilterTab = 'active' | 'history' | 'all';

function senderPreview(msg: NonNullable<MerchantThread['lastMessage']>) {
  if (msg.sender === 'merchant') return `Você: ${msg.text}`;
  if (msg.sender === 'customer') return `Cliente: ${msg.text}`;
  if (msg.sender === 'driver') return `Motoboy: ${msg.text}`;
  return msg.text;
}

function statusLabel(status: string) {
  if (status === 'entregue') return 'Entregue';
  if (status === 'cancelado') return 'Cancelado';
  return 'Em andamento';
}

export default function MerchantChatInboxScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [threads, setThreads] = useState<MerchantThread[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('active');

  const mine = useMemo(() => {
    if (!businessId) return [];
    return orders.filter((o) => o.businessId === businessId);
  }, [orders, businessId]);

  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  const load = useCallback(async () => {
    const app = await resolveMerchantApplication(user?.email);
    if (!app) {
      setBusinessId(null);
      setThreads([]);
      return;
    }
    const shop = await getShopByApplicationId(app.id);
    const bid = shop?.businessId ?? null;
    setBusinessId(bid);
    const shopOrders = bid ? orders.filter((o) => o.businessId === bid) : [];
    setThreads(await listMerchantThreads(shopOrders, { includeHistory: true }));
  }, [user?.email, orders]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    if (filter === 'active') return threads.filter((t) => t.active);
    if (filter === 'history') return threads.filter((t) => !t.active);
    return threads;
  }, [threads, filter]);

  const counts = useMemo(
    () => ({
      active: threads.filter((t) => t.active).length,
      history: threads.filter((t) => !t.active).length,
      unread: threads.filter((t) => t.unreadHint).length,
    }),
    [threads]
  );

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Conversas" fallbackHref="/merchant" />

      <LinearGradient colors={['#1E3A2F', '#007A4D']} style={styles.hero}>
        <Ionicons name="chatbubbles" size={28} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Central de chats</Text>
          <Text style={styles.heroSub}>
            Cliente e motoboy — conversas salvas para o dono acompanhar tudo
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
        {(
          [
            { id: 'active' as const, label: 'Ativos', count: counts.active },
            { id: 'history' as const, label: 'Histórico', count: counts.history },
            { id: 'all' as const, label: 'Todos', count: threads.length },
          ] as const
        ).map((tab) => {
          const on = filter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, on && styles.tabOn]}
              onPress={() => setFilter(tab.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {tab.label}
                {tab.count > 0 ? ` · ${tab.count}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {counts.unread > 0 ? (
        <View style={styles.unreadBar}>
          <Ionicons name="mail-unread" size={14} color={theme.colors.primary} />
          <Text style={styles.unreadBarText}>
            {counts.unread} conversa{counts.unread > 1 ? 's' : ''} com mensagem nova
          </Text>
        </View>
      ) : null}

      <View style={styles.legend}>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: theme.colors.accent }]} />
          <Text style={styles.legText}>Cliente</Text>
        </View>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: '#8B5CF6' }]} />
          <Text style={styles.legText}>Motoboy</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.orderId}:${item.peer}`}
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
            <Ionicons name="chatbubble-ellipses-outline" size={40} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>
              {filter === 'history'
                ? 'Nenhum histórico ainda'
                : filter === 'all'
                  ? 'Nenhuma conversa'
                  : 'Nenhuma conversa ativa'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'history'
                ? 'Quando pedidos forem concluídos, os chats com cliente e entregador ficam salvos aqui para auditoria.'
                : 'Quando houver pedidos em andamento, os chats com cliente e entregador aparecem aqui. Você também pode abrir pelo detalhe do pedido.'}
            </Text>
            {mine.some((o) => o.status !== 'entregue' && o.status !== 'cancelado') ? (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/merchant/orders' as any)}
              >
                <Text style={styles.emptyBtnText}>Ver pedidos</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isDriver = item.peerKind === 'driver';
          return (
            <TouchableOpacity
              style={[styles.card, item.unreadHint && styles.cardUnread]}
              activeOpacity={0.88}
              onPress={() =>
                router.push({
                  pathname: '/merchant/chat/[orderId]' as any,
                  params: { orderId: item.orderId, peer: item.peer },
                })
              }
            >
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: isDriver
                      ? '#8B5CF622'
                      : theme.colors.accentSoft,
                  },
                ]}
              >
                <Ionicons
                  name={isDriver ? 'bicycle' : 'person'}
                  size={20}
                  color={isDriver ? '#8B5CF6' : theme.colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.peerLabel}
                  </Text>
                  <Text style={styles.orderTag}>
                    {(() => {
                      const o = orderById.get(item.orderId);
                      return o
                        ? merchantOrderLabel(o)
                        : `#${item.orderId.slice(-6).toUpperCase()}`;
                    })()}
                  </Text>
                </View>
                <Text style={styles.kind}>
                  {isDriver ? 'Motoboy · retirada/entrega' : 'Cliente · pedido'}
                  {' · '}
                  {statusLabel(item.orderStatus)}
                </Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.lastMessage
                    ? senderPreview(item.lastMessage)
                    : 'Toque para iniciar a conversa'}
                </Text>
              </View>
              {item.unreadHint ? <View style={styles.badge} /> : null}
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          );
        }}
      />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  hero: {
    marginHorizontal: theme.spacing.md,
    borderRadius: 20,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  heroTitle: { color: '#fff', fontWeight: theme.fontWeight.extrabold, fontSize: 17 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
  },
  tabOn: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary + '55',
  },
  tabText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
  },
  tabTextOn: { color: theme.colors.primary },
  unreadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: theme.spacing.md,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
  },
  unreadBarText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: theme.spacing.md,
    marginBottom: 8,
  },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: theme.fontWeight.semibold },
  list: { padding: theme.spacing.md, paddingTop: 4, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
  },
  emptyBtnText: { color: '#fff', fontWeight: theme.fontWeight.bold },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardUnread: { borderColor: theme.colors.primary + '66' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontWeight: theme.fontWeight.bold, color: theme.colors.text, fontSize: 15 },
  orderTag: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  kind: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  preview: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  badge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
});
