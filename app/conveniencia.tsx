import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { BusinessCard } from '@/components/BusinessCard';
import { FloatingCartButton } from '@/components/FloatingCartButton';
import { MobileShell } from '@/components/MobileShell';
import { categoryConfig, theme } from '@/constants/theme';
import { customerUnitPrice } from '@/constants/pricing';
import { formatPrice, getAllBusinesses } from '@/data/businesses';
import { Business } from '@/types';
import { hydratePartnerShops, applyProximityToBusinesses } from '@/utils/merchantShop';
import {
  convenienceProductCategories,
  listConvenienceProducts,
  listConvenienceShops,
} from '@/utils/convenience';
import { getUserPlaceDetails } from '@/services/permissions';
import { getSimulatedCityLabel } from '@/utils/demoLocation';
import { useDemoLocation } from '@/hooks/useDemoLocation';
import {
  businessPassesHomeFilters,
  sortBusinessesByHomeFilters,
  type HomeFilterState,
  defaultHomeFilters,
} from '@/utils/catalogFilters';

type HubTab = 'produtos' | 'lojas';

export default function ConvenienciaHubScreen() {
  const { version } = useDemoLocation();
  const [catalog, setCatalog] = useState<Business[]>(() => getAllBusinesses());
  const [tab, setTab] = useState<HubTab>('produtos');
  const [query, setQuery] = useState('');
  const [productCat, setProductCat] = useState('Todos');
  const [filters, setFilters] = useState<HomeFilterState>({
    ...defaultHomeFilters,
    openOnly: false,
    sort: 'distance',
  });

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await hydratePartnerShops();
        const place = await getUserPlaceDetails().catch(() => null);
        const label = getSimulatedCityLabel(place?.city);
        const base = getAllBusinesses(label === 'sua cidade' ? null : label);
        setCatalog(
          applyProximityToBusinesses(base, place?.latitude, place?.longitude)
        );
      })();
    }, [version])
  );

  const shops = useMemo(() => {
    const list = listConvenienceShops(catalog).filter((b) =>
      businessPassesHomeFilters(b, filters)
    );
    return sortBusinessesByHomeFilters(list, filters);
  }, [catalog, filters]);

  const allProducts = useMemo(
    () => listConvenienceProducts(catalog, 200),
    [catalog]
  );
  const productCats = useMemo(
    () => convenienceProductCategories(allProducts),
    [allProducts]
  );

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allProducts.filter(({ item, business }) => {
      if (!businessPassesHomeFilters(business, filters)) return false;
      if (productCat !== 'Todos' && item.category !== productCat) return false;
      if (!q) return true;
      const hay = `${item.name} ${item.category} ${business.name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allProducts, productCat, query, filters]);

  const filteredShops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [shops, query]);

  const openShops = shops.filter((b) => b.isOpen).length;
  const accent = categoryConfig.conveniencia.color;

  function openProduct(businessId: string, itemId: string) {
    router.push({
      pathname: '/business/[id]' as any,
      params: { id: businessId, itemId, from: 'conveniencia' },
    });
  }

  function toggleOpenOnly() {
    setFilters((prev) => ({ ...prev, openOnly: !prev.openOnly }));
  }

  function toggleDistance() {
    setFilters((prev) => ({
      ...prev,
      distance: prev.distance === '2' ? 'any' : '2',
    }));
  }

  function cycleSort() {
    setFilters((prev) => {
      const next =
        prev.sort === 'distance'
          ? 'rating'
          : prev.sort === 'rating'
            ? 'delivery'
            : 'distance';
      return { ...prev, sort: next };
    });
  }

  const sortLabel =
    filters.sort === 'distance'
      ? 'Mais perto'
      : filters.sort === 'rating'
        ? 'Nota'
        : 'Frete';

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Conveniência" subtitle="Peça agora e receba rapidinho" fallbackHref="/(tabs)" variant="brand" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={[accent, '#0F766E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="storefront" size={28} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Tudo pra agora</Text>
          <Text style={styles.heroSub}>
            Água, snacks, higiene e utilidades — lojas de conveniência e itens
            rápidos de mercados e afins.
          </Text>
          <Text style={styles.heroMeta}>
            {filteredProducts.length} produtos · {openShops} loja{openShops === 1 ? '' : 's'} aberta
            {openShops === 1 ? '' : 's'}
          </Text>
        </LinearGradient>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar água, snack, pilha…"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFilters}
        >
          <TouchableOpacity
            style={[styles.quickChip, filters.openOnly && styles.quickChipOn]}
            onPress={toggleOpenOnly}
            activeOpacity={0.85}
          >
            <Text style={[styles.quickChipText, filters.openOnly && styles.quickChipTextOn]}>
              Abertos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickChip, filters.distance === '2' && styles.quickChipOn]}
            onPress={toggleDistance}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.quickChipText,
                filters.distance === '2' && styles.quickChipTextOn,
              ]}
            >
              Até 2 km
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickChip, styles.quickChipOn]}
            onPress={cycleSort}
            activeOpacity={0.85}
          >
            <Text style={[styles.quickChipText, styles.quickChipTextOn]}>{sortLabel}</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'produtos' && styles.tabOn]}
            onPress={() => setTab('produtos')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === 'produtos' && styles.tabTextOn]}>
              Produtos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'lojas' && styles.tabOn]}
            onPress={() => setTab('lojas')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === 'lojas' && styles.tabTextOn]}>Lojas</Text>
          </TouchableOpacity>
        </View>

        {tab === 'produtos' ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {productCats.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, productCat === c && styles.chipOn]}
                  onPress={() => setProductCat(c)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, productCat === c && styles.chipTextOn]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredProducts.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="basket-outline" size={40} color={theme.colors.textMuted} />
                <Text style={styles.emptyTitle}>Nenhum produto</Text>
                <Text style={styles.emptyText}>
                  Tente outra busca ou peça ao comércio para marcar itens na Conveniência.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {filteredProducts.map(({ key, business, item }) => {
                  const price = customerUnitPrice(item.promo ?? item.price);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={styles.card}
                      activeOpacity={0.88}
                      onPress={() => openProduct(business.id, item.id)}
                    >
                      <Image source={{ uri: item.image }} style={styles.cardImg} />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.cardShop} numberOfLines={1}>
                          {business.name}
                        </Text>
                        <View style={styles.cardFoot}>
                          <Text style={styles.cardPrice}>{formatPrice(price)}</Text>
                          {!business.isOpen && (
                            <Text style={styles.cardClosed}>Fechado</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        ) : filteredShops.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma loja</Text>
            <Text style={styles.emptyText}>
              Ainda não há comércios vendendo na Conveniência nesta região.
            </Text>
          </View>
        ) : (
          filteredShops.map((b, i) => <BusinessCard key={b.id} business={b} index={i} />)
        )}
      </ScrollView>

      <FloatingCartButton />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 120,
    gap: theme.spacing.md,
  },
  hero: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: 8,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    color: '#fff',
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  heroMeta: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.75)',
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    padding: 0,
  },
  quickFilters: { gap: 8, paddingVertical: 2 },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  quickChipOn: {
    backgroundColor: categoryConfig.conveniencia.color,
    borderColor: categoryConfig.conveniencia.color,
  },
  quickChipText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  quickChipTextOn: { color: '#fff' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.radius.md,
  },
  tabOn: { backgroundColor: categoryConfig.conveniencia.color },
  tabText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
  },
  tabTextOn: { color: '#fff' },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  chipOn: {
    backgroundColor: categoryConfig.conveniencia.color,
    borderColor: categoryConfig.conveniencia.color,
  },
  chipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  chipTextOn: { color: '#fff' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardImg: { width: '100%', height: 110, backgroundColor: theme.colors.borderLight },
  cardBody: { padding: 10, gap: 2 },
  cardName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    minHeight: 36,
  },
  cardShop: { fontSize: 11, color: theme.colors.textMuted },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardPrice: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  cardClosed: { fontSize: 10, color: theme.colors.warning, fontWeight: theme.fontWeight.semibold },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
});
