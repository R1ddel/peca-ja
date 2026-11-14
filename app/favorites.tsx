import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { BusinessCard } from '@/components/BusinessCard';
import { useFavorites } from '@/context/FavoritesContext';
import { getBusinessById, formatPrice } from '@/data/businesses';
import { getSimulatedCityLabel } from '@/utils/demoLocation';
import { sameOperatingCity } from '@/utils/operatingCity';
import { theme } from '@/constants/theme';
import { customerUnitPrice } from '@/constants/pricing';

export default function FavoritesScreen() {
  const { businesses: favBusinessIds, dishes, toggleDish } = useFavorites();

  const favoriteBusinesses = useMemo(
    () =>
      favBusinessIds
        .map((id) => getBusinessById(id))
        .filter((b): b is NonNullable<typeof b> => !!b)
        .filter((b) => sameOperatingCity(b.city, getSimulatedCityLabel())),
    [favBusinessIds]
  );

  const favoriteDishes = useMemo(() => {
    return dishes
      .map((d) => {
        const business = getBusinessById(d.businessId);
        if (!business || !sameOperatingCity(business.city, getSimulatedCityLabel())) return null;
        const item = business?.menu.find((m) => m.id === d.itemId);
        if (!business || !item) return null;
        return { business, item };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [dishes]);

  const empty = favoriteBusinesses.length === 0 && favoriteDishes.length === 0;

  return (
    <View style={styles.screen}>
      <BackHeader title="Favoritos" fallbackHref="/(tabs)/profile" />
      <ScrollView contentContainerStyle={styles.content}>
        {empty ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={48} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>Nada nos favoritos ainda</Text>
            <Text style={styles.emptyText}>
              Toque no coração nos comércios e pratos para salvar aqui.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)')}>
              <Text style={styles.emptyBtnText}>Explorar comércios</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {favoriteBusinesses.length > 0 && (
              <>
                <Text style={styles.section}>Comércios</Text>
                {favoriteBusinesses.map((b, i) => (
                  <BusinessCard key={b.id} business={b} index={i} />
                ))}
              </>
            )}

            {favoriteDishes.length > 0 && (
              <>
                <Text style={[styles.section, { marginTop: theme.spacing.lg }]}>Pratos</Text>
                {favoriteDishes.map(({ business, item }) => (
                  <TouchableOpacity
                    key={`${business.id}-${item.id}`}
                    style={styles.dishRow}
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push({
                        pathname: '/business/[id]' as any,
                        params: { id: business.id, from: 'favorites' },
                      })
                    }
                  >
                    <Image source={{ uri: item.image }} style={styles.dishImage} />
                    <View style={styles.dishInfo}>
                      <Text style={styles.dishName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.dishBiz} numberOfLines={1}>
                        {business.name}
                      </Text>
                      <Text style={styles.dishPrice}>
                        {formatPrice(customerUnitPrice(item.promo ?? item.price))}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleDish(business.id, item.id)}
                      hitSlop={10}
                      accessibilityLabel="Remover dos favoritos"
                    >
                      <Ionicons name="heart" size={22} color={theme.colors.error} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  section: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  emptyBtn: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  emptyBtnText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  dishImage: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.borderLight,
  },
  dishInfo: { flex: 1 },
  dishName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  dishBiz: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  dishPrice: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primaryDark,
    marginTop: 4,
  },
});
