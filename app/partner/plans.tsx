import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import {
  MERCHANT_PLAN_ORDER,
  MERCHANT_PLANS,
  formatPlanPrice,
} from '@/constants/plans';
import {
  MERCHANT_TERMS_TITLE,
  MERCHANT_TERMS_VERSION,
  buildMerchantTermsBody,
} from '@/constants/merchantTerms';
import { PLATFORM_FEE_MERCHANT_NOTICE_FOOTER } from '@/constants/pricing';
import { getUserPlaceDetails } from '@/services/permissions';
import { CityBrand, resolveCityBrand } from '@/utils/cityBrand';
import { useAuth } from '@/context/AuthContext';
import {
  MerchantApplication,
  isMerchantPanelUnlocked,
  merchantOnboardingGate,
  normalizeRouteParam,
  resolveMerchantAppForRoute,
} from '@/utils/partners';
import { theme } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

function CityMosaic({ brand }: { brand: CityBrand }) {
  const [a, b, c, d, e, f] = brand.mosaic;
  return (
    <View style={styles.mosaic}>
      <View style={styles.mosaicRow}>
        <View style={[styles.tile, { flex: 2, height: 100, backgroundColor: a }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.tile, { flex: 1, backgroundColor: b }]} />
          <View style={[styles.tile, { flex: 1, backgroundColor: c }]} />
        </View>
      </View>
      <View style={styles.mosaicRow}>
        <View style={[styles.tile, { flex: 1, height: 44, backgroundColor: d }]} />
        <View style={[styles.tile, { flex: 1.2, height: 44, backgroundColor: e }]} />
        <View style={[styles.tile, { flex: 0.8, height: 44, backgroundColor: f }]} />
      </View>
    </View>
  );
}

export default function PartnerPlansScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const { user } = useAuth();
  const [brand, setBrand] = useState<CityBrand>(() => resolveCityBrand(null));
  const [locating, setLocating] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [document, setDocument] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);
  const [app, setApp] = useState<MerchantApplication | null>(null);

  const id = app?.id || normalizeRouteParam(idParam);

  // Voltar do Perfil / Painel — não prende no cadastro
  const backHref = '/(tabs)/profile';

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLocating(true);
        try {
          const found = await resolveMerchantAppForRoute(idParam, user?.email);
          if (!cancelled && found) {
            if (found.paymentId === 'teste-sem-cobranca' && isMerchantPanelUnlocked(found)) {
              router.replace('/merchant' as any);
              return;
            }
            setApp(found);
            setBusinessName(found.businessName);
            setOwnerName(found.ownerName);
            setDocument(found.document || '');
          } else if (!cancelled) {
            setApp(null);
          }
          const place = await getUserPlaceDetails();
          if (!cancelled) setBrand(resolveCityBrand(place?.city ?? found?.city));
        } catch {
          if (!cancelled) setBrand(resolveCityBrand(null));
        } finally {
          if (!cancelled) setLocating(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [idParam, user?.email])
  );

  const gate = app ? merchantOnboardingGate(app) : null;
  const currentPlan = app?.plan ? MERCHANT_PLANS[app.plan] : null;

  const termsPreview = buildMerchantTermsBody({
    businessName: businessName || 'seu comércio',
    ownerName: ownerName || 'responsável',
    planLabel: 'plano escolhido',
    planPrice: 'conforme pacote',
    city: brand.displayName,
    document,
  });

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Planos Peça Já" fallbackHref={backHref} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[brand.soft, theme.colors.background]}
          style={styles.heroWrap}
        >
          <CityMosaic brand={brand} />
          <View style={styles.heroText}>
            {locating ? (
              <View style={styles.locRow}>
                <ActivityIndicator size="small" color={brand.accent} />
                <Text style={styles.locHint}>Detectando sua cidade…</Text>
              </View>
            ) : (
              <View style={[styles.cityBadge, { backgroundColor: brand.accent }]}>
                <Ionicons name="location" size={12} color="#fff" />
                <Text style={styles.cityBadgeText}>{brand.displayName}</Text>
              </View>
            )}
            <Text style={styles.heroTitle}>Escolha como sua loja aparece</Text>
            <Text style={styles.heroVibe}>{brand.vibe}</Text>
            {!!businessName && (
              <Text style={styles.bizHint}>Cadastro: {businessName}</Text>
            )}
            {!locating && !app && (
              <Text style={styles.bizHint}>
                Sem cadastro neste aparelho — escolha o plano e complete os dados da loja para
                pagar.
              </Text>
            )}
          </View>
        </LinearGradient>

        {!locating && !app && (
          <TouchableOpacity
            style={[styles.continueBanner, { borderColor: brand.accent }]}
            onPress={() => router.push('/partner/merchant-apply' as any)}
            activeOpacity={0.9}
          >
            <Ionicons name="storefront-outline" size={20} color={brand.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.continueTitle}>Cadastrar minha loja</Text>
              <Text style={styles.continueHint}>
                Preencha os dados e depois pague o plano com Pix ou cartão.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={brand.accent} />
          </TouchableOpacity>
        )}

        {gate === 'terms' && currentPlan && (
          <TouchableOpacity
            style={[styles.continueBanner, { borderColor: brand.accent }]}
            onPress={() =>
              router.push({ pathname: '/partner/terms' as any, params: { id } })
            }
            activeOpacity={0.9}
          >
            <Ionicons name="document-text" size={20} color={brand.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.continueTitle}>
                Pix do {currentPlan.label} confirmado
              </Text>
              <Text style={styles.continueHint}>
                Toque para aceitar o termo e liberar o painel — ou compare planos abaixo.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={brand.accent} />
          </TouchableOpacity>
        )}

        {gate === 'pay' && currentPlan && (
          <TouchableOpacity
            style={[styles.continueBanner, { borderColor: theme.colors.primary }]}
            onPress={() =>
              router.push({ pathname: '/partner/pay' as any, params: { id } })
            }
            activeOpacity={0.9}
          >
            <Ionicons name="card-outline" size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.continueTitle}>
                Continuar Pix · {currentPlan.label}
              </Text>
              <Text style={styles.continueHint}>
                Ou toque em outro pacote abaixo para trocar antes de pagar.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.editCadastro}
          onPress={() =>
            router.push({
              pathname: '/partner/merchant-apply' as any,
              params: id ? { id } : undefined,
            })
          }
        >
          <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.editTitle}>Alterar dados do cadastro</Text>
            <Text style={styles.editHint}>Voltar e editar nome, endereço, documento…</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionIntro}>
          Toque em um pacote para ver a explicação completa. Sempre mostramos o plano acima —
          e você pode voltar e comparar à vontade.
        </Text>

        {MERCHANT_PLAN_ORDER.map((key, index) => {
          const plan = MERCHANT_PLANS[key];
          const isTop = key === 'destaque';
          const isMid = key === 'crescimento';
          const isSelected = app?.plan === key;
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.88}
              onPress={() =>
                router.push({
                  pathname: '/partner/plan-detail' as any,
                  params: { id, plan: key },
                })
              }
              style={[
                styles.planCard,
                isTop && { borderColor: brand.accent, borderWidth: 2 },
                isMid && styles.planCardMid,
                isSelected && styles.planCardSelected,
              ]}
            >
              <LinearGradient
                colors={
                  isTop
                    ? [brand.accent + '22', theme.colors.surface]
                    : isMid
                      ? [theme.colors.primaryLight, theme.colors.surface]
                      : [theme.colors.surface, theme.colors.surface]
                }
                style={styles.planCardInner}
              >
                <View style={styles.planTopRow}>
                  {isSelected ? (
                    <View style={[styles.ribbon, { backgroundColor: brand.accent }]}>
                      <Ionicons name="checkmark-circle" size={11} color="#fff" />
                      <Text style={styles.ribbonText}>Seu plano</Text>
                    </View>
                  ) : isTop ? (
                    <View style={[styles.ribbon, { backgroundColor: brand.accent }]}>
                      <Ionicons name="diamond" size={11} color="#fff" />
                      <Text style={styles.ribbonText}>Mais irresistível</Text>
                    </View>
                  ) : isMid ? (
                    <View style={[styles.ribbon, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.ribbonText}>Mais escolhido</Text>
                    </View>
                  ) : (
                    <View style={[styles.ribbon, { backgroundColor: theme.colors.secondary }]}>
                      <Text style={styles.ribbonText}>Começar</Text>
                    </View>
                  )}
                  <Text style={styles.planIndex}>0{index + 1}</Text>
                </View>

                <Text style={styles.planName}>{plan.label}</Text>
                <Text style={styles.planTagline}>{plan.tagline}</Text>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>{formatPlanPrice(plan.monthlyPrice)}</Text>
                  <Text style={styles.priceSuffix}>/mês</Text>
                </View>

                <View style={styles.perkPreview}>
                  {plan.perks.slice(0, 3).map((p) => (
                    <View key={p} style={styles.perkMini}>
                      <Ionicons name="checkmark" size={14} color={brand.accent} />
                      <Text style={styles.perkMiniText} numberOfLines={1}>
                        {p}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.openBtn, { backgroundColor: brand.accent }]}>
                  <Text style={styles.openBtnText}>Ver por que vale a pena</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}

        <View style={styles.termsBlock}>
          <LinearGradient
            colors={[theme.colors.primaryLight, theme.colors.surface]}
            style={styles.termsGrad}
          >
            <View style={styles.termsHeader}>
              <Ionicons name="document-text" size={22} color={theme.colors.primary} />
              <Text style={styles.termsTitle}>Termo de compromisso</Text>
            </View>
            <Text style={styles.termsMeta}>
              {MERCHANT_TERMS_TITLE} · v{MERCHANT_TERMS_VERSION}
            </Text>
            <Text style={styles.termsLead}>
              Leia aqui. O aceite formal (ou Gov.br) vem depois que o Pix for aprovado pelo
              banco — igual ao pagamento do cliente.
            </Text>
            <Text style={styles.feeNotice}>{PLATFORM_FEE_MERCHANT_NOTICE_FOOTER}</Text>

            <TouchableOpacity
              style={styles.termsToggle}
              onPress={() => setTermsOpen((v) => !v)}
            >
              <Text style={styles.termsToggleText}>
                {termsOpen ? 'Ocultar termo' : 'Ler o termo completo'}
              </Text>
              <Ionicons
                name={termsOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.primary}
              />
            </TouchableOpacity>

            {termsOpen && (
              <View style={styles.termBox}>
                <ScrollView nestedScrollEnabled style={styles.termScroll}>
                  <Text style={styles.termText} selectable>
                    {termsPreview}
                  </Text>
                </ScrollView>
              </View>
            )}
          </LinearGradient>
        </View>
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing.xxl },
  heroWrap: {
    paddingBottom: theme.spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  mosaic: { padding: theme.spacing.md, gap: 6 },
  mosaicRow: { flexDirection: 'row', gap: 6 },
  tile: { borderRadius: 14 },
  heroText: { paddingHorizontal: theme.spacing.lg },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  locHint: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
  cityBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    marginBottom: 10,
  },
  cityBadgeText: { color: '#fff', fontSize: 12, fontWeight: theme.fontWeight.bold },
  heroTitle: {
    fontSize: 26,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    letterSpacing: -0.6,
    marginBottom: 8,
    maxWidth: SCREEN_W - 48,
  },
  heroVibe: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  bizHint: {
    marginTop: 10,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  continueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
  },
  continueTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  continueHint: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  editCadastro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  planCardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  editTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primaryDark,
  },
  editHint: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  sectionIntro: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  planCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  planCardMid: { borderColor: theme.colors.primaryMuted },
  planCardInner: { padding: theme.spacing.md },
  planTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  ribbonText: { color: '#fff', fontSize: 11, fontWeight: theme.fontWeight.bold },
  planIndex: {
    fontSize: 18,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.border,
  },
  planName: {
    fontSize: 24,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  planTagline: {
    marginTop: 6,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 12,
    marginBottom: 10,
  },
  price: {
    fontSize: 30,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  priceSuffix: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginBottom: 4 },
  perkPreview: { gap: 6, marginBottom: 12 },
  perkMini: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perkMiniText: { flex: 1, fontSize: theme.fontSize.xs, color: theme.colors.text },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
  },
  openBtnText: {
    color: '#fff',
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  termsBlock: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  termsGrad: { padding: theme.spacing.md },
  termsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  termsTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  termsMeta: { marginTop: 4, fontSize: 11, color: theme.colors.textMuted },
  termsLead: {
    marginTop: 8,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  feeNotice: {
    marginTop: 10,
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  termsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    paddingVertical: 8,
  },
  termsToggleText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
  termBox: {
    height: 220,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  termScroll: { padding: theme.spacing.sm },
  termText: { fontSize: 11, color: theme.colors.text, lineHeight: 16 },
});
