import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { MobileShell } from '@/components/MobileShell';
import {
  MERCHANT_PLANS,
  MerchantPlan,
  formatPlanPrice,
  getNextPlan,
  isMerchantPlanId,
} from '@/constants/plans';
import { useAuth } from '@/context/AuthContext';
import { getUserPlaceDetails } from '@/services/permissions';
import { CityBrand, resolveCityBrand } from '@/utils/cityBrand';
import {
  normalizeRouteParam,
  resolveMerchantAppForRoute,
  setMerchantPlan,
} from '@/utils/partners';
import { theme } from '@/constants/theme';

export default function PartnerPlanDetailScreen() {
  const { id: idParam, plan: planParam } = useLocalSearchParams<{
    id?: string | string[];
    plan?: string | string[];
  }>();
  const { user } = useAuth();
  const planId: MerchantPlan = isMerchantPlanId(normalizeRouteParam(planParam))
    ? (normalizeRouteParam(planParam) as MerchantPlan)
    : 'crescimento';
  const plan = MERCHANT_PLANS[planId];
  const nextId = getNextPlan(planId);
  const nextPlan = nextId ? MERCHANT_PLANS[nextId] : null;

  const [appId, setAppId] = useState(() => normalizeRouteParam(idParam));
  const [brand, setBrand] = useState<CityBrand>(() => resolveCityBrand(null));
  const [operatingCity, setOperatingCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setResolving(true);
        setError('');
        try {
          const found = await resolveMerchantAppForRoute(idParam, user?.email);
          if (cancelled) return;
          if (found) {
            setAppId(found.id);
            if (found.city) setOperatingCity(found.city);
          } else {
            setAppId('');
          }
          const place = await getUserPlaceDetails();
          if (!cancelled) setBrand(resolveCityBrand(place?.city ?? found?.city));
        } catch {
          if (!cancelled) setBrand(resolveCityBrand(null));
        } finally {
          if (!cancelled) setResolving(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [idParam, user?.email])
  );

  useEffect(() => {
    const fromUrl = normalizeRouteParam(idParam);
    if (fromUrl && fromUrl !== appId) setAppId(fromUrl);
  }, [idParam, appId]);

  const priceDiff = useMemo(() => {
    if (!nextPlan) return null;
    const diff = Math.round((nextPlan.monthlyPrice - plan.monthlyPrice) * 100) / 100;
    return formatPlanPrice(diff);
  }, [nextPlan, plan.monthlyPrice]);

  const plansFallback = appId
    ? (`/partner/plans?id=${encodeURIComponent(appId)}` as const)
    : '/partner/plans';

  async function chooseThisPlan() {
    setError('');
    // Sem cadastro: primeiro cria a loja, depois volta já com o plano e o Pix.
    if (!appId) {
      router.push({
        pathname: '/partner/merchant-apply' as any,
        params: { plan: planId, next: 'pay' },
      });
      return;
    }

    setLoading(true);
    const updated = await setMerchantPlan(appId, planId, operatingCity || brand.displayName);
    setLoading(false);
    if (!updated) {
      setError('Não foi possível salvar o plano. Tente de novo.');
      return;
    }
    router.push({ pathname: '/partner/pay' as any, params: { id: appId } });
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title={plan.label} fallbackHref={plansFallback} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[brand.soft, theme.colors.background]} style={styles.hero}>
          {!!plan.highlight && (
            <View style={[styles.pill, { backgroundColor: brand.accent }]}>
              <Text style={styles.pillText}>{plan.highlight}</Text>
            </View>
          )}
          <Text style={styles.name}>{plan.label}</Text>
          <Text style={styles.tagline}>{plan.tagline}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPlanPrice(plan.monthlyPrice)}</Text>
            <Text style={styles.priceSuffix}>/mês</Text>
          </View>
          <Text style={styles.cityHint}>Vitrine em {brand.displayName}</Text>
        </LinearGradient>

        <Text style={styles.section}>Por que este plano é vantajoso</Text>
        <Text style={styles.pitch}>{plan.pitch}</Text>

        {plan.why.map((line) => (
          <View key={line} style={styles.whyRow}>
            <View style={[styles.whyDot, { backgroundColor: brand.accent }]}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
            <Text style={styles.whyText}>{line}</Text>
          </View>
        ))}

        <Text style={[styles.section, { marginTop: theme.spacing.lg }]}>O que está incluso</Text>
        {plan.perks.map((perk) => (
          <View key={perk} style={styles.perkRow}>
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
            <Text style={styles.perkText}>{perk}</Text>
          </View>
        ))}

        {nextPlan && nextId ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              router.push({
                pathname: '/partner/plan-detail' as any,
                params: { id: appId || undefined, plan: nextId },
              })
            }
            style={styles.upsellWrap}
          >
            <LinearGradient
              colors={[brand.accent + '33', theme.colors.surface]}
              style={[styles.upsell, { borderColor: brand.accent }]}
            >
              <View style={styles.upsellHeader}>
                <Ionicons name="trending-up" size={20} color={brand.accent} />
                <Text style={[styles.upsellTitle, { color: brand.accent }]}>
                  Quer ir além? Conheça o {nextPlan.label}
                </Text>
              </View>
              <Text style={styles.upsellHook}>{plan.upsellHook}</Text>
              <Text style={styles.upsellPrice}>
                {nextPlan.label} · {formatPlanPrice(nextPlan.monthlyPrice)}/mês
                {priceDiff ? ` (só +${priceDiff})` : ''}
              </Text>
              <Text style={[styles.upsellCta, { color: brand.accent }]}>
                Ver detalhes do {nextPlan.label} →
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.topNote}>
            <Ionicons name="diamond" size={18} color={theme.colors.primary} />
            <Text style={styles.topNoteText}>
              Este é o plano mais completo do Peça Já. Máxima vitrine na sua cidade.
            </Text>
          </View>
        )}

        {!resolving && !appId && (
          <Text style={styles.hint}>
            Ainda não achamos o cadastro da loja neste aparelho. Ao continuar, você preenche os
            dados e já segue para o Pix/cartão.
          </Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.sticky}>
        <Button
          title={
            appId
              ? `Escolher ${plan.label} · pagar com Pix`
              : `Cadastrar loja e pagar ${plan.label}`
          }
          onPress={() => void chooseThisPlan()}
          loading={loading || resolving}
          size="lg"
        />
        <TouchableOpacity
          style={styles.backLink}
          onPress={() =>
            appId
              ? router.push({ pathname: '/partner/plans' as any, params: { id: appId } })
              : router.back()
          }
        >
          <Ionicons name="arrow-back" size={16} color={theme.colors.primary} />
          <Text style={styles.backLinkText}>Voltar e ver outros planos</Text>
        </TouchableOpacity>
      </View>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 150 },
  hero: {
    padding: theme.spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    marginBottom: 10,
  },
  pillText: { color: '#fff', fontSize: 11, fontWeight: theme.fontWeight.bold },
  name: {
    fontSize: 28,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  tagline: {
    marginTop: 6,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14, gap: 4 },
  price: {
    fontSize: 32,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  priceSuffix: {
    marginBottom: 6,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  cityHint: {
    marginTop: 8,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  section: {
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  pitch: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  whyRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: theme.spacing.lg,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  whyDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  whyText: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.text, lineHeight: 20 },
  perkRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: theme.spacing.lg,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  perkText: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.text, lineHeight: 20 },
  upsellWrap: { marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg },
  upsell: {
    borderWidth: 1.5,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  upsellHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  upsellTitle: { flex: 1, fontWeight: theme.fontWeight.bold, fontSize: theme.fontSize.sm },
  upsellHook: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  upsellPrice: {
    marginTop: 8,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
  upsellCta: {
    marginTop: 6,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
  topNote: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.md,
  },
  topNoteText: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.text, lineHeight: 19 },
  hint: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  error: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    gap: 10,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backLinkText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
});
