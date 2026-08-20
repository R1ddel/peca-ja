/**
 * Bloco visual de corridas ativas — painel comércio e entregador.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Order } from '@/types';
import { formatPrice } from '@/data/businesses';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { driverEarningsOf, statusLabelPt } from '@/utils/driverOps';
import { isCustomerLiveMapOrder } from '@/utils/customerLiveMap';
import { theme } from '@/constants/theme';

export function isLiveDeliveryRun(order: Order): boolean {
  return isCustomerLiveMapOrder(order);
}

export function listMerchantActiveRuns(orders: Order[], businessId: string): Order[] {
  return orders
    .filter((o) => o.businessId === businessId && isLiveDeliveryRun(o))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function runPhase(order: Order): {
  key: 'to_shop' | 'to_customer';
  label: string;
  color: string;
  bg: string;
} {
  if (order.pickupVerifiedAt || order.status === 'saiu_entrega') {
    return {
      key: 'to_customer',
      label: 'A caminho do cliente',
      color: '#047857',
      bg: '#D1FAE5',
    };
  }
  return {
    key: 'to_shop',
    label: order.kitchenReadyAt ? 'Motoboy a caminho da loja' : 'Motoboy designado',
    color: '#B45309',
    bg: '#FEF3C7',
  };
}

type Props = {
  variant: 'merchant' | 'driver';
  orders: Order[];
  accent: string;
  onPressOrder: (orderId: string) => void;
  /** Comércio: atalho para digitar código de retirada. */
  onPickupCode?: (orderId: string) => void;
  onSeeAll?: () => void;
  emptyHint?: string;
};

export function ActiveRunsBlock({
  variant,
  orders,
  accent,
  onPressOrder,
  onPickupCode,
  onSeeAll,
  emptyHint,
}: Props) {
  const count = orders.length;

  return (
    <View style={[styles.wrap, count > 0 && styles.wrapLive]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={[styles.livePill, { backgroundColor: accent }]}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>
              {count > 0 ? `CORRIDAS ATIVAS · ${count}` : 'CORRIDAS ATIVAS'}
            </Text>
          </View>
        </View>
        {onSeeAll && count > 0 ? (
          <TouchableOpacity onPress={onSeeAll} hitSlop={8}>
            <Text style={[styles.seeAll, { color: accent }]}>Ver todas</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {count === 0 ? (
        <View style={styles.emptyBox}>
          <View style={[styles.emptyIcon, { backgroundColor: accent + '18' }]}>
            <Ionicons
              name={variant === 'merchant' ? 'bicycle-outline' : 'flash-outline'}
              size={22}
              color={accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>
              {variant === 'merchant' ? 'Nenhuma entrega em rota' : 'Sem corrida ativa'}
            </Text>
            <Text style={styles.empty}>
              {emptyHint ||
                (variant === 'merchant'
                  ? 'Quando um motoboy aceitar, a corrida aparece aqui.'
                  : 'Aceite uma oferta e a corrida fica destacada aqui.')}
            </Text>
            {onSeeAll ? (
              <TouchableOpacity onPress={onSeeAll} style={{ marginTop: 8 }} hitSlop={8}>
                <Text style={[styles.seeAll, { color: accent }]}>
                  {variant === 'merchant' ? 'Ver pedidos' : 'Ver disponíveis'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        orders.map((order) => {
          const phase = runPhase(order);
          const needsPickupCode =
            variant === 'merchant' &&
            phase.key === 'to_shop' &&
            !!order.kitchenReadyAt &&
            !order.pickupVerifiedAt;
          return (
            <View key={order.id} style={styles.cardWrap}>
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => onPressOrder(order.id)}
              >
                <View style={[styles.icon, { backgroundColor: accent + '18' }]}>
                  <Ionicons
                    name={phase.key === 'to_customer' ? 'navigate' : 'storefront'}
                    size={22}
                    color={accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.title} numberOfLines={1}>
                      {variant === 'merchant'
                        ? merchantOrderLabel(order)
                        : order.businessName}
                    </Text>
                    <View style={[styles.phasePill, { backgroundColor: phase.bg }]}>
                      <Text style={[styles.phaseText, { color: phase.color }]}>
                        {phase.label}
                      </Text>
                    </View>
                  </View>
                  {variant === 'merchant' ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {order.driverName || 'Entregador'}
                      {order.driverPhone ? ` · ${order.driverPhone}` : ''}
                      {' · '}
                      {statusLabelPt(order.status)}
                    </Text>
                  ) : (
                    <Text style={styles.meta} numberOfLines={1}>
                      {statusLabelPt(order.status)} · {formatPrice(driverEarningsOf(order))}
                    </Text>
                  )}
                  <Text style={styles.addr} numberOfLines={1}>
                    {variant === 'merchant'
                      ? order.items
                          .slice(0, 2)
                          .map((l) => `${l.quantity}× ${l.item.name}`)
                          .join(' · ') || order.address
                      : order.address}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
              {needsPickupCode && onPickupCode ? (
                <TouchableOpacity
                  style={styles.pickupBtn}
                  onPress={() => onPickupCode(order.id)}
                  activeOpacity={0.88}
                >
                  <Ionicons name="keypad" size={16} color="#fff" />
                  <Text style={styles.pickupBtnText}>
                    Digitar código · {merchantOrderLabel(order)}
                    {order.driverName ? ` · ${order.driverName}` : ''}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  wrapLive: {
    borderColor: '#34D399',
    backgroundColor: '#ECFDF5',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headLeft: { flex: 1 },
  livePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#6EE7B7',
  },
  livePillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  seeAll: { fontWeight: '800', fontSize: 13 },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  empty: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  cardWrap: { gap: 6 },
  pickupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pickupBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    flexShrink: 1,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  phasePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: '48%',
  },
  phaseText: {
    fontSize: 10,
    fontWeight: '800',
  },
  meta: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  addr: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
