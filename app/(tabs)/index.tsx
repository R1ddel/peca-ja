import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { BusinessCard } from '@/components/BusinessCard';
import { CategoryChip } from '@/components/CategoryChip';
import { PromoBanner } from '@/components/PromoBanner';
import { FloatingCartButton } from '@/components/FloatingCartButton';
import { FadeInUp } from '@/components/FadeInUp';
import { PecaJaLogo } from '@/components/PecaJaLogo';
import { CustomerLiveMap } from '@/components/CustomerLiveMap';
import { DeliveryTrackingMap } from '@/components/DeliveryTrackingMap';
import { pickHomeLiveMapOrder, isDriverEnRouteToCustomer } from '@/utils/customerLiveMap';
import {
  HomeFiltersModal,
  countActiveFilters,
  defaultHomeFilters,
  type HomeFilterState,
} from '@/components/HomeFilters';
import { hydratePartnerShops, applyProximityToBusinesses } from '@/utils/merchantShop';
import { customerUnitPrice } from '@/constants/pricing';
import { formatPrice, getAllBusinesses } from '@/data/businesses';
import { BusinessCategory, categoryConfig } from '@/constants/theme';
import { theme } from '@/constants/theme';
import { MERCHANT_PLANS, TOP_MERCHANT_PLAN } from '@/constants/plans';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { getApproxLocationLabel, getUserPlaceDetails } from '@/services/permissions';
import {
  CustomerChatAlert,
  listCustomerChatAlerts,
} from '@/services/orderChat';
import { Business } from '@/types';
import { OrderAlertBanner } from '@/components/OrderAlertBanner';
import { useDemoLocation } from '@/hooks/useDemoLocation';
import { getSimulatedCityLabel } from '@/utils/demoLocation';
import {
  searchCatalog,
  topPlanShopsForSearch,
} from '@/utils/catalogSearch';
import {
  applyHomeBusinessFilters,
  businessPassesHomeFilters,
} from '@/utils/catalogFilters';

type FilterCategory = BusinessCategory | 'todos';

const categories: FilterCategory[] = [
  'todos',
  'restaurante',
  'mercado',
  'farmacia',
  'distribuidora',
  'padaria',
  'bebidas',
  'conveniencia',
];

function groupByCategory(list: Business[]): { category: BusinessCategory; items: Business[] }[] {
  const order: BusinessCategory[] = [
    'restaurante',
    'mercado',
    'farmacia',
    'padaria',
    'distribuidora',
    'bebidas',
    'conveniencia',
  ];
  return order
    .map((category) => ({
      category,
      items: list.filter((b) => b.category === category),
    }))
    .filter((g) => g.items.length > 0);
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { myOrders } = useOrders();
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<HomeFilterState>(defaultHomeFilters);
  const [draftFilters, setDraftFilters] = useState<HomeFilterState>(defaultHomeFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [gpsLabel, setGpsLabel] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [catalog, setCatalog] = useState<Business[]>(() => getAllBusinesses());
  const [chatAlerts, setChatAlerts] = useState<CustomerChatAlert[]>([]);
  const { version: demoVersion, cityLabel: demoCity } = useDemoLocation();

  const refreshChatAlerts = useCallback(async () => {
    const list = await listCustomerChatAlerts(myOrders);
    setChatAlerts(list);
  }, [myOrders]);

  useFocusEffect(
    useCallback(() => {
      void refreshChatAlerts();
      const tick = setInterval(() => {
        void refreshChatAlerts();
      }, 1500);
      return () => clearInterval(tick);
    }, [refreshChatAlerts])
  );

  function openLatestChatAlert() {
    const alert = chatAlerts[0];
    if (!alert) return;
    router.push({
      pathname: '/chat/[orderId]' as any,
      params: { orderId: alert.orderId, peer: alert.peer },
    });
  }

  async function refreshLocationChip() {
    try {
      const place = await getUserPlaceDetails();
      if (place) {
        setGpsLabel(getSimulatedCityLabel(place.city));
        setUserCoords({ latitude: place.latitude, longitude: place.longitude });
        return;
      }
      const label = await getApproxLocationLabel();
      if (label) setGpsLabel(getSimulatedCityLabel(label));
      else if (demoCity) setGpsLabel(demoCity);
    } catch {
      if (demoCity) setGpsLabel(demoCity);
    }
  }

  async function refreshCatalog() {
    await hydratePartnerShops();
    const raw = getAllBusinesses();
    const withGeo = applyProximityToBusinesses(
      raw,
      userCoords?.latitude,
      userCoords?.longitude
    );
    setCatalog(withGeo);
  }

  useEffect(() => {
    void refreshLocationChip();
  }, [demoVersion, demoCity]);

  useEffect(() => {
    void refreshCatalog();
  }, [demoVersion, userCoords?.latitude, userCoords?.longitude]);

  useFocusEffect(
    useCallback(() => {
      void refreshLocationChip();
      void refreshCatalog();
    }, [demoVersion, userCoords?.latitude, userCoords?.longitude])
  );

  const filteredBusinesses = useMemo(
    () =>
      applyHomeBusinessFilters(catalog, {
        selectedCategory,
        searchQuery,
        filters,
      }),
    [catalog, selectedCategory, searchQuery, filters]
  );

  const draftCount = useMemo(
    () =>
      applyHomeBusinessFilters(catalog, {
        selectedCategory,
        searchQuery,
        filters: draftFilters,
      }).length,
    [catalog, selectedCategory, searchQuery, draftFilters]
  );

  const activeFilterCount = countActiveFilters(filters);
  const openCount = catalog.filter((b) => b.isOpen).length;
  const listKey = `${selectedCategory}-${searchQuery}-${JSON.stringify(filters)}`;
  const isProductSearch = searchQuery.trim().length > 0;
  const topPlanLabel = MERCHANT_PLANS[TOP_MERCHANT_PLAN].badge;

  const productSearch = useMemo(() => {
    if (!isProductSearch) return { products: [], businesses: [] };
    return searchCatalog(catalog, searchQuery, {
      maxProducts: 500,
      maxBusinesses: 200,
      onlyAvailable: true,
      businessFilter: (b) => {
        const matchesCategory =
          selectedCategory === 'todos' || b.category === selectedCategory;
        return matchesCategory && businessPassesHomeFilters(b, filters);
      },
    });
  }, [catalog, searchQuery, isProductSearch, selectedCategory, filters]);

  const topPlanSearchRows = useMemo(() => {
    if (!isProductSearch) return { row1: [] as Business[], row2: [] as Business[] };
    return topPlanShopsForSearch(catalog, searchQuery, TOP_MERCHANT_PLAN);
  }, [catalog, searchQuery, isProductSearch]);

  const liveDeliveryOrder = useMemo(
    () => pickHomeLiveMapOrder(myOrders, user?.id),
    [myOrders, user?.id]
  );

  const featured = useMemo(
    () => filteredBusinesses.filter((b) => b.plan === 'destaque').slice(0, 12),
    [filteredBusinesses]
  );
  const byCategory = useMemo(
    () => (selectedCategory === 'todos' && !searchQuery ? groupByCategory(filteredBusinesses) : []),
    [filteredBusinesses, selectedCategory, searchQuery]
  );
  const showCategoryRails = byCategory.length > 0 && activeFilterCount === 0;

  function openFilters() {
    setDraftFilters(filters);
    setFiltersOpen(true);
  }

  function clearFilters() {
    setDraftFilters({ ...defaultHomeFilters });
    setFilters({ ...defaultHomeFilters });
  }

  function clearDraftOnly() {
    const cleared = { ...defaultHomeFilters };
    setDraftFilters(cleared);
    setFilters(cleared);
  }

  function applyDraft() {
    setFilters({ ...draftFilters });
    setFiltersOpen(false);
  }

  function quickToggleOpen() {
    setFilters((prev) => ({ ...prev, openOnly: !prev.openOnly }));
  }

  function quickDistance(value: HomeFilterState['distance']) {
    setFilters((prev) => ({
      ...prev,
      distance: prev.distance === value ? 'any' : value,
    }));
  }

  function quickDelivery(value: HomeFilterState['deliveryFee']) {
    setFilters((prev) => ({
      ...prev,
      deliveryFee: prev.deliveryFee === value ? 'any' : value,
    }));
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <OrderAlertBanner />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FadeInUp delay={20}>
          <View style={styles.brandRow}>
            <PecaJaLogo size="sm" showName />
            <View style={styles.brandActions}>
              <TouchableOpacity
                style={[
                  styles.favShortcut,
                  chatAlerts.length > 0 && styles.chatBellActive,
                ]}
                onPress={openLatestChatAlert}
                disabled={chatAlerts.length === 0}
                accessibilityLabel={
                  chatAlerts.length > 0
                    ? `${chatAlerts.length} mensagem(ns) no chat`
                    : 'Sem mensagens novas no chat'
                }
                hitSlop={8}
              >
                <Ionicons
                  name={chatAlerts.length > 0 ? 'notifications' : 'notifications-outline'}
                  size={22}
                  color={
                    chatAlerts.length > 0 ? theme.colors.primary : theme.colors.textMuted
                  }
                />
                {chatAlerts.length > 0 ? (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>
                      {chatAlerts.length > 9 ? '9+' : String(chatAlerts.length)}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.favShortcut}
                onPress={() => router.push('/favorites' as any)}
                accessibilityLabel="Favoritos"
                hitSlop={8}
              >
                <Ionicons name="heart-outline" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </FadeInUp>

        {chatAlerts.length > 0 ? (
          <TouchableOpacity
            style={styles.chatAlertBanner}
            activeOpacity={0.88}
            onPress={openLatestChatAlert}
          >
            <View
              style={[
                styles.chatAlertIcon,
                {
                  backgroundColor:
                    chatAlerts[0].from === 'driver'
                      ? '#8B5CF622'
                      : theme.colors.accentSoft,
                },
              ]}
            >
              <Ionicons
                name={chatAlerts[0].from === 'driver' ? 'bicycle' : 'storefront'}
                size={18}
                color={
                  chatAlerts[0].from === 'driver' ? '#8B5CF6' : theme.colors.accent
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatAlertTitle} numberOfLines={1}>
                {chatAlerts[0].from === 'driver' ? 'Entregador' : 'Comércio'} ·{' '}
                {chatAlerts[0].label}
              </Text>
              <Text style={styles.chatAlertBody} numberOfLines={1}>
                {chatAlerts[0].preview}
              </Text>
            </View>
            <Text style={styles.chatAlertCta}>Abrir</Text>
          </TouchableOpacity>
        ) : null}

        {!user && (
          <TouchableOpacity
            style={styles.guestBanner}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/login')}
          >
            <Ionicons name="person-outline" size={18} color={theme.colors.primaryDark} />
            <Text style={styles.guestBannerText}>
              Explorando sem conta · Entre para pedir e acumular pontos
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        )}

        <FadeInUp delay={40}>
          <View style={styles.greeting}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.greetingText}>
                Olá, {user?.name?.split(' ')[0] ?? 'bem-vindo'}
              </Text>
              <Text style={styles.greetingSub}>{openCount} comércios abertos perto de você</Text>
            </View>
            <TouchableOpacity
              style={styles.locationBtn}
              activeOpacity={0.8}
              onPress={() => {
                refreshLocationChip();
                router.push('/permissions' as any);
              }}
            >
              <Ionicons name="location" size={16} color={theme.colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {gpsLabel ?? user?.address?.split(',')[0] ?? 'Ativar localização'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </FadeInUp>

        {liveDeliveryOrder ? (
          <FadeInUp delay={70}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() =>
                router.push({
                  pathname: '/order/[id]' as any,
                  params: { id: liveDeliveryOrder.id },
                })
              }
            >
              <CustomerLiveMap order={liveDeliveryOrder} viewer="customer" height={220} />
            </TouchableOpacity>
            {isDriverEnRouteToCustomer(liveDeliveryOrder) ? (
              <Text style={styles.liveRouteHint}>
                Toque no mapa para ver detalhes · {liveDeliveryOrder.driverName || 'Entregador'} a
                caminho
              </Text>
            ) : null}
          </FadeInUp>
        ) : (
          <FadeInUp delay={70}>
            <DeliveryTrackingMap fallbackName={user?.name?.split(' ')[0] ?? 'Você'} />
          </FadeInUp>
        )}

        <FadeInUp delay={100}>
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={theme.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar produto, prato ou loja…"
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
              activeOpacity={0.7}
              onPress={openFilters}
            >
              <Ionicons
                name="options-outline"
                size={22}
                color={activeFilterCount > 0 ? '#fff' : theme.colors.text}
              />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </FadeInUp>

        <FadeInUp delay={120}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFilters}
          >
            <TouchableOpacity
              style={[styles.quickChip, filters.openOnly && styles.quickChipOn]}
              onPress={quickToggleOpen}
              activeOpacity={0.8}
            >
              <Ionicons
                name="flash-outline"
                size={14}
                color={filters.openOnly ? theme.colors.white : theme.colors.primary}
              />
              <Text style={[styles.quickChipText, filters.openOnly && styles.quickChipTextOn]}>
                Abertos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickChip, filters.distance === '2' && styles.quickChipOn]}
              onPress={() => quickDistance('2')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="navigate-outline"
                size={14}
                color={filters.distance === '2' ? theme.colors.white : theme.colors.primary}
              />
              <Text style={[styles.quickChipText, filters.distance === '2' && styles.quickChipTextOn]}>
                Até 2 km
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickChip, filters.deliveryFee === '0' && styles.quickChipOn]}
              onPress={() => quickDelivery('0')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="gift-outline"
                size={14}
                color={filters.deliveryFee === '0' ? theme.colors.white : theme.colors.primary}
              />
              <Text
                style={[styles.quickChipText, filters.deliveryFee === '0' && styles.quickChipTextOn]}
              >
                Entrega grátis
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickChip, filters.deliveryFee === '5' && styles.quickChipOn]}
              onPress={() => quickDelivery('5')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="bicycle-outline"
                size={14}
                color={filters.deliveryFee === '5' ? theme.colors.white : theme.colors.primary}
              />
              <Text
                style={[styles.quickChipText, filters.deliveryFee === '5' && styles.quickChipTextOn]}
              >
                Frete R$ 5
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickChip, filters.rating === '4.5' && styles.quickChipOn]}
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  rating: prev.rating === '4.5' ? 'any' : '4.5',
                }))
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="star-outline"
                size={14}
                color={filters.rating === '4.5' ? theme.colors.white : theme.colors.primary}
              />
              <Text
                style={[styles.quickChipText, filters.rating === '4.5' && styles.quickChipTextOn]}
              >
                4.5+
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickChip} onPress={openFilters} activeOpacity={0.8}>
              <Ionicons name="funnel-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.quickChipText}>Mais filtros</Text>
            </TouchableOpacity>
          </ScrollView>
        </FadeInUp>

        {!isProductSearch ? (
          <FadeInUp delay={140}>
            <PromoBanner
              onSelectCategory={(c) => {
                setSelectedCategory(c);
              }}
            />
          </FadeInUp>
        ) : null}

        {!isProductSearch ? (
          <FadeInUp delay={180}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categories}
            >
              {categories.map((cat) => (
                <CategoryChip
                  key={cat}
                  category={cat}
                  selected={selectedCategory === cat}
                  onPress={() => {
                    setSelectedCategory(cat);
                  }}
                />
              ))}
            </ScrollView>
          </FadeInUp>
        ) : null}

        {!isProductSearch && selectedCategory === 'conveniencia' ? (
          <FadeInUp delay={200}>
            <TouchableOpacity
              style={styles.convenienceCard}
              activeOpacity={0.9}
              onPress={() => router.push('/conveniencia' as any)}
            >
              <View style={styles.convenienceIcon}>
                <Ionicons name="storefront" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.convenienceTitle}>Abrir hub Conveniência</Text>
                <Text style={styles.convenienceSub}>
                  Produtos rápidos de várias lojas em um só lugar
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </FadeInUp>
        ) : null}

        {!isProductSearch && selectedCategory === 'todos' ? (
          <FadeInUp delay={200}>
            <TouchableOpacity
              style={styles.convenienceCard}
              activeOpacity={0.9}
              onPress={() => router.push('/conveniencia' as any)}
            >
              <View style={styles.convenienceIcon}>
                <Ionicons name="storefront" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.convenienceTitle}>Conveniência</Text>
                <Text style={styles.convenienceSub}>
                  Água, snacks e utilidades — peça agora
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </FadeInUp>
        ) : null}

        {isProductSearch ? (
          <FadeInUp delay={160}>
            {productSearch.products.length === 0 && productSearch.businesses.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={48} color={theme.colors.textMuted} />
                <Text style={styles.emptyTitle}>Nada para “{searchQuery.trim()}”</Text>
                <Text style={styles.emptyText}>
                  Não achamos esse produto no cardápio. Tente outro nome.
                </Text>
              </View>
            ) : (
              <View>
                {(topPlanSearchRows.row1.length > 0 || topPlanSearchRows.row2.length > 0) && (
                  <>
                    <View style={styles.sectionHeader}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.sectionTitle}>Parceiros {topPlanLabel}</Text>
                        <Text style={styles.fairHint}>
                          Só lojas do maior plano com “{searchQuery.trim()}”
                        </Text>
                      </View>
                      <View style={styles.planPill}>
                        <Ionicons name="diamond" size={12} color="#7C5C00" />
                        <Text style={styles.planPillText}>{topPlanLabel}</Text>
                      </View>
                    </View>

                    {topPlanSearchRows.row1.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.rail}
                      >
                        {topPlanSearchRows.row1.map((business, index) => (
                          <BusinessCard
                            key={`top1-${business.id}`}
                            business={business}
                            variant="tile"
                            index={index}
                          />
                        ))}
                      </ScrollView>
                    ) : null}

                    {topPlanSearchRows.row2.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[styles.rail, { marginTop: 8 }]}
                      >
                        {topPlanSearchRows.row2.map((business, index) => (
                          <BusinessCard
                            key={`top2-${business.id}`}
                            business={business}
                            variant="tile"
                            index={index}
                          />
                        ))}
                      </ScrollView>
                    ) : null}
                  </>
                )}

                <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Itens relacionados</Text>
                    <Text style={styles.fairHint}>
                      Todos os produtos que batem com a busca
                    </Text>
                  </View>
                  <Text style={styles.sectionCount}>{productSearch.products.length}</Text>
                </View>

                {productSearch.products.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Achamos lojas com esse nome, mas nenhum item de cardápio. Veja as lojas abaixo.
                  </Text>
                ) : (
                  <View style={styles.productList}>
                    {productSearch.products.map((hit) => {
                      const merchantPrice = hit.item.promo ?? hit.item.price;
                      const price = customerUnitPrice(merchantPrice);
                      return (
                        <TouchableOpacity
                          key={hit.key}
                          style={styles.productRow}
                          activeOpacity={0.85}
                          onPress={() =>
                            router.push({
                              pathname: '/business/[id]' as any,
                              params: {
                                id: hit.business.id,
                                itemId: hit.item.id,
                                from: 'home',
                                ...(searchQuery.trim()
                                  ? { q: searchQuery.trim() }
                                  : {}),
                              },
                            })
                          }
                        >
                          <Image source={{ uri: hit.item.image }} style={styles.productThumb} />
                          <View style={styles.productBody}>
                            <Text style={styles.productName} numberOfLines={2}>
                              {hit.item.name}
                            </Text>
                            <Text style={styles.productShop} numberOfLines={1}>
                              {hit.business.name}
                            </Text>
                            <Text style={styles.productCat} numberOfLines={1}>
                              {hit.item.category}
                              {hit.business.plan === TOP_MERCHANT_PLAN
                                ? ` · ${topPlanLabel}`
                                : ''}
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
                )}

                {productSearch.businesses.length > 0 ? (
                  <>
                    <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>Lojas</Text>
                        <Text style={styles.fairHint}>
                          Comércios que batem com “{searchQuery.trim()}”
                        </Text>
                      </View>
                      <Text style={styles.sectionCount}>{productSearch.businesses.length}</Text>
                    </View>
                    <View style={styles.grid}>
                      {productSearch.businesses.map((business, index) => (
                        <BusinessCard
                          key={`biz-${business.id}`}
                          business={business}
                          variant="grid"
                          index={index}
                        />
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            )}
          </FadeInUp>
        ) : filteredBusinesses.length === 0 ? (
          <FadeInUp delay={120}>
            <View style={styles.empty}>
              <Ionicons
                name={catalog.length === 0 ? 'location-outline' : 'options-outline'}
                size={48}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {catalog.length === 0
                  ? gpsLabel
                    ? `Ainda não operamos em ${gpsLabel}`
                    : 'Nenhum comércio na sua região'
                  : 'Nenhum comércio encontrado'}
              </Text>
              <Text style={styles.emptyText}>
                {catalog.length === 0
                  ? 'O Peça Já ainda não tem parceiros ativos por aqui. Ative a localização ou cadastre seu comércio.'
                  : 'Ajuste os filtros ou tente outra busca'}
              </Text>
              {catalog.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/partner' as any)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyBtnText}>Seja parceiro</Text>
                </TouchableOpacity>
              ) : null}
              {activeFilterCount > 0 && (
                <TouchableOpacity style={styles.emptyBtn} onPress={clearFilters} activeOpacity={0.85}>
                  <Text style={styles.emptyBtnText}>Limpar filtros</Text>
                </TouchableOpacity>
              )}
            </View>
          </FadeInUp>
        ) : (
          <>
            {showCategoryRails ? (
              <>
                {featured.length > 0 && (
                  <FadeInUp delay={200}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Em destaque</Text>
                      <Text style={styles.sectionCount}>{featured.length}</Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.rail}
                    >
                      {featured.map((business, index) => (
                        <BusinessCard
                          key={`feat-${listKey}-${business.id}`}
                          business={business}
                          variant="tile"
                          index={index}
                        />
                      ))}
                    </ScrollView>
                  </FadeInUp>
                )}

                {byCategory.map((group) => (
                  <FadeInUp key={`rail-${group.category}-${listKey}`} delay={220}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>
                        {categoryConfig[group.category].label}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setSelectedCategory(group.category)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.seeAll}>Ver grade · {group.items.length}</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.rail}
                    >
                      {group.items.map((business, index) => (
                        <BusinessCard
                          key={`cat-${group.category}-${business.id}`}
                          business={business}
                          variant="tile"
                          index={index}
                        />
                      ))}
                    </ScrollView>
                  </FadeInUp>
                ))}
              </>
            ) : (
              <>
                <FadeInUp delay={240} key={`grid-h-${listKey}`}>
                  <View style={styles.sectionHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.sectionTitle}>
                        {selectedCategory === 'todos' ? 'Todos os comércios' : 'Resultados'}
                      </Text>
                      <Text style={styles.fairHint}>
                        Grade 2 colunas · mais lojas visíveis de uma vez
                      </Text>
                      {activeFilterCount > 0 && (
                        <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
                          <Text style={styles.clearInline}>Limpar filtros</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.sectionCount}>{filteredBusinesses.length}</Text>
                  </View>
                </FadeInUp>

                <View style={styles.grid}>
                  {filteredBusinesses.map((business, index) => (
                    <BusinessCard
                      key={`${listKey}-${business.id}`}
                      business={business}
                      variant="grid"
                      index={index}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FloatingCartButton />

      <HomeFiltersModal
        visible={filtersOpen}
        value={draftFilters}
        onChange={setDraftFilters}
        onClose={() => setFiltersOpen(false)}
        onApply={applyDraft}
        onClear={clearDraftOnly}
        resultCount={draftCount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingHorizontal: theme.spacing.md, paddingTop: 10, paddingBottom: 24 },
  brandRow: {
    paddingTop: theme.spacing.sm,
    paddingBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favShortcut: {
    padding: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryLight,
    position: 'relative',
  },
  chatBellActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  chatBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  chatBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
  },
  chatAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: theme.spacing.sm,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
  },
  chatAlertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAlertTitle: {
    fontSize: 13,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  chatAlertBody: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  chatAlertCta: {
    fontSize: 13,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  liveRouteHint: {
    fontSize: 12,
    color: theme.colors.primaryDark,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: theme.spacing.md,
    fontWeight: theme.fontWeight.semibold,
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
  },
  guestBannerText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.medium,
  },
  greeting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  greetingText: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  greetingSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    gap: 4,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  locationText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '600',
    flex: 1,
    marginHorizontal: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    height: '100%',
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
  },
  quickFilters: {
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  quickChipOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  quickChipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  quickChipTextOn: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },
  categories: {
    paddingBottom: theme.spacing.md,
  },
  convenienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: categoryConfig.conveniencia.color,
    borderRadius: theme.radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: theme.spacing.md,
  },
  convenienceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convenienceTitle: {
    color: '#fff',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  convenienceSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  clearInline: {
    marginTop: 4,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  sectionCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
    marginTop: 2,
  },
  fairHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  seeAll: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  rail: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  emptyBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
  },
  emptyBtnText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
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
  productList: { gap: 8, marginBottom: theme.spacing.md },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  productThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: theme.colors.borderLight,
  },
  productBody: { flex: 1 },
  productName: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: 14,
  },
  productShop: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    marginTop: 2,
    fontWeight: theme.fontWeight.semibold,
  },
  productCat: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  productPriceCol: { alignItems: 'flex-end', gap: 2 },
  productPrice: {
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    fontSize: 14,
  },
  productOld: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
