import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { categoryConfig, theme, BusinessCategory } from '@/constants/theme';
import { getPromoBanners, formatPrice, getAllBusinesses } from '@/data/businesses';
import { hydratePartnerShops } from '@/utils/merchantShop';
import { getBusinessLogoSource } from '@/utils/businessLogos';
import { Business } from '@/types';
import { useDemoLocation } from '@/hooks/useDemoLocation';

const CAT_ORDER: (BusinessCategory | 'todos')[] = [
  'todos',
  'restaurante',
  'mercado',
  'farmacia',
  'padaria',
  'bebidas',
];

/**
 * Home do cliente Peça Já (dados reais) — só para a tela do iPhone na abertura.
 */
export function IntroRealHome() {
  const [catalog, setCatalog] = useState<Business[]>(() => getAllBusinesses());
  const { version } = useDemoLocation();

  useEffect(() => {
    void hydratePartnerShops().then(() => setCatalog(getAllBusinesses()));
  }, [version]);

  const openCount = useMemo(() => catalog.filter((b) => b.isOpen).length, [catalog]);
  const shops = useMemo(
    () =>
      [...catalog]
        .filter((b) => b.isOpen)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 4),
    [catalog]
  );
  const banner = useMemo(() => getPromoBanners()[0], [version]);

  return (
    <View style={styles.root}>
      <View style={styles.islandPad} />

      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <View style={styles.statusRight}>
          <Ionicons name="cellular" size={10} color={theme.colors.text} />
          <Ionicons name="wifi" size={10} color={theme.colors.text} />
          <Ionicons name="battery-full" size={12} color={theme.colors.text} />
        </View>
      </View>

      <View style={styles.brandRow}>
        <View style={styles.logoCircle}>
          <Ionicons name="bag-handle" size={14} color={theme.colors.primary} />
        </View>
        <Text style={styles.logoName}>Peça Já</Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="heart-outline" size={15} color={theme.colors.primary} />
      </View>

      <Text style={styles.hello}>Olá, bem-vindo</Text>
      <Text style={styles.helloSub}>{openCount} comércios abertos perto de você</Text>

      <View style={styles.locationChip}>
        <Ionicons name="location" size={10} color={theme.colors.primary} />
        <Text style={styles.locationText} numberOfLines={1}>
          Ativar localização
        </Text>
        <Ionicons name="chevron-down" size={9} color={theme.colors.textMuted} />
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={12} color={theme.colors.textMuted} />
        <Text style={styles.searchPh} numberOfLines={1}>
          Buscar restaurantes, mercados, farmácias...
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cats}
      >
        {CAT_ORDER.map((key) => {
          const cfg =
            key === 'todos'
              ? { label: 'Todos', icon: 'grid', color: theme.colors.primary }
              : categoryConfig[key];
          const on = key === 'todos';
          return (
            <View
              key={key}
              style={[
                styles.cat,
                on && { backgroundColor: cfg.color, borderColor: cfg.color },
              ]}
            >
              <Ionicons name={cfg.icon as any} size={11} color={on ? '#fff' : cfg.color} />
              <Text style={[styles.catLabel, on && styles.catLabelOn]} numberOfLines={1}>
                {cfg.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {banner ? (
        <View style={styles.banner}>
          <Image source={{ uri: banner.image }} style={styles.bannerImg} />
          <LinearGradient
            colors={['transparent', banner.color + 'EE']}
            style={styles.bannerGrad}
          >
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {banner.title}
            </Text>
            <Text style={styles.bannerSub} numberOfLines={1}>
              {banner.subtitle}
            </Text>
          </LinearGradient>
        </View>
      ) : null}

      <Text style={styles.section}>Perto de você</Text>

      {shops.map((b) => {
        const cat = categoryConfig[b.category];
        return (
          <View key={b.id} style={styles.shop}>
            <Image
              source={getBusinessLogoSource({
                name: b.name,
                category: b.category,
                image: b.image,
              })}
              style={styles.shopImg}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.shopName} numberOfLines={1}>
                {b.name}
              </Text>
              <Text style={styles.shopMeta} numberOfLines={1}>
                ★ {b.rating.toFixed(1)} · {b.deliveryTime} · {formatPrice(b.deliveryFee)}
              </Text>
              <Text style={styles.shopCat} numberOfLines={1}>
                {cat.label}
              </Text>
            </View>
          </View>
        );
      })}

      <View style={styles.tabBar}>
        {(
          [
            { icon: 'home', label: 'Início', on: true },
            { icon: 'search', label: 'Busca', on: false },
            { icon: 'receipt-outline', label: 'Pedidos', on: false },
            { icon: 'person-outline', label: 'Perfil', on: false },
          ] as const
        ).map((t) => (
          <View key={t.label} style={styles.tabItem}>
            <Ionicons
              name={t.icon as any}
              size={14}
              color={t.on ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[styles.tabLabel, t.on && styles.tabLabelOn]}>{t.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  islandPad: { height: 16 },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    paddingHorizontal: 2,
  },
  statusTime: { fontSize: 9, fontWeight: '700', color: theme.colors.text },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  logoCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoName: {
    fontSize: 14,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.primaryDark,
    letterSpacing: -0.3,
  },
  hello: {
    fontSize: 14,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  helloSub: {
    fontSize: 8.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
    marginBottom: 5,
  },
  locationChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  locationText: { fontSize: 8.5, color: theme.colors.text, fontWeight: '600' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.surface,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  searchPh: { flex: 1, fontSize: 8.5, color: theme.colors.textMuted },
  cats: { gap: 4, paddingBottom: 6 },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginRight: 4,
  },
  catLabel: { fontSize: 8, fontWeight: '600', color: theme.colors.text },
  catLabelOn: { color: '#fff' },
  banner: {
    height: 56,
    borderRadius: 11,
    overflow: 'hidden',
    marginBottom: 6,
    backgroundColor: theme.colors.borderLight,
  },
  bannerImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bannerGrad: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 7,
  },
  bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 10 },
  bannerSub: { color: 'rgba(255,255,255,0.92)', fontSize: 7.5, marginTop: 1 },
  section: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: 5,
  },
  shop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 11,
    padding: 5,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  shopImg: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: theme.colors.borderLight,
  },
  shopName: { fontSize: 9.5, fontWeight: '700', color: theme.colors.text },
  shopMeta: { fontSize: 7.5, color: theme.colors.textMuted, marginTop: 1 },
  shopCat: { fontSize: 7, color: theme.colors.primary, marginTop: 1, fontWeight: '600' },
  tabBar: {
    marginTop: 'auto',
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
    paddingTop: 5,
    paddingBottom: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 1 },
  tabLabel: { fontSize: 6.5, color: theme.colors.textMuted, fontWeight: '600' },
  tabLabelOn: { color: theme.colors.primary },
});
