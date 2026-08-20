import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
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
import { getUserPlaceDetails } from '@/services/permissions';
import { CityBrand, resolveCityBrand } from '@/utils/cityBrand';
import { setMerchantPlan } from '@/utils/partners';
import { theme } from '@/constants/theme';

export default function PartnerPlanDetailScreen() {
  const { id, plan: planParam } = useLocalSearchParams<{ id?: string; plan?: string }>();
  const planId: MerchantPlan = isMerchantPlanId(planParam) ? planParam : 'crescimento';
  const plan = MERCHANT_PLANS[planId];
  const nextId = getNextPlan(planId);
  const nextPlan = nextId ? MERCHANT_PLANS[nextId] : null;

  const [brand, setBrand] = useState<CityBrand>(() => resolveCityBrand(null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getUserPlaceDetails()
      .then((place) => {
        if (!cancelled) setBrand(resolveCityBrand(place?.city));
      })
      .catch(() => {
        if (!cancelled) setBrand(resolveCityBrand(null));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const priceDiff = useMemo(() => {
    if (!nextPlan) return null;
    const diff = Math.round((nextPlan.monthlyPrice - plan.monthlyPrice) * 100) / 100;
    return formatPlanPrice(diff);
  }, [nextPlan, plan.monthlyPrice]);

  const plansFallback = id
    ? (`/partner/plans?id=${encodeURIComponent(id)}` as const)
    : '/partner/plans';

  async function chooseThisPlan() {
    if (!id) {
      setError('Cadastro não encontrado. Volte e revise os dados da loja.');
      return;
    }
    setLoading(true);
    setError('');
    const updated = await setMerchantPlan(id, planId, brand.displayName);
    setLoading(false);
    if (!updated) {
      setError('Não foi possível salvar o plano. Tente de novo.');
      return;
    }
    router.push({ pathname: '/partner/pay' as any, params: { id } });
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
                params: { id, plan: nextId },
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

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.sticky}>
        <Button
          title={`Escolher ${plan.label} · pagar com Pix`}
          onPress={() => void chooseThisPlan()}
          loading={loading}
          size="lg"
        />
        <TouchableOpacity
          style={styles.backLink}
          onPress={() =>
            id
              ? router.push({ pathname: '/partner/plans' as any, params: { id } })
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
    marginBottom: 8,
  },
  pillText: { color: '#fff', fontSize: 11, fontWeight: theme.fontWeight.bold },
  name: {
    fontSize: 28,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 6,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 14 },
  price: {
    fontSize: 34,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  priceSuffix: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginBottom: 4 },
  cityHint: { marginTop: 6, fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: 8,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  pitch: {
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  whyRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  whyDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  whyText: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.text, lineHeight: 20 },
  perkRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: 8,
  },
  perkText: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.text, lineHeight: 19 },
  upsellWrap: { marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg },
  upsell: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
  },
  upsellHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  upsellTitle: { flex: 1, fontWeight: theme.fontWeight.bold, fontSize: theme.fontSize.md },
  upsellHook: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 19,
    marginBottom: 8,
  },
  upsellPrice: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  upsellCta: {
    marginTop: 10,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
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
  error: {
    color: theme.colors.error,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingVertical: 8,
  },
  backLinkText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
});
