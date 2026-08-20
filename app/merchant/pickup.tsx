import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { KeyboardAvoid } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { formatPrice } from '@/data/businesses';
import { theme } from '@/constants/theme';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatOrderTime, formatWaitLabel } from '@/utils/datetime';
import { normalizeCodeInput } from '@/utils/orderCodes';
import type { Order } from '@/types';

function itemsPreview(order: Order, max = 3): string {
  const parts = order.items.slice(0, max).map((l) => `${l.quantity}× ${l.item.name}`);
  const extra = order.items.length - max;
  return extra > 0 ? `${parts.join(' · ')} · +${extra}` : parts.join(' · ');
}

function sortReady(a: Order, b: Order): number {
  const aDriver = a.driverId ? 0 : 1;
  const bDriver = b.driverId ? 0 : 1;
  if (aDriver !== bDriver) return aDriver - bDriver;
  return +new Date(a.kitchenReadyAt || a.createdAt) - +new Date(b.kitchenReadyAt || b.createdAt);
}

export default function MerchantPickupScreen() {
  const { user } = useAuth();
  const { orders, confirmPickupByCode } = useOrders();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const preselectDone = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const { shop } = await resolveOperatorMerchantContext(user?.email);
        setBusinessId(shop?.businessId ?? null);
      })();
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }, [user?.email])
  );

  const ready = useMemo(() => {
    if (!businessId) return [];
    return orders
      .filter(
        (o) =>
          o.businessId === businessId &&
          o.status === 'preparando' &&
          !o.pickupVerifiedAt &&
          !!o.kitchenReadyAt
      )
      .sort(sortReady);
  }, [orders, businessId]);

  useEffect(() => {
    if (preselectDone.current) return;
    const want = typeof params.orderId === 'string' ? params.orderId : null;
    if (!want || ready.length === 0) return;
    if (ready.some((o) => o.id === want)) {
      setSelectedId(want);
      preselectDone.current = true;
    }
  }, [params.orderId, ready]);

  const typed = normalizeCodeInput(code);

  const matchedByCode = useMemo(() => {
    if (typed.length !== 4) return null;
    return ready.find((o) => o.pickupCode === typed) ?? null;
  }, [ready, typed]);

  const codeMismatch =
    typed.length === 4 && !matchedByCode
      ? selectedId
        ? 'Código não bate com o pedido selecionado (nem com outro da fila).'
        : 'Nenhum pedido pronto com este código. Confira com o motoboy.'
      : null;

  const activeOrder = matchedByCode || ready.find((o) => o.id === selectedId) || null;

  useEffect(() => {
    if (matchedByCode) setSelectedId(matchedByCode.id);
  }, [matchedByCode?.id]);

  function confirm() {
    const target = matchedByCode || (selectedId ? ready.find((o) => o.id === selectedId) : null);
    if (!target) {
      Alert.alert(
        'Pedido',
        typed.length === 4
          ? 'Digite o código que o motoboy mostrar — o pedido aparece sozinho.'
          : 'Selecione o pedido na lista ou digite o código de 4 dígitos.'
      );
      return;
    }
    setBusy(true);
    const res = confirmPickupByCode(target.id, code);
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Código', res.error);
      return;
    }
    const label = merchantOrderLabel(target);
    setCode('');
    setSelectedId(null);
    Alert.alert('Retirada ok', `${label} liberado · ${target.driverName || 'Motoboy'} a caminho.`);
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Código de retirada" fallbackHref="/merchant" />
      <KeyboardAvoid>
        <FlatList
          data={ready}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <View>
              <View style={styles.hero}>
                <View style={styles.heroIcon}>
                  <Ionicons name="keypad" size={26} color="#fff" />
                </View>
                <Text style={styles.heroTitle}>Liberar pedido</Text>
                <Text style={styles.heroSub}>
                  Peça ao motoboy o código de 4 dígitos. Ao digitar, o pedido certo aparece
                  sozinho — com número, entregador e itens.
                </Text>
                <View style={styles.heroBadge}>
                  <View style={styles.pulse} />
                  <Text style={styles.heroBadgeText}>
                    {ready.length === 0
                      ? 'Nada aguardando'
                      : ready.length === 1
                        ? '1 pedido pronto'
                        : `${ready.length} pedidos prontos`}
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Código do motoboy</Text>
              <TextInput
                ref={inputRef}
                style={[
                  styles.codeInput,
                  matchedByCode && styles.codeInputOk,
                  !!codeMismatch && styles.codeInputBad,
                ]}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                placeholder="····"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={4}
                autoFocus
              />

              {matchedByCode ? (
                <View style={styles.matchCard}>
                  <View style={styles.matchTop}>
                    <Text style={styles.matchNum}>{merchantOrderLabel(matchedByCode)}</Text>
                    <View style={styles.matchOkPill}>
                      <Ionicons name="checkmark-circle" size={14} color="#047857" />
                      <Text style={styles.matchOkText}>Código bateu</Text>
                    </View>
                  </View>
                  <Text style={styles.matchDriver}>
                    Motoboy: {matchedByCode.driverName || 'Aguardando nome'}
                    {matchedByCode.driverPhone ? ` · ${matchedByCode.driverPhone}` : ''}
                  </Text>
                  <Text style={styles.matchItems} numberOfLines={2}>
                    {itemsPreview(matchedByCode, 4)}
                  </Text>
                  <Text style={styles.matchMeta}>
                    {formatPrice(matchedByCode.total)} · feito às{' '}
                    {formatOrderTime(matchedByCode.createdAt)}
                  </Text>
                </View>
              ) : activeOrder && typed.length < 4 ? (
                <View style={styles.hintSelect}>
                  <Text style={styles.hintSelectTitle}>
                    Selecionado: {merchantOrderLabel(activeOrder)}
                  </Text>
                  <Text style={styles.hintSelectSub}>
                    {activeOrder.driverName
                      ? `Confira se é ${activeOrder.driverName} e digite o código dele.`
                      : 'Digite o código que o motoboy mostrar na tela dele.'}
                  </Text>
                </View>
              ) : null}

              {codeMismatch ? (
                <Text style={styles.mismatch}>{codeMismatch}</Text>
              ) : null}

              <Button
                title={
                  matchedByCode
                    ? `Confirmar · liberar ${merchantOrderLabel(matchedByCode)}`
                    : 'Confirmar retirada'
                }
                onPress={confirm}
                loading={busy}
                disabled={typed.length !== 4 || (!matchedByCode && !selectedId)}
                size="lg"
                style={{ marginBottom: theme.spacing.md }}
              />

              <Text style={styles.listTitle}>
                Fila pronta — toque se quiser escolher antes do código
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle" size={36} color={theme.colors.primary} />
              <Text style={styles.empty}>
                Nenhum pedido marcado como “pronto p/ retirada” ainda.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const on = selectedId === item.id || matchedByCode?.id === item.id;
            const hasDriver = !!item.driverId;
            return (
              <TouchableOpacity
                style={[styles.card, on && styles.cardOn, !hasDriver && styles.cardWait]}
                onPress={() => {
                  setSelectedId(item.id);
                  if (matchedByCode && matchedByCode.id !== item.id) setCode('');
                }}
                activeOpacity={0.88}
              >
                <View style={styles.cardRank}>
                  <Text style={styles.cardRankNum}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{merchantOrderLabel(item)}</Text>
                    <View
                      style={[
                        styles.driverPill,
                        { backgroundColor: hasDriver ? '#D1FAE5' : '#FEF3C7' },
                      ]}
                    >
                      <Ionicons
                        name={hasDriver ? 'bicycle' : 'time-outline'}
                        size={12}
                        color={hasDriver ? '#047857' : '#B45309'}
                      />
                      <Text
                        style={[
                          styles.driverPillText,
                          { color: hasDriver ? '#047857' : '#B45309' },
                        ]}
                        numberOfLines={1}
                      >
                        {hasDriver ? item.driverName || 'Motoboy' : 'Sem motoboy'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardItems} numberOfLines={2}>
                    {itemsPreview(item)}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {formatOrderTime(item.createdAt)} · {formatWaitLabel(item.createdAt)} ·{' '}
                    {formatPrice(item.total)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.detailBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/merchant/order/[id]' as any,
                      params: { id: item.id },
                    })
                  }
                  hitSlop={8}
                >
                  <Ionicons name="open-outline" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      </KeyboardAvoid>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  list: { padding: theme.spacing.md, paddingBottom: 48 },
  hero: {
    borderRadius: 20,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: '#5B21B6',
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: theme.fontWeight.extrabold,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  heroBadge: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFB800',
  },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: theme.fontWeight.semibold },
  fieldLabel: {
    fontSize: 13,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#7C3AED',
    padding: 16,
    fontSize: 40,
    letterSpacing: 14,
    textAlign: 'center',
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  codeInputOk: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  codeInputBad: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  matchCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    padding: 14,
    marginBottom: theme.spacing.sm,
    gap: 4,
  },
  matchTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  matchNum: {
    fontSize: 28,
    fontWeight: theme.fontWeight.extrabold,
    color: '#065F46',
  },
  matchOkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  matchOkText: { fontSize: 11, fontWeight: theme.fontWeight.bold, color: '#047857' },
  matchDriver: {
    fontSize: 15,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  matchItems: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  matchMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  hintSelect: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  hintSelectTitle: { fontWeight: theme.fontWeight.bold, color: '#5B21B6', fontSize: 14 },
  hintSelectSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, lineHeight: 17 },
  mismatch: {
    color: '#B91C1C',
    fontSize: 13,
    marginBottom: theme.spacing.sm,
    lineHeight: 18,
  },
  listTitle: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontSize: 14,
  },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    marginBottom: 8,
  },
  cardOn: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  cardWait: {
    opacity: 0.92,
  },
  cardRank: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRankNum: {
    fontWeight: theme.fontWeight.extrabold,
    color: '#5B21B6',
    fontSize: 15,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    fontSize: 20,
  },
  driverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: '70%',
  },
  driverPillText: { fontSize: 11, fontWeight: theme.fontWeight.bold },
  cardItems: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 17 },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },
  detailBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
  },
});
