import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BackHeader } from '@/components/BackHeader';
import { MenuItemCard } from '@/components/MenuItemCard';
import { AddonPickerModal } from '@/components/AddonPickerModal';
import { MenuItemDetailModal } from '@/components/MenuItemDetailModal';
import { FloatingCartButton } from '@/components/FloatingCartButton';
import { BusinessReviewsPanel } from '@/components/BusinessReviewsPanel';
import { getBusinessById, formatPrice } from '@/data/businesses';
import { getUserPlaceDetails } from '@/services/permissions';
import { getSimulatedCityLabel } from '@/utils/demoLocation';
import { sameOperatingCity } from '@/utils/operatingCity';
import { classifyMenuSection, menuSectionsFor } from '@/utils/menuSections';
import { MERCHANT_PLANS } from '@/constants/plans';
import { useCart } from '@/context/CartContext';
import { useReviews } from '@/context/ReviewsContext';
import { useFavorites } from '@/context/FavoritesContext';
import { categoryConfig, theme } from '@/constants/theme';
import { MenuItem, SelectedAddon } from '@/types';
import { getClosedBannerText, getOpenBadgeText } from '@/utils/businessHours';
import { getBusinessCoverSource, getBusinessLogoSource } from '@/utils/businessLogos';
import { paymentSummary } from '@/utils/paymentMethods';
import { useMerchantShopRevision } from '@/hooks/useMerchantShopRevision';

type MainTab = 'cardapio' | 'avaliacoes';

export default function BusinessScreen() {
  const { id, tab, itemId, from, q } = useLocalSearchParams<{
    id: string;
    tab?: string;
    itemId?: string;
    from?: string;
    q?: string;
  }>();
  const shopRevision = useMerchantShopRevision();
  const business = useMemo(() => getBusinessById(id ?? ''), [id, shopRevision]);
  const { addItem, decreaseItem, getItemQuantity } = useCart();
  const { getAverageForBusiness } = useReviews();
  const { isBusinessFavorite, toggleBusiness, isDishFavorite, toggleDish } = useFavorites();
  const [mainTab, setMainTab] = useState<MainTab>(tab === 'avaliacoes' ? 'avaliacoes' : 'cardapio');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('Todos');
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [openedFromSearch, setOpenedFromSearch] = useState(false);
  const [customerCity, setCustomerCity] = useState(() => getSimulatedCityLabel());

  useEffect(() => {
    void getUserPlaceDetails()
      .then((place) => setCustomerCity(getSimulatedCityLabel(place?.city)))
      .catch(() => undefined);
  }, []);

  const outsideCity =
    !!business?.city &&
    !!customerCity &&
    customerCity.toLowerCase() !== 'sua cidade' &&
    !sameOperatingCity(business.city, customerCity);

  const liveRating = business ? getAverageForBusiness(business.id) : { average: 0, count: 0 };

  // Abre direto o item clicado na busca (detalhe do prato/produto).
  // Depende só de id/itemId (params estáveis) — getBusinessById recria o objeto
  // a cada render e [business] causava "Maximum update depth exceeded".
  useEffect(() => {
    const bizId = Array.isArray(id) ? id[0] : id;
    const targetItemId = Array.isArray(itemId) ? itemId[0] : itemId;
    if (!bizId || !targetItemId) return;
    const biz = getBusinessById(bizId);
    if (!biz) return;
    const item = biz.menu.find((m) => m.id === targetItemId);
    if (!item) return;
    setMainTab('cardapio');
    setSelectedMenuCategory(classifyMenuSection(biz.category, item));
    setDetailItem(item);
    setOpenedFromSearch(true);
  }, [id, itemId]);

  const searchQuery = typeof q === 'string' ? q.trim() : '';
  const fromParam = typeof from === 'string' ? from : Array.isArray(from) ? from[0] : '';
  const cameFromHome = fromParam === 'home';
  const cameFromSearch = fromParam === 'search' || (!cameFromHome && (openedFromSearch || !!searchQuery));
  const cameFromConveniencia = fromParam === 'conveniencia';
  const cameFromFavorites = fromParam === 'favorites';

  const backFallbackHref = cameFromConveniencia
    ? '/conveniencia'
    : cameFromFavorites
      ? '/favorites'
    : cameFromHome
      ? '/(tabs)'
      : cameFromSearch
        ? '/(tabs)/search'
        : '/(tabs)';
  const backFallbackParams =
    cameFromSearch && !cameFromHome && searchQuery ? { q: searchQuery } : undefined;

  const sectionOf = useCallback(
    (item: { name?: string; description?: string; details?: string; category?: string }) =>
      classifyMenuSection(business?.category, item),
    [business?.category]
  );

  const menuCategories = useMemo(() => {
    if (!business) return [];
    const present = new Set(business.menu.map((item) => sectionOf(item)));
    const ordered = menuSectionsFor(business.category).filter((section) => present.has(section));
    const extra = [...present].filter((section) => !ordered.includes(section));
    const cats = [...ordered, ...extra];
    if (business.sellsDrinks && cats.includes('Bebidas')) {
      const rest = cats.filter((section) => section !== 'Bebidas');
      return ['Todos', 'Bebidas', ...rest];
    }
    return ['Todos', ...cats];
  }, [business, sectionOf]);

  const foodItems = useMemo(() => {
    if (!business) return [];
    return business.menu.filter((item) => sectionOf(item) !== 'Bebidas');
  }, [business, sectionOf]);

  const drinkItems = useMemo(() => {
    if (!business) return [];
    return business.menu.filter((item) => sectionOf(item) === 'Bebidas');
  }, [business, sectionOf]);

  const filteredMenu = useMemo(() => {
    if (!business) return [];
    if (selectedMenuCategory === 'Todos') return business.menu;
    return business.menu.filter((item) => sectionOf(item) === selectedMenuCategory);
  }, [business, selectedMenuCategory, sectionOf]);

  const handleAdd = (item: MenuItem) => {
    if (outsideCity || !business) return;
    if (!item.addonGroups?.length) {
      addItem(item, business.id, business.name, [], '');
      router.push('/cart');
      return;
    }
    setCustomizing(item);
  };

  const handleConfirmAddons = (addons: SelectedAddon[], note: string) => {
    if (!business || !customizing || outsideCity) return;
    addItem(customizing, business.id, business.name, addons, note);
    setCustomizing(null);
    router.push('/cart');
  };

  if (!business) {
    return (
      <View style={styles.screen}>
        <BackHeader
          title="Comércio"
          variant="brand"
          fallbackHref={
            cameFromConveniencia
              ? '/conveniencia'
              : cameFromSearch
                ? '/(tabs)/search'
                : '/(tabs)'
          }
          fallbackParams={backFallbackParams}
        />
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.notFoundText}>Comércio não encontrado</Text>
        </View>
      </View>
    );
  }

  const category = categoryConfig[business.category];
  const showGroupedTodos =
    selectedMenuCategory === 'Todos' && business.sellsDrinks && drinkItems.length > 0;

  const renderCard = (item: MenuItem) => (
    <MenuItemCard
      key={item.id}
      item={item}
      quantity={getItemQuantity(item.id)}
      hasAddons={!!item.addonGroups?.length}
      onAdd={() => handleAdd(item)}
      onRemove={() => decreaseItem(item.id)}
      disabled={!business.isOpen || outsideCity}
      favorite={isDishFavorite(business.id, item.id)}
      onToggleFavorite={() => void toggleDish(business.id, item.id)}
      onPressImage={() => setDetailItem(item)}
    />
  );

  return (
    <View style={styles.screen}>
      <BackHeader
        title={business.name}
        variant="brand"
        preferFallback={cameFromSearch || cameFromConveniencia}
        fallbackHref={backFallbackHref}
        fallbackParams={backFallbackParams}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.coverContainer}>
          <Image
            source={getBusinessCoverSource({
              name: business.name,
              category: business.category,
              image: business.image,
              coverImage: business.coverImage,
            })}
            style={styles.cover}
            resizeMode="cover"
          />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.coverGradient} />
          {!business.isOpen && (
            <View style={styles.closedOverlay}>
              <Text style={styles.closedText}>Fechado no momento</Text>
              <Text style={styles.closedHours}>{getOpenBadgeText(business)}</Text>
            </View>
          )}
        </View>

        {!business.isOpen && (
          <View style={styles.closedBanner}>
            <Ionicons name="time-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.closedBannerText}>{getClosedBannerText(business)}</Text>
          </View>
        )}

        {outsideCity ? (
          <View style={styles.closedBanner}>
            <Ionicons name="location-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.closedBannerText}>
              {business.name} só atende em {business.city}. Você está em {customerCity}.
            </Text>
          </View>
        ) : null}

        <View style={[styles.infoCard, !business.isOpen && styles.infoCardAfterBanner]}>
          <View style={styles.infoHeader}>
            <Image
              source={getBusinessLogoSource({
                name: business.name,
                category: business.category,
                image: business.image,
              })}
              style={styles.logo}
            />
            <View style={styles.infoText}>
              <Text style={styles.name}>{business.name}</Text>
              <Text style={styles.description}>{business.description}</Text>
              <Text
                style={[
                  styles.openBadge,
                  !business.isOpen && styles.openBadgeClosed,
                ]}
              >
                {getOpenBadgeText(business)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.favHeaderBtn}
              onPress={() => void toggleBusiness(business.id)}
              accessibilityLabel="Favoritar comércio"
            >
              <Ionicons
                name={isBusinessFavorite(business.id) ? 'heart' : 'heart-outline'}
                size={24}
                color={
                  isBusinessFavorite(business.id) ? theme.colors.error : theme.colors.textMuted
                }
              />
            </TouchableOpacity>
          </View>

          <View style={styles.metaGrid}>
            <MetaItem
              icon="star"
              label={`${
                liveRating.count > 0 ? liveRating.average.toFixed(1) : business.rating
              } (${liveRating.count > 0 ? liveRating.count : business.reviewCount})`}
              color={theme.colors.accent}
            />
            <MetaItem icon="time-outline" label={business.deliveryTime} />
            <MetaItem icon="bicycle-outline" label={business.deliveryFee === 0 ? 'Grátis' : formatPrice(business.deliveryFee)} />
            <MetaItem icon="location-outline" label={business.distance} />
          </View>
          <Text style={styles.payLine}>
            Aceita {paymentSummary(business.acceptedPayments, business.deliveryBy)}
          </Text>

          <View style={styles.tags}>
            <View style={[styles.categoryTag, { backgroundColor: category.color + '20' }]}>
              <Ionicons name={category.icon as keyof typeof Ionicons.glyphMap} size={14} color={category.color} />
              <Text style={[styles.categoryTagText, { color: category.color }]}>{category.label}</Text>
            </View>
            <View style={styles.planTag}>
              <Ionicons name="diamond-outline" size={14} color={theme.colors.primaryDark} />
              <Text style={styles.planTagText}>
                Plano {MERCHANT_PLANS[business.plan].label}
              </Text>
            </View>
            {business.sellsDrinks && (
              <View style={styles.drinksTag}>
                <Ionicons name="wine-outline" size={14} color={theme.colors.primaryDark} />
                <Text style={styles.drinksTagText}>Vende bebidas</Text>
              </View>
            )}
            {business.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.mainTabs}>
          <TouchableOpacity
            style={[styles.mainTab, mainTab === 'cardapio' && styles.mainTabActive]}
            onPress={() => setMainTab('cardapio')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="restaurant-outline"
              size={18}
              color={mainTab === 'cardapio' ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[styles.mainTabText, mainTab === 'cardapio' && styles.mainTabTextActive]}>
              Cardápio
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainTab, mainTab === 'avaliacoes' && styles.mainTabActive]}
            onPress={() => setMainTab('avaliacoes')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="star-outline"
              size={18}
              color={mainTab === 'avaliacoes' ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text
              style={[styles.mainTabText, mainTab === 'avaliacoes' && styles.mainTabTextActive]}
            >
              Avaliações
            </Text>
            {liveRating.count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{liveRating.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {mainTab === 'avaliacoes' ? (
          <View style={styles.menuSection}>
            <BusinessReviewsPanel businessId={business.id} businessName={business.name} />
          </View>
        ) : (
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Cardápio</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.menuCategories}>
            {menuCategories.map((cat) => {
              const isDrinks = cat === 'Bebidas';
              const active = selectedMenuCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.menuCatChip,
                    active && styles.menuCatChipActive,
                    isDrinks && !active && styles.menuCatChipDrinks,
                  ]}
                  onPress={() => setSelectedMenuCategory(cat)}
                >
                  {isDrinks && (
                    <Ionicons
                      name="wine-outline"
                      size={14}
                      color={active ? theme.colors.white : theme.colors.primary}
                    />
                  )}
                  <Text style={[styles.menuCatText, active && styles.menuCatTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {showGroupedTodos ? (
            <>
              <Text style={styles.sectionLabel}>Pratos e mais</Text>
              {foodItems.map(renderCard)}

              <View style={styles.drinksBanner}>
                <Ionicons name="wine" size={22} color={theme.colors.primary} />
                <View style={styles.drinksBannerText}>
                  <Text style={styles.drinksBannerTitle}>Bebidas</Text>
                  <Text style={styles.drinksBannerSub}>
                    Complete seu pedido com sucos, refrigerantes e mais
                  </Text>
                </View>
              </View>
              {drinkItems.map(renderCard)}
            </>
          ) : (
            <>
              {selectedMenuCategory === 'Bebidas' && (
                <View style={styles.drinksBanner}>
                  <Ionicons name="wine" size={22} color={theme.colors.primary} />
                  <View style={styles.drinksBannerText}>
                    <Text style={styles.drinksBannerTitle}>Bebidas do cardápio</Text>
                    <Text style={styles.drinksBannerSub}>
                      Escolha tamanho e preferências nos adicionais
                    </Text>
                  </View>
                </View>
              )}
              {filteredMenu.map(renderCard)}
            </>
          )}
        </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {business.isOpen && mainTab === 'cardapio' && <FloatingCartButton />}

      <AddonPickerModal
        visible={!!customizing}
        item={customizing}
        onClose={() => setCustomizing(null)}
        onConfirm={handleConfirmAddons}
      />
      <MenuItemDetailModal
        visible={!!detailItem}
        item={detailItem}
        onClose={() => setDetailItem(null)}
        disabled={!business.isOpen || outsideCity}
        onAdd={
          detailItem
            ? () => {
                const item = detailItem;
                setDetailItem(null);
                handleAdd(item);
              }
            : undefined
        }
      />
    </View>
  );
}

function MetaItem({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color?: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={16} color={color ?? theme.colors.primary} />
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  notFoundText: { fontSize: theme.fontSize.lg, color: theme.colors.textSecondary },
  coverContainer: { position: 'relative', height: 220 },
  cover: { width: '100%', height: '100%' },
  coverGradient: { ...StyleSheet.absoluteFillObject },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedText: { color: theme.colors.white, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold },
  closedHours: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: theme.fontSize.sm,
    marginTop: 6,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  closedBannerText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    marginTop: -theme.spacing.xl,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    ...theme.shadow.card,
  },
  infoCardAfterBanner: {
    marginTop: theme.spacing.sm,
  },
  infoHeader: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md, alignItems: 'flex-start' },
  favHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.borderLight,
  },
  logo: { width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: theme.colors.borderLight },
  infoText: { flex: 1 },
  name: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  description: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 4 },
  openBadge: {
    marginTop: 6,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  openBadgeClosed: {
    color: theme.colors.warning,
  },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, marginBottom: theme.spacing.sm },
  payLine: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.md,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '45%' },
  metaLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  categoryTagText: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold },
  drinksTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  drinksTagText: { fontSize: theme.fontSize.xs, color: theme.colors.primaryDark, fontWeight: theme.fontWeight.semibold },
  planTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  planTagText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    fontWeight: theme.fontWeight.semibold,
  },
  tag: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  tagText: { fontSize: theme.fontSize.xs, color: theme.colors.primaryDark },
  mainTabs: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
  },
  mainTabActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  mainTabText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.medium,
  },
  mainTabTextActive: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.bold,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
  },
  menuSection: { paddingHorizontal: theme.spacing.md },
  menuTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  menuCategories: { marginBottom: theme.spacing.md },
  menuCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  menuCatChipDrinks: {
    borderColor: theme.colors.primaryMuted,
    backgroundColor: theme.colors.primaryLight,
  },
  menuCatChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  menuCatText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  menuCatTextActive: { color: theme.colors.white, fontWeight: theme.fontWeight.semibold },
  sectionLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  drinksBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
  },
  drinksBannerText: { flex: 1 },
  drinksBannerTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primaryDark,
  },
  drinksBannerSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
