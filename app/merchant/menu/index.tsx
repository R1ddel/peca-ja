import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveMerchantApplication } from '@/utils/partners';
import {
  MerchantShop,
  getShopByApplicationId,
  removeMenuItem,
  upsertMenuItem,
} from '@/utils/merchantShop';
import { seedPizzaMerchantCatalog } from '@/utils/seedPizzaMerchant';
import {
  PLATFORM_FEE_MERCHANT_NOTICE_FOOTER,
} from '@/constants/pricing';
import { formatPrice } from '@/data/businesses';
import { categoryConfig, theme } from '@/constants/theme';
import { MenuItem } from '@/types';

export default function MerchantMenuScreen() {
  const { user } = useAuth();
  const [appId, setAppId] = useState<string | null>(null);
  const [shop, setShop] = useState<MerchantShop | null>(null);
  const [seeding, setSeeding] = useState(false);

  const refresh = useCallback(async () => {
    const app = await resolveMerchantApplication(user?.email);
    if (!app) {
      setAppId(null);
      setShop(null);
      return;
    }
    setAppId(app.id);
    setShop(await getShopByApplicationId(app.id));
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function toggleAvailable(item: MenuItem, value: boolean) {
    if (!appId) return;
    const updated = await upsertMenuItem(appId, { ...item, available: value });
    if (updated) setShop(updated);
  }

  async function toggleConvenience(item: MenuItem, value: boolean) {
    if (!appId) return;
    const updated = await upsertMenuItem(appId, {
      ...item,
      convenience: value,
    });
    if (updated) setShop(updated);
  }

  function removeItem(item: MenuItem) {
    if (!appId) return;
    Alert.alert('Remover item?', item.name, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const updated = await removeMenuItem(appId, item.id);
            if (updated) setShop(updated);
          })();
        },
      },
    ]);
  }

  async function loadPizzaCatalog() {
    if (!appId || seeding) return;
    setSeeding(true);
    try {
      const result = await seedPizzaMerchantCatalog(appId);
      if (!result) {
        Alert.alert('Cardápio', 'Não foi possível carregar o cardápio.');
        return;
      }
      setShop(result.shop);
      Alert.alert(
        'Cardápio atualizado',
        `${result.menuCount} itens · ${result.promosCreated} promoção(ões) nova(s).\nCupons: PIZZA10, FRETEPIZZA, COMBO15, BEMVINDOPIZZA, NOITE10.`
      );
    } finally {
      setSeeding(false);
    }
  }

  const activeCount = shop?.menu.filter((m) => m.available !== false).length ?? 0;
  const pausedCount = (shop?.menu.length ?? 0) - activeCount;

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Cardápio" fallbackHref="/merchant" />

      <LinearGradient colors={[theme.colors.primaryLight, theme.colors.background]} style={styles.hero}>
        <Text style={styles.heroTitle}>Vitrine da loja</Text>
        <Text style={styles.heroSub}>
          {activeCount} à venda
          {pausedCount > 0 ? ` · ${pausedCount} pausado${pausedCount > 1 ? 's' : ''}` : ''}
        </Text>
        <View style={styles.heroActions}>
          <Button
            title="Adicionar item"
            onPress={() => router.push('/merchant/menu/form' as any)}
            size="md"
          />
          <Button
            title={seeding ? 'Carregando…' : 'Cardápio pizzaria'}
            onPress={() => void loadPizzaCatalog()}
            size="md"
            variant="outline"
            disabled={seeding}
          />
        </View>
      </LinearGradient>

      <FlatList
        data={shop?.menu ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="camera-outline" size={40} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>Cardápio vazio</Text>
            <Text style={styles.emptyText}>
              Adicione pratos com foto — é o que mais converte pedido no app.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const on = item.available !== false;
          return (
            <View style={[styles.card, !on && styles.cardOff]}>
              <Image source={{ uri: item.image }} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.price}>
                  {item.promo != null ? (
                    <>
                      <Text style={styles.promoPrice}>{formatPrice(item.promo)}</Text>
                      <Text style={styles.oldPrice}> {formatPrice(item.price)}</Text>
                    </>
                  ) : (
                    formatPrice(item.price)
                  )}
                </Text>
                <View style={styles.tags}>
                  <Text style={styles.cat}>{item.category}</Text>
                  {item.popular && (
                    <View style={styles.pop}>
                      <Text style={styles.popText}>Popular</Text>
                    </View>
                  )}
                  {!!item.convenience && (
                    <View style={styles.conv}>
                      <Text style={styles.convText}>Conveniência</Text>
                    </View>
                  )}
                  {!on && (
                    <View style={styles.pause}>
                      <Text style={styles.pauseText}>Pausado</Text>
                    </View>
                  )}
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{on ? 'À venda' : 'Pausado'}</Text>
                  <Switch
                    value={on}
                    onValueChange={(v) => void toggleAvailable(item, v)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primaryMuted }}
                    thumbColor={on ? theme.colors.primary : '#f4f4f4'}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Conveniência</Text>
                  <Switch
                    value={!!item.convenience}
                    onValueChange={(v) => void toggleConvenience(item, v)}
                    trackColor={{
                      false: theme.colors.border,
                      true: 'rgba(20,184,166,0.35)',
                    }}
                    thumbColor={
                      item.convenience ? categoryConfig.conveniencia.color : '#f4f4f4'
                    }
                  />
                </View>
              </View>
              <View>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/merchant/menu/form' as any,
                      params: { itemId: item.id },
                    })
                  }
                >
                  <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => removeItem(item)}>
                  <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          shop?.menu?.length ? (
            <View style={styles.feeFooter}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.feeFooterText}>{PLATFORM_FEE_MERCHANT_NOTICE_FOOTER}</Text>
              <Text style={styles.feeFooterTerms}>
                Detalhes no termo de compromisso (planos e cadastro).
              </Text>
            </View>
          ) : null
        }
      />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  hero: {
    marginHorizontal: theme.spacing.md,
    borderRadius: 22,
    padding: theme.spacing.md,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  heroSub: { marginTop: 4, color: theme.colors.textSecondary, fontSize: 13 },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  list: { padding: theme.spacing.md, paddingTop: 4, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle: { fontWeight: theme.fontWeight.bold, fontSize: 17, color: theme.colors.text },
  emptyText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 19,
  },
  feeFooter: {
    flexDirection: 'column',
    gap: 4,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  feeFooterText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  feeFooterTerms: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardOff: { opacity: 0.72 },
  thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: theme.colors.borderLight },
  name: { fontWeight: theme.fontWeight.bold, color: theme.colors.text, fontSize: 15 },
  price: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
    marginTop: 2,
  },
  promoPrice: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  oldPrice: {
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.regular,
    textDecorationLine: 'line-through',
    fontSize: 12,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cat: { fontSize: 11, color: theme.colors.textMuted },
  pop: {
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  popText: { fontSize: 10, color: '#B45309', fontWeight: theme.fontWeight.bold },
  conv: {
    backgroundColor: 'rgba(20,184,166,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  convText: {
    fontSize: 10,
    color: '#0F766E',
    fontWeight: theme.fontWeight.bold,
  },
  pause: {
    backgroundColor: theme.colors.errorLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  pauseText: { fontSize: 10, color: theme.colors.error, fontWeight: theme.fontWeight.bold },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  switchLabel: { fontSize: 12, color: theme.colors.textSecondary },
  iconBtn: { padding: 8 },
});
