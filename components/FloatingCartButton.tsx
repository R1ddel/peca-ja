import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCart } from '@/context/CartContext';
import { theme } from '@/constants/theme';
import { formatPrice } from '@/data/businesses';
import { customerSubtotalFromMerchant, countOrderItemUnits } from '@/constants/pricing';

/** Altura aproximada da tab bar + folga. */
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 88 : 72;

export function FloatingCartButton() {
  const { items, itemCount, subtotal } = useCart();
  const insets = useSafeAreaInsets();
  const customerSubtotal = useMemo(
    () => customerSubtotalFromMerchant(subtotal, countOrderItemUnits(items)),
    [subtotal, items]
  );

  if (itemCount === 0) return null;

  const bottom = Math.max(insets.bottom, 8) + TAB_BAR_CLEARANCE;

  return (
    <TouchableOpacity
      style={[styles.container, { bottom }]}
      activeOpacity={0.9}
      onPress={() => router.push('/cart')}
    >
      <View style={styles.left}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount}</Text>
        </View>
        <Text style={styles.label}>Ver carrinho</Text>
      </View>
      <Text style={styles.total}>{formatPrice(customerSubtotal)}</Text>
    </TouchableOpacity>
  );
}

export function CartHeaderButton() {
  const { itemCount } = useCart();

  return (
    <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/cart')}>
      <Ionicons name="bag-handle-outline" size={24} color={theme.colors.text} />
      {itemCount > 0 && (
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{itemCount > 9 ? '9+' : itemCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 20,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  label: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  total: {
    color: theme.colors.white,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
  },
  headerBtn: {
    marginRight: theme.spacing.md,
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: theme.colors.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  headerBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
  },
});
