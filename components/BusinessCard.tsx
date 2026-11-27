import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Business } from '@/types';
import { categoryConfig } from '@/constants/theme';
import { theme } from '@/constants/theme';
import { formatPrice } from '@/data/businesses';
import { MERCHANT_PLANS, TOP_MERCHANT_PLAN } from '@/constants/plans';
import { useFavorites } from '@/context/FavoritesContext';
import { getBusinessHours } from '@/utils/businessHours';
import {
  getBusinessLogoSource,
  getBusinessProductCoverSource,
} from '@/utils/businessLogos';
import { isMobileWidth } from '@/utils/mobileLayout';

interface BusinessCardProps {
  business: Business;
  /** default = lista; grid = 2 colunas; tile = carrossel clássico; featured/catalog = vitrine */
  variant?: 'default' | 'compact' | 'grid' | 'tile' | 'featured' | 'catalog';
  /** Índice na lista — atrasa a entrada em cascata (leve). */
  index?: number;
}

function promoBadgeLabel(business: Business): string | null {
  if (business.deliveryFee === 0) return 'Frete grátis';
  const promoItem = business.menu?.find((m) => m.promo != null && m.promo < m.price);
  if (promoItem && promoItem.promo != null && promoItem.price > 0) {
    const pct = Math.round((1 - promoItem.promo / promoItem.price) * 100);
    if (pct >= 5 && pct <= 70) return `${pct}% OFF`;
  }
  if (business.plan === TOP_MERCHANT_PLAN) return MERCHANT_PLANS.destaque.badge;
  return null;
}

export function BusinessCard({ business, variant = 'default', index = 0 }: BusinessCardProps) {
  const category = categoryConfig[business.category];
  const { width: screenW } = useWindowDimensions();
  const isMobile = isMobileWidth(screenW);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const { isBusinessFavorite, toggleBusiness } = useFavorites();
  const favored = isBusinessFavorite(business.id);

  const gridGap = theme.spacing.sm;
  const gridPad = theme.spacing.md;
  const gridWidth = (screenW - gridPad * 2 - gridGap) / 2;
  const tileWidth = isMobile
    ? Math.min(148, Math.max(132, screenW * 0.4))
    : Math.min(160, screenW * 0.42);
  const featuredWidth = isMobile
    ? Math.min(268, Math.max(240, screenW * 0.82))
    : Math.min(280, screenW * 0.78);
  const catalogWidth = isMobile
    ? Math.min(156, Math.max(140, screenW * 0.42))
    : Math.min(168, screenW * 0.44);

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);

    const delay = Math.min(index, 12) * 40;
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    anim.start();
    return () => anim.stop();
  }, [business.id, index, opacity, translateY]);

  const coverSource = getBusinessProductCoverSource({
    name: business.name,
    category: business.category,
    image: business.image,
    coverImage: business.coverImage,
    menu: business.menu,
  });
  const logoSource = getBusinessLogoSource({
    name: business.name,
    category: business.category,
    image: business.image,
  });

  const go = () => router.push(`/business/${business.id}`);
  const feeLabel =
    business.deliveryFee === 0 ? 'Frete grátis' : `A partir de ${formatPrice(business.deliveryFee)}`;

  if (variant === 'featured') {
    const badge = promoBadgeLabel(business);
    return (
      <Animated.View style={[{ opacity, transform: [{ translateY }], width: featuredWidth }]}>
        <TouchableOpacity
          style={styles.featuredCard}
          activeOpacity={0.92}
          onPress={go}
          accessibilityRole="button"
          accessibilityLabel={`${business.name}, destaque`}
        >
          <View style={[styles.featuredImageWrap, isMobile && styles.featuredImageWrapMobile]}>
            <Image
              source={coverSource}
              style={styles.featuredImage}
              resizeMode="cover"
              defaultSource={require('../assets/merchants/logos/shops/_default.png')}
            />
            {badge ? (
              <View style={styles.featuredPromo}>
                <Ionicons name="flame" size={11} color={theme.colors.white} />
                <Text style={styles.featuredPromoText}>{badge}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.featuredHeart}
              onPress={(e) => {
                e.stopPropagation?.();
                void toggleBusiness(business.id);
              }}
              hitSlop={8}
              accessibilityLabel={favored ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Ionicons
                name={favored ? 'heart' : 'heart-outline'}
                size={16}
                color={favored ? theme.colors.error : theme.colors.white}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.featuredBottom, isMobile && styles.featuredBottomMobile]}>
            <Image source={logoSource} style={[styles.featuredLogo, isMobile && styles.featuredLogoMobile]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.featuredName, isMobile && styles.featuredNameMobile]} numberOfLines={1}>
                {business.name}
              </Text>
              <View style={styles.featuredMetaRow}>
                <Ionicons name="star" size={12} color={theme.colors.accent} />
                <Text style={styles.featuredMeta}>{business.rating}</Text>
                <Text style={styles.featuredDot}>·</Text>
                <Text style={styles.featuredMeta} numberOfLines={1}>
                  {business.deliveryTime}
                </Text>
              </View>
              <Text style={styles.featuredFee} numberOfLines={1}>
                {feeLabel}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (variant === 'catalog') {
    return (
      <Animated.View style={[{ opacity, transform: [{ translateY }], width: catalogWidth }]}>
        <TouchableOpacity
          style={[styles.catalogCard, isMobile && styles.catalogCardMobile]}
          activeOpacity={0.9}
          onPress={go}
          accessibilityRole="button"
          accessibilityLabel={`${business.name}, ${category.label}`}
        >
          <View style={[styles.catalogImageWrap, isMobile && styles.catalogImageWrapMobile]}>
            <Image
              source={coverSource}
              style={styles.catalogImage}
              resizeMode="cover"
              defaultSource={require('../assets/merchants/logos/shops/_default.png')}
            />
          </View>
          <View style={styles.catalogInfoRow}>
            <Image source={logoSource} style={[styles.catalogLogo, isMobile && styles.catalogLogoMobile]} />
            <View style={styles.catalogInfoText}>
              <Text style={styles.catalogName} numberOfLines={1}>
                {business.name}
              </Text>
              <Text style={styles.catalogCat} numberOfLines={1}>
                {category.label}
              </Text>
              <View style={styles.catalogStatusRow}>
                <View
                  style={[
                    styles.catalogDot,
                    {
                      backgroundColor: business.isOpen
                        ? theme.colors.primary
                        : theme.colors.textMuted,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.catalogStatus,
                    !business.isOpen && { color: theme.colors.textMuted },
                  ]}
                >
                  {business.isOpen ? 'Aberto' : 'Fechado'}
                </Text>
                <Text style={styles.catalogDotSep}>·</Text>
                <Ionicons name="star" size={11} color={theme.colors.accent} />
                <Text style={styles.catalogRating}>{business.rating}</Text>
              </View>
              <Text style={styles.catalogTime} numberOfLines={1}>
                {business.deliveryTime} · {feeLabel}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  const isGrid = variant === 'grid';
  const isTile = variant === 'tile';
  const isCompact = variant === 'compact';
  const dense = isGrid || isTile;

  return (
    <Animated.View
      style={[
        { opacity, transform: [{ translateY }] },
        isGrid && { width: gridWidth },
        isTile && { width: tileWidth },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.card,
          isCompact && styles.compact,
          dense && styles.denseCard,
          isTile && styles.tileCard,
        ]}
        activeOpacity={0.85}
        onPress={go}
        accessibilityRole="button"
        accessibilityLabel={`${business.name}, nota ${business.rating}`}
      >
        <View style={[styles.imageContainer, dense && styles.denseImageWrap]}>
          <Image
            source={coverSource}
            style={[
              styles.image,
              dense && styles.denseImage,
              isCompact && styles.compactImage,
            ]}
            resizeMode="cover"
            defaultSource={require('../assets/merchants/logos/shops/_default.png')}
          />
          {!business.isOpen && (
            <View style={styles.closedBadge}>
              <Text style={[styles.closedText, dense && styles.closedTextDense]}>
                Fechado · {getBusinessHours(business)}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.favBtn, dense && styles.favBtnDense]}
            onPress={(e) => {
              e.stopPropagation?.();
              void toggleBusiness(business.id);
            }}
            hitSlop={8}
            accessibilityLabel={favored ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Ionicons
              name={favored ? 'heart' : 'heart-outline'}
              size={dense ? 14 : 18}
              color={favored ? theme.colors.error : theme.colors.white}
            />
          </TouchableOpacity>
          {!dense && (
            <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
              <Ionicons name={category.icon as keyof typeof Ionicons.glyphMap} size={12} color="#fff" />
            </View>
          )}
          {business.plan === TOP_MERCHANT_PLAN && (
            <View style={[styles.planBadge, dense && styles.planBadgeDense]}>
              <Ionicons name="diamond" size={dense ? 8 : 10} color="#fff" />
              {!dense && (
                <Text style={styles.planBadgeText}>{MERCHANT_PLANS.destaque.badge}</Text>
              )}
            </View>
          )}
        </View>

        <View style={[styles.content, dense && styles.denseContent]}>
          <View style={styles.infoRow}>
            <Image source={logoSource} style={[styles.infoLogo, dense && styles.infoLogoDense]} />
            <View style={styles.infoTextCol}>
              <Text style={[styles.name, dense && styles.denseName]} numberOfLines={dense ? 2 : 1}>
                {business.name}
              </Text>
              {!dense && (
                <Text style={styles.description} numberOfLines={1}>
                  {business.description}
                </Text>
              )}

              <View style={[styles.metaRow, dense && styles.denseMetaRow]}>
                <View style={styles.rating}>
                  <Ionicons name="star" size={dense ? 11 : 14} color={theme.colors.accent} />
                  <Text style={[styles.ratingText, dense && styles.denseMetaText]}>
                    {business.rating}
                  </Text>
                </View>
                <Text style={styles.dot}>·</Text>
                <Text style={[styles.meta, dense && styles.denseMetaText]} numberOfLines={1}>
                  {business.deliveryTime.replace(' min', "'")}
                </Text>
              </View>

              <Text style={[styles.deliveryFee, dense && styles.denseFee]} numberOfLines={1}>
                {feeLabel}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
    overflow: 'visible',
  },
  denseCard: {
    marginBottom: 0,
    borderRadius: theme.radius.md,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'visible',
  },
  tileCard: {
    marginRight: 0,
  },
  compact: {
    flexDirection: 'row',
    height: 100,
  },
  imageContainer: {
    position: 'relative',
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: 0,
  },
  denseImageWrap: {
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    overflow: 'hidden',
    marginBottom: 0,
  },
  image: {
    width: '100%',
    height: 152,
    backgroundColor: theme.colors.borderLight,
  },
  denseImage: {
    height: 100,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.borderLight,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  infoLogoDense: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  infoTextCol: {
    flex: 1,
    minWidth: 0,
  },
  compactImage: {
    width: 100,
    height: 100,
  },
  closedBadge: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.lg,
  },
  closedTextDense: {
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  favBtn: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  favBtnDense: {
    width: 26,
    height: 26,
    borderRadius: 13,
    bottom: 6,
    right: 6,
  },
  categoryBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  planBadgeDense: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    right: 6,
    top: 6,
  },
  planBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
  },
  content: {
    padding: theme.spacing.md,
  },
  denseContent: {
    padding: 10,
    minHeight: 78,
  },
  name: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  denseName: {
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
    marginBottom: 2,
    minHeight: 0,
  },
  description: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  denseMetaRow: {
    marginBottom: 4,
    flexWrap: 'nowrap',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  denseMetaText: {
    fontSize: 11,
  },
  dot: {
    color: theme.colors.textMuted,
    marginHorizontal: 4,
    fontSize: theme.fontSize.xs,
  },
  meta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  deliveryFee: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  denseFee: {
    fontSize: 11,
  },

  featuredCard: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    ...theme.shadow.card,
  },
  featuredImageWrap: {
    height: 150,
    position: 'relative',
    backgroundColor: theme.colors.borderLight,
  },
  featuredImageWrapMobile: {
    height: 132,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredPromo: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  featuredPromoText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.white,
  },
  featuredHeart: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  featuredBottomMobile: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  featuredLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.borderLight,
  },
  featuredLogoMobile: {
    width: 40,
    height: 40,
    borderRadius: 11,
  },
  featuredName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  featuredNameMobile: {
    fontSize: 14,
  },
  featuredMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  featuredMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  featuredDot: {
    color: theme.colors.textMuted,
  },
  featuredFee: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  catalogCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadow.card,
  },
  catalogCardMobile: {
    padding: 8,
  },
  catalogImageWrap: {
    width: '100%',
    height: 118,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.colors.borderLight,
    marginBottom: 10,
  },
  catalogImageWrapMobile: {
    height: 104,
    borderRadius: 12,
    marginBottom: 8,
  },
  catalogImage: {
    width: '100%',
    height: '100%',
  },
  catalogInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  catalogLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.borderLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catalogLogoMobile: {
    width: 32,
    height: 32,
    borderRadius: 9,
  },
  catalogInfoText: {
    flex: 1,
    minWidth: 0,
  },
  catalogName: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 1,
  },
  catalogCat: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  catalogStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  catalogDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  catalogStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  catalogDotSep: {
    color: theme.colors.textMuted,
    marginHorizontal: 2,
  },
  catalogRating: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  catalogTime: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
