import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { AddonPickerModal } from '@/components/AddonPickerModal';
import { useOrders } from '@/context/OrdersContext';
import { getBusinessById, formatPrice } from '@/data/businesses';
import { getShopByBusinessId } from '@/utils/merchantShop';
import { makeLineId } from '@/utils/cartLine';
import { getLineIssue } from '@/utils/orderLineIssues';
import { CartItem, MenuItem, SelectedAddon } from '@/types';
import { theme } from '@/constants/theme';

export default function ReplaceOrderItemScreen() {
  const { orderId, lineId } = useLocalSearchParams<{ orderId: string; lineId: string }>();
  const { getOrder, replaceOrderLine } = useOrders();
  const order = getOrder(orderId || '');
  const issue = order ? getLineIssue(order, lineId || '') : undefined;
  const oldLine = order?.items.find((l) => l.lineId === lineId);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState<MenuItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!order) return;
        const shop = await getShopByBusinessId(order.businessId);
        const biz = getBusinessById(order.businessId);
        const list = (shop?.menu?.length ? shop.menu : biz?.menu ?? []).filter(
          (m) => m.available !== false
        );
        if (!cancelled) setMenu(list);
      })();
      return () => {
        cancelled = true;
      };
    }, [order])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = menu;
    if (q) {
      list = menu.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    if (issue?.suggestedItemId) {
      const suggested = list.find((m) => m.id === issue.suggestedItemId);
      const rest = list.filter((m) => m.id !== issue.suggestedItemId);
      if (suggested) return [suggested, ...rest];
    }
    return list;
  }, [menu, query, issue?.suggestedItemId]);

  if (!order || !issue || !oldLine) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Trocar item" fallbackHref="/(tabs)/orders" preferFallback variant="brand" />
        <View style={styles.center}>
          <Text style={styles.muted}>
            {!order
              ? 'Pedido não encontrado.'
              : 'Este item não está mais aguardando troca.'}
          </Text>
        </View>
      </MobileShell>
    );
  }

  function confirmPick(addons: SelectedAddon[], note: string) {
    if (!picking || !order || !oldLine) return;
    const newLine: CartItem = {
      lineId: makeLineId(picking.id, addons, note),
      item: picking,
      quantity: oldLine.quantity,
      businessId: order.businessId,
      businessName: order.businessName,
      selectedAddons: addons,
      note: note.trim() || undefined,
    };
    const res = replaceOrderLine(order.id, oldLine.lineId, newLine);
    setPicking(null);
    if (!res.ok) {
      Alert.alert('Troca', res.error);
      return;
    }
    Alert.alert(
      'Item trocado',
      `“${issue!.itemName}” foi substituído por “${picking.name}”. A loja já foi avisada no chat.`,
      [{ text: 'OK', onPress: () => router.replace(`/order/${order.id}` as any) }]
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader
        title="Trocar item"
        fallbackHref={`/order/${order.id}` as any}
        preferFallback
      />

      <View style={styles.banner}>
        <Ionicons name="swap-horizontal" size={20} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Em falta: {issue.itemName}</Text>
          <Text style={styles.bannerText}>
            Escolha outro item do cardápio de {order.businessName}. Quantidade:{' '}
            {oldLine.quantity}× · {issue.reason}
          </Text>
          {issue.suggestedItemName ? (
            <Text style={styles.bannerSuggest}>
              Sugestão da loja: {issue.suggestedItemName}
              {issue.suggestedItemPrice != null
                ? ` · ${formatPrice(issue.suggestedItemPrice)}`
                : ''}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar no cardápio…"
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum item encontrado no cardápio.</Text>
        }
        renderItem={({ item }) => {
          const suggested = issue?.suggestedItemId === item.id;
          return (
          <TouchableOpacity
            style={[styles.card, suggested && styles.cardSuggested]}
            activeOpacity={0.85}
            onPress={() => setPicking(item)}
          >
            <Image source={{ uri: item.image }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              {suggested ? (
                <Text style={styles.suggestBadge}>Sugestão da loja</Text>
              ) : null}
              <Text style={styles.name} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.cat}>{item.category}</Text>
              <Text style={styles.price}>
                {formatPrice(item.promo ?? item.price)}
                {item.promo != null ? (
                  <Text style={styles.old}> {formatPrice(item.price)}</Text>
                ) : null}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
          );
        }}
      />

      <AddonPickerModal
        visible={!!picking}
        item={picking}
        onClose={() => setPicking(null)}
        onConfirm={confirmPick}
      />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: theme.colors.textMuted, textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  bannerTitle: { fontWeight: '800', color: '#92400E', fontSize: 14 },
  bannerText: { color: '#92400E', fontSize: 12, marginTop: 2, lineHeight: 17 },
  bannerSuggest: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 15 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 40, gap: 8 },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardSuggested: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  suggestBadge: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: theme.colors.borderLight,
  },
  name: { fontWeight: '700', color: theme.colors.text, fontSize: 14 },
  cat: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  price: {
    marginTop: 4,
    fontWeight: '700',
    color: theme.colors.primary,
    fontSize: 14,
  },
  old: {
    color: theme.colors.textMuted,
    fontWeight: '400',
    textDecorationLine: 'line-through',
    fontSize: 12,
  },
});
