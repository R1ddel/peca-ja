import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveMerchantApplication } from '@/utils/partners';
import { getShopByApplicationId } from '@/utils/merchantShop';
import {
  MerchantPromo,
  deletePromo,
  formatPromoSummary,
  listPromosByApplication,
  promoTypeLabel,
  setPromoActive,
} from '@/utils/merchantPromos';
import { theme } from '@/constants/theme';

export default function MerchantPromosScreen() {
  const { user } = useAuth();
  const [promos, setPromos] = useState<MerchantPromo[]>([]);
  const [shopName, setShopName] = useState('');

  const refresh = useCallback(async () => {
    const app = await resolveMerchantApplication(user?.email);
    if (!app) {
      setPromos([]);
      return;
    }
    const shop = await getShopByApplicationId(app.id);
    setShopName(shop?.name ?? app.businessName);
    setPromos(await listPromosByApplication(app.id));
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function toggle(p: MerchantPromo, active: boolean) {
    await setPromoActive(p.id, active);
    await refresh();
  }

  function confirmDelete(p: MerchantPromo) {
    Alert.alert('Excluir promoção', `Remover “${p.title}”?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deletePromo(p.id);
            await refresh();
          })();
        },
      },
    ]);
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Promoções" fallbackHref="/merchant" />

      <View style={styles.banner}>
        <Ionicons name="wallet-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.bannerText}>
          Cupons, descontos e frete grátis saem do bolso de{' '}
          <Text style={styles.bannerBold}>{shopName || 'sua loja'}</Text>. A
          plataforma não banca esses benefícios.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => router.push('/merchant/promos/form' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.createBtnText}>Nova promoção</Text>
      </TouchableOpacity>

      <FlatList
        data={promos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetag-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma promoção ainda</Text>
            <Text style={styles.emptyText}>
              Crie frete grátis, cupom de desconto ou % off para atrair mais pedidos.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.active && styles.cardOff]}
            onPress={() =>
              router.push({
                pathname: '/merchant/promos/form' as any,
                params: { promoId: item.id },
              })
            }
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{promoTypeLabel(item.type)}</Text>
              </View>
              <Switch
                value={item.active}
                onValueChange={(v) => void toggle(item, v)}
                trackColor={{ false: '#D1D5DB', true: theme.colors.primaryLight }}
                thumbColor={item.active ? theme.colors.primary : '#f4f3f4'}
              />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSummary}>{formatPromoSummary(item)}</Text>
            <View style={styles.metaRow}>
              {item.code ? (
                <Text style={styles.meta}>Cupom · {item.code}</Text>
              ) : (
                <Text style={styles.meta}>Automática no checkout</Text>
              )}
              <Text style={styles.meta}>
                {item.redemptionCount} uso{item.redemptionCount === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.cardActions}>
              <Text style={styles.editHint}>Editar</Text>
              <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  banner: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'flex-start',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.text,
  },
  bannerBold: { fontWeight: theme.fontWeight.bold },
  createBtn: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: theme.fontWeight.bold,
  },
  list: { padding: theme.spacing.md, paddingBottom: 40 },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  cardOff: { opacity: 0.65 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primaryDark,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  cardSummary: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  meta: { fontSize: 12, color: theme.colors.textMuted },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  editHint: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
});
