import React from 'react';
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

/** Altura aproximada da tab bar + folga. */
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 88 : 72;

export function FloatingCartButton() {
  const { itemCount } = useCart();
  const insets = useSafeAreaInsets();

  if (itemCount === 0) return null;

  const bottom = Math.max(insets.bottom, 8) + TAB_BAR_CLEARANCE;

  return (
    <TouchableOpacity
      style={[styles.bubble, { bottom }]}
      activeOpacity={0.88}
      onPress={() => router.push('/cart')}
      accessibilityLabel={`Ver carrinho, ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`}
    >
      <Ionicons name="bag-handle" size={22} color={theme.colors.white} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{itemCount > 9 ? '9+' : itemCount}</Text>
      </View>
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
  bubble: {
    position: 'absolute',
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 20,
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  badgeText: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.extrabold,
    fontSize: 10,
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
