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
import { KeyboardAvoid } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useOrders } from '@/context/OrdersContext';
import { getBusinessById, formatPrice } from '@/data/businesses';
import { getShopByBusinessId } from '@/utils/merchantShop';
import { MenuItem } from '@/types';
import { theme } from '@/constants/theme';

/**
 * Loja marca item em falta e, se quiser, sugere outro do cardápio.
 */
export default function FlagMissingScreen() {
  const { orderId, lineId } = useLocalSearchParams<{ orderId: string; lineId: string }>();
  const { getOrder, flagOrderLineUnavailable } = useOrders();
  const order = getOrder(orderId || '');
  const line = order?.items.find((l) => l.lineId === lineId);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!order) return;
        const shop = await getShopByBusinessId(order.businessId);
        const biz = getBusinessById(order.businessId);
        const list = (shop?.menu?.length ? shop.menu : biz?.menu ?? []).filter(
          (m) => m.available !== false && m.id !== line?.item.id
        );
        if (!cancelled) setMenu(list);
      })();
      return () => {
        cancelled = true;
      };
    }, [order, line?.item.id])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menu;
    return menu.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
    );
  }, [menu, query]);

  if (!order || !line) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Item em falta" fallbackHref="/merchant/orders" />
        <View style={styles.center}>
          <Text style={styles.muted}>Pedido ou item não encontrado.</Text>
        </View>
      </MobileShell>
    );
  }

  async function confirm(withSuggestion: boolean) {
    setBusy(true);
    try {
      const suggestion =
        withSuggestion && selected
          ? {
              itemId: selected.id,
              name: selected.name,
              image: selected.image,
              price: selected.promo ?? selected.price,
            }
          : null;
      const res = flagOrderLineUnavailable(
        order!.id,
        line!.lineId,
        'Item em falta no estoque',
        suggestion
      );
      if (!res.ok) {
        Alert.alert('Não foi possível', res.error);
        return;
      }
      Alert.alert(
        'Cliente avisado',
        suggestion
          ? `Avisamos a falta de “${line!.item.name}” e sugerimos “${suggestion.name}”.`
          : `Avisamos a falta de “${line!.item.name}”. O cliente pode escolher outro no cardápio.`,
        [{ text: 'OK', onPress: () => router.replace(`/merchant/order/${order!.id}` as any) }]
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader
        title="Item em falta"
        fallbackHref={`/merchant/order/${order.id}` as any}
      />

      <KeyboardAvoid>
      <View style={styles.banner}>
        <Ionicons name="alert-circle" size={22} color="#B45309" />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{line.item.name}</Text>
          <Text style={styles.bannerText}>
            Opcional: escolha um item do cardápio para sugerir ao cliente. Assim o pedido não
            fica parado.
          </Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar sugestão no cardápio…"
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum outro item no cardápio.</Text>
        }
        renderItem={({ item }) => {
          const on = selected?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.card, on && styles.cardOn]}
              activeOpacity={0.85}
              onPress={() => setSelected(on ? null : item)}
            >
              <Image source={{ uri: item.image }} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.price}>{formatPrice(item.promo ?? item.price)}</Text>
              </View>
              <Ionicons
                name={on ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={on ? theme.colors.primary : theme.colors.textMuted}
              />
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        {selected ? (
          <TouchableOpacity
            style={[styles.btnPrimary, busy && styles.btnOff]}
            disabled={busy}
            onPress={() => void confirm(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>
              Avisar e sugerir “{selected.name}”
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.btnSecondary, busy && styles.btnOff]}
          disabled={busy}
          onPress={() => void confirm(false)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>
            {selected ? 'Avisar sem sugestão' : 'Avisar só a falta'}
          </Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoid>
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
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  bannerTitle: { fontWeight: '800', color: '#92400E', fontSize: 15 },
  bannerText: { color: '#92400E', fontSize: 12, marginTop: 4, lineHeight: 17 },
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
  list: { padding: 16, paddingTop: 4, paddingBottom: 120, gap: 8 },
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
  cardOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.borderLight,
  },
  name: { fontWeight: '700', color: theme.colors.text, fontSize: 14 },
  price: { marginTop: 4, fontWeight: '700', color: theme.colors.primary, fontSize: 13 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    gap: 8,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  btnSecondary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  btnSecondaryText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  btnOff: { opacity: 0.5 },
});
