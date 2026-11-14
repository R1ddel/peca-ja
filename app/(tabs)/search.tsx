import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { BusinessCard } from '@/components/BusinessCard';
import {
  formatPrice,
  getAllBusinesses,
  getDestaqueRestaurants,
  getDestaqueSearchSuggestions,
} from '@/data/businesses';
import { hydratePartnerShops, applyProximityToBusinesses } from '@/utils/merchantShop';
import { searchCatalog, topPlanShopsForSearch } from '@/utils/catalogSearch';
import { MERCHANT_PLANS, TOP_MERCHANT_PLAN } from '@/constants/plans';
import { theme } from '@/constants/theme';
import { customerUnitPrice } from '@/constants/pricing';
import { Business } from '@/types';
import { useDemoLocation } from '@/hooks/useDemoLocation';
import { getUserPlaceDetails } from '@/services/permissions';
import { getSimulatedCityLabel } from '@/utils/demoLocation';
import { businessPassesHomeFilters, defaultHomeFilters } from '@/utils/catalogFilters';

const RECENT_KEY = '@pecaja_recent_searches';
const DEFAULT_RECENTS = ['Pizza', 'Farmácia', 'Mercado', 'Cerveja', 'Pão', 'Pudim'];
const MAX_RECENTS = 8;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 0);
  const params = useLocalSearchParams<{ q?: string }>();
  const [catalog, setCatalog] = useState<Business[]>(() => getAllBusinesses());
  const { version: demoVersion } = useDemoLocation();

  const refreshCatalog = useCallback(async () => {
    await hydratePartnerShops();
    const place = await getUserPlaceDetails().catch(() => null);
    const label = getSimulatedCityLabel(place?.city);
    const base = getAllBusinesses(label === 'sua cidade' ? null : label);
    setCatalog(applyProximityToBusinesses(base, place?.latitude, place?.longitude));
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [demoVersion, refreshCatalog]);

  useFocusEffect(
    useCallback(() => {
      void refreshCatalog();
    }, [refreshCatalog, demoVersion])
  );
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hasStoredRecents, setHasStoredRecents] = useState(false);

  const destaqueSuggestions = useMemo(() => getDestaqueSearchSuggestions(10), []);
  const destaqueRestaurants = useMemo(() => getDestaqueRestaurants().slice(0, 4), []);
  const planLabel = MERCHANT_PLANS[TOP_MERCHANT_PLAN].badge;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecentSearches(parsed.filter((t) => typeof t === 'string').slice(0, MAX_RECENTS));
            setHasStoredRecents(true);
            return;
          }
        }
        setRecentSearches([]);
        setHasStoredRecents(false);
      } catch {
        setRecentSearches([]);
      }
    })();
  }, []);

  useEffect(() => {
    const q = typeof params.q === 'string' ? params.q.trim() : '';
    if (q) {
      setQuery(q);
      rememberSearch(q);
    }
  }, [params.q]);

  // Mantém a query na URL para o Voltar restaurar resultados.
  useEffect(() => {
    const clean = query.trim();
    const timer = setTimeout(() => {
      if (clean.length >= 1) {
        router.setParams({ q: clean });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function rememberSearch(term: string) {
    const clean = term.trim();
    if (clean.length < 2) return;
    setHasStoredRecents(true);
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        MAX_RECENTS
      );
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  async function clearRecents() {
    setRecentSearches([]);
    setHasStoredRecents(false);
    await AsyncStorage.removeItem(RECENT_KEY);
  }

  function applyQuery(term: string) {
    setQuery(term);
    rememberSearch(term);
  }

  const comboSuggestions = useMemo(
    () => destaqueSuggestions.filter((s) => s.kind === 'combo'),
    [destaqueSuggestions]
  );
  const productSuggestions = useMemo(
    () => destaqueSuggestions.filter((s) => s.kind === 'produto'),
    [destaqueSuggestions]
  );

  const results = useMemo(
    () =>
      searchCatalog(catalog, query, {
        maxProducts: 500,
        maxBusinesses: 200,
        onlyAvailable: true,
        businessFilter: (b) => businessPassesHomeFilters(b, defaultHomeFilters),
      }),
    [query, catalog]
  );
  const hasResults = results.products.length > 0 || results.businesses.length > 0;

  /** Comerciantes do maior plano — duas fileiras no padrão da home (tile + scroll). */
  const topPlanRows = useMemo(
    () => topPlanShopsForSearch(catalog, query, TOP_MERCHANT_PLAN),
    [catalog, query]
  );

  function openProduct(businessId: string, itemId: string) {
    const q = query.trim();
    rememberSearch(q);
    router.push({
      pathname: '/business/[id]' as any,
      params: {
        id: businessId,
        itemId,
        from: 'search',
        ...(q ? { q } : {}),
      },
    });
  }

  function renderTopPlanRail(title: string, shops: Business[], keyPrefix: string) {
    if (shops.length === 0) return null;
    return (
      <View style={styles.railBlock}>
        <View style={styles.railHeader}>
          <Text style={styles.railTitle}>{title}</Text>
          <View style={styles.planPill}>
            <Ionicons name="diamond" size={12} color="#7C5C00" />
            <Text style={styles.planPillText}>{planLabel}</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {shops.map((business, index) => (
            <BusinessCard
              key={`${keyPrefix}-${business.id}`}
              business={business}
              variant="tile"
              index={index}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Tabs.Screen options={{ headerShown: false }} />
      <View style={[styles.tabHeader, { paddingTop: topInset + 14 }]}>
        <Text style={styles.tabTitle}>Buscar</Text>
        <Text style={styles.tabSub}>Pratos, mercados e farmácias perto de você</Text>
      </View>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar prato ou produto…"
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => rememberSearch(query)}
          returnKeyType="search"
          autoFocus
          accessibilityLabel="Campo de busca"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!query.trim() ? (
          <>
            <View style={styles.destaqueHeader}>
              <View style={styles.destaqueTitleRow}>
                <Ionicons name="sparkles" size={18} color={theme.colors.accent} />
                <Text style={styles.destaqueTitle}>Sugestões pra você</Text>
              </View>
              <View style={styles.planPill}>
                <Ionicons name="diamond" size={12} color="#7C5C00" />
                <Text style={styles.planPillText}>{planLabel}</Text>
              </View>
            </View>
            <Text style={styles.destaqueSub}>
              Combos e produtos dos parceiros Peça Já no pacote mais completo
            </Text>

            {productSuggestions.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Produtos em destaque</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionRow}
                >
                  {productSuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.suggestionCard}
                      activeOpacity={0.9}
                      onPress={() => openProduct(item.businessId, item.itemId)}
                    >
                      <Image source={{ uri: item.image }} style={styles.suggestionImage} />
                      <View style={styles.suggestionBadge}>
                        <Text style={styles.suggestionBadgeText}>{item.hook}</Text>
                      </View>
                      <View style={styles.suggestionBody}>
                        <Text style={styles.suggestionName} numberOfLines={2}>
                          {item.headline}
                        </Text>
                        <Text style={styles.suggestionShop} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                        <View style={styles.suggestionMeta}>
                          <View style={styles.ratingRow}>
                            <Ionicons name="star" size={12} color={theme.colors.accent} />
                            <Text style={styles.ratingText}>{item.rating}</Text>
                          </View>
                          <Text style={styles.suggestionTime}>{item.deliveryTime}</Text>
                        </View>
                        <View style={styles.priceRow}>
                          {item.promo ? (
                            <>
                              <Text style={styles.promoPrice}>{formatPrice(customerUnitPrice(item.promo))}</Text>
                              <Text style={styles.oldPrice}>{formatPrice(customerUnitPrice(item.price))}</Text>
                            </>
                          ) : (
                            <Text style={styles.promoPrice}>{formatPrice(customerUnitPrice(item.price))}</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {comboSuggestions.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>
                  Combos dos parceiros
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionRow}
                >
                  {comboSuggestions.map((item) => (
                    <TouchableOpacity
                      key={`combo-${item.id}`}
                      style={[styles.suggestionCard, styles.comboCard]}
                      activeOpacity={0.9}
                      onPress={() => openProduct(item.businessId, item.itemId)}
                    >
                      <Image source={{ uri: item.image }} style={styles.suggestionImage} />
                      <View style={[styles.suggestionBadge, styles.comboBadge]}>
                        <Text style={styles.suggestionBadgeText}>{item.hook}</Text>
                      </View>
                      <View style={styles.suggestionBody}>
                        <Text style={styles.suggestionName} numberOfLines={2}>
                          {item.headline}
                        </Text>
                        <Text style={styles.suggestionShop} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                        <View style={styles.priceRow}>
                          {item.promo ? (
                            <>
                              <Text style={styles.promoPrice}>{formatPrice(customerUnitPrice(item.promo))}</Text>
                              <Text style={styles.oldPrice}>{formatPrice(customerUnitPrice(item.price))}</Text>
                            </>
                          ) : (
                            <Text style={styles.promoPrice}>{formatPrice(customerUnitPrice(item.price))}</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>
              Parceiros Peça Já em destaque
            </Text>
            {destaqueRestaurants.map((business, index) => (
              <View key={business.id} style={styles.featuredWrap}>
                <View style={styles.featuredRibbon}>
                  <Ionicons name="diamond-outline" size={12} color="#7C5C00" />
                  <Text style={styles.featuredRibbonText}>{planLabel}</Text>
                </View>
                <BusinessCard business={business} index={index} />
              </View>
            ))}

            <View style={styles.recentHead}>
              <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg, marginBottom: 0 }]}>
                {hasStoredRecents ? 'Buscas recentes' : 'Sugestões'}
              </Text>
              {hasStoredRecents ? (
                <TouchableOpacity onPress={() => void clearRecents()} hitSlop={8}>
                  <Text style={styles.clearRecents}>Limpar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.chips}>
              {(hasStoredRecents ? recentSearches : DEFAULT_RECENTS).map((term) => (
                <TouchableOpacity key={term} style={styles.chip} onPress={() => applyQuery(term)}>
                  <Ionicons
                    name={hasStoredRecents ? 'time-outline' : 'sparkles-outline'}
                    size={14}
                    color={theme.colors.textMuted}
                  />
                  <Text style={styles.chipText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>
              Categorias populares
            </Text>
            <View style={styles.grid}>
              {[
                { icon: 'pizza', label: 'Pizza', query: 'pizza' },
                { icon: 'ice-cream', label: 'Sobremesas', query: 'pudim' },
                { icon: 'medkit', label: 'Farmácia', query: 'dipirona' },
                { icon: 'wine', label: 'Bebidas', query: 'cerveja' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.gridItem}
                  onPress={() => applyQuery(item.query)}
                >
                  <View style={styles.gridIcon}>
                    <Ionicons
                      name={item.icon as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text style={styles.gridLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : !hasResults ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum resultado</Text>
            <Text style={styles.emptyText}>
              Não achamos “{query}” em pratos ou produtos do app.
            </Text>
          </View>
        ) : (
          <>
            {renderTopPlanRail(`Parceiros ${planLabel}`, topPlanRows.row1, 'top1')}
            {renderTopPlanRail(`Mais do ${planLabel}`, topPlanRows.row2, 'top2')}

            <Text style={styles.resultCount}>
              {results.products.length > 0
                ? `${results.products.length} item(ns) para “${query}”`
                : `${results.businesses.length} loja(s) para “${query}”`}
            </Text>
            {results.products.length > 0 ? (
            <View style={styles.productList}>
              {results.products.map((hit) => {
                const price = customerUnitPrice(hit.item.promo ?? hit.item.price);
                return (
                  <TouchableOpacity
                    key={hit.key}
                    style={styles.productRow}
                    activeOpacity={0.85}
                    onPress={() =>
                      openProduct(hit.business.id, hit.item.id)
                    }
                  >
                    <Image source={{ uri: hit.item.image }} style={styles.productThumb} />
                    <View style={styles.productBody}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {hit.item.name}
                      </Text>
                      <Text style={styles.productShop} numberOfLines={1}>
                        {hit.business.name}
                        {!hit.business.isOpen ? ' · Fechado' : ''}
                      </Text>
                      <Text style={styles.productCat} numberOfLines={1}>
                        {hit.item.category}
                      </Text>
                    </View>
                    <View style={styles.productPriceCol}>
                      <Text style={styles.productPrice}>{formatPrice(price)}</Text>
                      {hit.item.promo != null ? (
                        <Text style={styles.productOld}>{formatPrice(customerUnitPrice(hit.item.price))}</Text>
                      ) : null}
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={theme.colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            ) : null}
            {results.businesses.length > 0 ? (
              <View style={{ marginTop: results.products.length > 0 ? 16 : 0 }}>
                {results.products.length > 0 ? (
                  <Text style={[styles.resultCount, { marginBottom: 8 }]}>
                    {results.businesses.length} loja(s)
                  </Text>
                ) : null}
                {results.businesses.map((business, index) => (
                  <BusinessCard key={business.id} business={business} index={index} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 4,
  },
  tabTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  tabSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  clearRecents: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  searchInput: { flex: 1, fontSize: theme.fontSize.md, color: theme.colors.text },
  content: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl },
  destaqueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  destaqueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  destaqueTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFE8A3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  planPillText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
    color: '#7C5C00',
  },
  destaqueSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  suggestionRow: { gap: theme.spacing.md, paddingRight: theme.spacing.md },
  suggestionCard: {
    width: 188,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0E0A8',
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  comboCard: {
    borderColor: theme.colors.primaryMuted,
  },
  suggestionImage: {
    width: '100%',
    height: 118,
    backgroundColor: theme.colors.borderLight,
  },
  suggestionBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(30, 58, 47, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  comboBadge: {
    backgroundColor: 'rgba(0, 122, 77, 0.92)',
  },
  suggestionBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
  },
  suggestionBody: { padding: theme.spacing.sm },
  suggestionName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    minHeight: 36,
  },
  suggestionShop: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  suggestionTime: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  promoPrice: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  oldPrice: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
  featuredWrap: { marginBottom: theme.spacing.sm },
  featuredRibbon: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFE8A3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    marginBottom: 6,
  },
  featuredRibbonText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
    color: '#7C5C00',
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  gridItem: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  gridIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  gridLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  empty: { alignItems: 'center', paddingVertical: theme.spacing.xxl, gap: theme.spacing.sm },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  resultCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  railBlock: { marginBottom: theme.spacing.sm },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  railTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  rail: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  productList: { gap: 8, marginBottom: theme.spacing.sm },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  productThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: theme.colors.borderLight,
  },
  productBody: { flex: 1, gap: 2 },
  productName: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
  productShop: { color: theme.colors.textSecondary, fontSize: theme.fontSize.xs },
  productCat: { color: theme.colors.textMuted, fontSize: 11 },
  productPriceCol: { alignItems: 'flex-end', gap: 2 },
  productPrice: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
  },
  productOld: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
