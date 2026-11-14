import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { CardCvvModal } from '@/components/CardCvvModal';
import { MobileShell } from '@/components/MobileShell';
import { PaymentScreen } from '@/components/PaymentScreen';
import { MERCHANT_PLANS, formatPlanPrice } from '@/constants/plans';
import {
  MerchantApplication,
  PLAN_BILLING_DAYS,
  confirmMerchantPlanPayment,
  formatPlanPaidUntil,
  isMerchantPanelUnlocked,
  isMerchantSubscriptionActive,
  normalizeRouteParam,
  resetMerchantPlanPayment,
  resolveMerchantAppForRoute,
} from '@/utils/partners';
import { useAuth } from '@/context/AuthContext';
import { getUserPlaceDetails } from '@/services/permissions';
import { CityBrand, resolveCityBrand } from '@/utils/cityBrand';
import { CreatePixChargeInput, PixCharge } from '@/services/payment';
import {
  SavedCard,
  brandLabel,
  chargeSavedCard,
  isCardChargeable,
  loadSavedCards,
  maskCardLabel,
  waitCardPaymentApproved,
} from '@/services/cards';
import { fetchPaymentsJson } from '@/services/paymentsFetch';
import { theme } from '@/constants/theme';

type PayMethod = 'pix' | 'card';

/**
 * Assinatura do plano:
 * Pix (Mercado Pago da plataforma) — opção principal, cai direto na conta Peça Já.
 * Cartão — opção secundária, mesma conta MP (sem gateway/split de pedido).
 * Confirmação automática pelo MP → libera o painel (após termo).
 */
export default function PartnerPayScreen() {
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const { user } = useAuth();
  const [app, setApp] = useState<MerchantApplication | null>(null);
  const id = app?.id || normalizeRouteParam(idParam);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<PayMethod>('pix');
  const [pixVisible, setPixVisible] = useState(false);
  const [pixInput, setPixInput] = useState<CreatePixChargeInput | null>(null);
  const [brand, setBrand] = useState<CityBrand>(() => resolveCityBrand(null));
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cvvVisible, setCvvVisible] = useState(false);
  const [cardCharging, setCardCharging] = useState(false);
  const [forceRenew, setForceRenew] = useState(false);

  const plansHref = id
    ? (`/partner/plans?id=${encodeURIComponent(id)}` as const)
    : '/partner/plans';

  const syncPaidFromServer = useCallback(
    async (merchant: MerchantApplication): Promise<MerchantApplication> => {
      if (isMerchantSubscriptionActive(merchant)) return merchant;
      try {
        const hit = await fetchPaymentsJson('/api/payments/plan-status', {
          method: 'POST',
          body: JSON.stringify({ applicationId: merchant.id }),
          timeoutMs: 10_000,
        });
        if (hit?.json?.ok && hit.json.paid && hit.json.payment?.id) {
          const updated = await confirmMerchantPlanPayment(merchant.id, {
            paymentId: String(hit.json.payment.id),
            method: hit.json.payment.method === 'card' ? 'card' : 'pix',
          });
          return updated || merchant;
        }
      } catch {
        /* offline / API */
      }
      return merchant;
    },
    []
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let merchant = await resolveMerchantAppForRoute(idParam, user?.email);
      if (merchant) {
        merchant = await syncPaidFromServer(merchant);
        setApp(merchant);
        if (merchant.paymentId === 'teste-sem-cobranca' && isMerchantPanelUnlocked(merchant)) {
          router.replace('/merchant' as any);
          return;
        }
        if (!merchant.plan) {
          router.replace({
            pathname: '/partner/plans' as any,
            params: { id: merchant.id },
          });
        }
      } else {
        setApp(null);
      }
      const list = await loadSavedCards();
      setCards(list);
      setSelectedCardId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list.find((c) => c.isDefault)?.id ?? list[0]?.id ?? null;
      });
      try {
        const place = await getUserPlaceDetails();
        setBrand(resolveCityBrand(place?.city ?? merchant?.planCity));
      } catch {
        setBrand(resolveCityBrand(merchant?.planCity));
      }
    } finally {
      setLoading(false);
    }
  }, [idParam, user?.email, syncPaidFromServer]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const plan = useMemo(
    () => (app?.plan ? MERCHANT_PLANS[app.plan] : null),
    [app?.plan]
  );

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );

  const subscriptionActive = app ? isMerchantSubscriptionActive(app) : false;
  const showPayForm = !subscriptionActive || forceRenew;
  const paidUntilLabel = app ? formatPlanPaidUntil(app) : null;
  const needsRenewal = !!app?.plan && !subscriptionActive && app.termsStatus === 'accepted';

  async function afterPaymentConfirmed(paymentId: string, payMethod: PayMethod) {
    if (!id) return;
    const updated = await confirmMerchantPlanPayment(id, {
      paymentId,
      method: payMethod,
    });
    if (!updated || !isMerchantSubscriptionActive(updated)) {
      Alert.alert('Erro', 'Não registramos o pagamento. Tente de novo.');
      return;
    }

    if (updated.termsStatus !== 'accepted') {
      router.push({ pathname: '/partner/terms' as any, params: { id } });
      return;
    }

    if (isMerchantPanelUnlocked(updated)) {
      Alert.alert(
        'Assinatura ativa',
        `Seu mês começou. Acesso até ${formatPlanPaidUntil(updated) ?? `${PLAN_BILLING_DAYS} dias`}.`
      );
      router.replace('/merchant' as any);
      return;
    }

    router.push({ pathname: '/partner/terms' as any, params: { id } });
  }

  function openPix() {
    if (!app?.plan || !plan) return;
    const draftId = `plan_${app.id}_${Date.now()}`;
    setPixInput({
      orderDraftId: draftId,
      businessId: 'pecaja-platform',
      businessName: `Assinatura ${plan.label}`,
      customerName: app.ownerName,
      customerEmail: app.email,
      subtotal: plan.monthlyPrice,
      deliveryFeeOverride: 0,
      discount: 0,
      applicationId: app.id,
      plan: app.plan,
    });
    setPixVisible(true);
  }

  async function handlePixPaid(charge: PixCharge) {
    if (charge.status !== 'paid') {
      Alert.alert(
        'Pagamento pendente',
        'O plano só libera depois que o banco/gateway confirmar o Pix.'
      );
      return;
    }
    setPixVisible(false);
    setPixInput(null);
    setForceRenew(false);
    await afterPaymentConfirmed(charge.id, 'pix');
  }

  function startCardPay() {
    if (!selectedCard) {
      Alert.alert(
        'Cadastre um cartão',
        'Para pagar a assinatura com cartão, adicione um crédito ou débito no app.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cadastrar', onPress: () => router.push('/cards/add' as any) },
        ]
      );
      return;
    }
    if (!isCardChargeable(selectedCard)) {
      Alert.alert(
        'Recadastre o cartão',
        'Este cartão precisa ser cadastrado de novo para cobrança com confirmação do banco.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cadastrar', onPress: () => router.push('/cards/add' as any) },
        ]
      );
      return;
    }
    setCvvVisible(true);
  }

  async function handleCardCvvConfirm(cvv: string) {
    if (!app?.plan || !plan || !selectedCard) return;
    setCardCharging(true);
    try {
      const draftId = `plan_${app.id}_${Date.now()}`;
      const result = await chargeSavedCard({
        card: selectedCard,
        amount: plan.monthlyPrice,
        cvv,
        orderDraftId: draftId,
        businessId: 'pecaja-platform',
        businessName: `Assinatura ${plan.label}`,
        customerEmail: app.email,
        customerName: app.ownerName,
        subtotal: plan.monthlyPrice,
        deliveryFeeOverride: 0,
        discount: 0,
        applicationId: app.id,
        plan: app.plan,
      });

      if (!result.ok) {
        Alert.alert('Pagamento recusado', result.error);
        return;
      }

      let finalStatus = result.status;
      let chargeId = result.chargeId;
      const isLocalTestCharge = String(chargeId).startsWith('testpay_');

      if (finalStatus !== 'paid' && !isLocalTestCharge) {
        const waited = await waitCardPaymentApproved(chargeId);
        if (!waited.ok) {
          Alert.alert('Pagamento pendente', waited.error);
          return;
        }
        finalStatus = 'paid';
        chargeId = waited.chargeId;
      }

      if (finalStatus !== 'paid' && isLocalTestCharge) {
        finalStatus = 'paid';
      }

      if (finalStatus !== 'paid') {
        Alert.alert(
          'Pagamento pendente',
          'Aguarde a confirmação do banco ou tente Pix.'
        );
        return;
      }

      setCvvVisible(false);
      setForceRenew(false);
      await afterPaymentConfirmed(chargeId, 'card');
    } catch {
      Alert.alert('Erro', 'Não foi possível cobrar o cartão. Tente novamente.');
    } finally {
      setCardCharging(false);
    }
  }

  function handlePay() {
    if (method === 'card') {
      startCardPay();
    } else {
      openPix();
    }
  }

  if (loading) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Pagamento do plano" fallbackHref={plansHref} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </MobileShell>
    );
  }

  if (!app || !plan) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Pagamento do plano" fallbackHref={plansHref} />
        <View style={styles.center}>
          <Text style={styles.muted}>
            {!app
              ? 'Cadastre a loja para pagar o plano com Pix ou cartão.'
              : 'Escolha um plano antes de pagar.'}
          </Text>
          <Button
            title={!app ? 'Cadastrar loja' : 'Ver planos'}
            onPress={() =>
              router.push(
                (!app ? '/partner/merchant-apply' : plansHref) as any
              )
            }
          />
        </View>
      </MobileShell>
    );
  }

  const cityLabel = app.planCity || brand.displayName;

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Pagamento do plano" fallbackHref={plansHref} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[brand.soft, theme.colors.background]} style={styles.heroWrap}>
          <View style={styles.mosaicRow}>
            {brand.mosaic.slice(0, 4).map((color, i) => (
              <View
                key={`${color}-${i}`}
                style={[styles.mosaicTile, { backgroundColor: color, flex: i === 0 ? 1.4 : 1 }]}
              />
            ))}
          </View>
          <View style={styles.heroText}>
            <View style={[styles.cityBadge, { backgroundColor: brand.accent }]}>
              <Ionicons name="location" size={12} color="#fff" />
              <Text style={styles.cityBadgeText}>{cityLabel}</Text>
            </View>
            <Text style={styles.heroKicker}>
              {needsRenewal ? 'Renovar assinatura' : 'Assinatura Peça Já'}
            </Text>
            <Text style={styles.heroTitle}>{plan.label}</Text>
            <Text style={styles.heroSub}>{app.businessName}</Text>
            <Text style={styles.heroPrice}>{formatPlanPrice(plan.monthlyPrice)}/mês</Text>
            <Text style={styles.heroPeriod}>
              Ao pagar, o mês começa a contar ({PLAN_BILLING_DAYS} dias). Depois, pague de novo
              para entrar no painel.
            </Text>
          </View>
        </LinearGradient>

        <TouchableOpacity
          style={[styles.changePlan, { borderColor: brand.accent }]}
          onPress={() => router.push({ pathname: '/partner/plans' as any, params: { id } })}
          activeOpacity={0.85}
        >
          <Ionicons name="grid-outline" size={18} color={brand.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.changePlanText, { color: brand.accent }]}>
              Voltar e ver / trocar planos
            </Text>
            <Text style={styles.changePlanHint}>
              Compare Já na Rua, Já em Alta e Já no Topo
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={brand.accent} />
        </TouchableOpacity>

        {!showPayForm ? (
          <View style={styles.paidBox}>
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
            <Text style={styles.paidText}>
              Assinatura ativa
              {paidUntilLabel ? ` até ${paidUntilLabel}` : ''}. O valor caiu direto na conta
              Mercado Pago do Peça Já.
            </Text>
            {app.termsStatus !== 'accepted' ? (
              <Button
                title="Continuar para o termo"
                onPress={() => router.push({ pathname: '/partner/terms' as any, params: { id } })}
                size="lg"
                style={{ marginTop: theme.spacing.md, alignSelf: 'stretch' }}
              />
            ) : (
              <Button
                title="Abrir painel do comércio"
                onPress={() => router.replace('/merchant' as any)}
                size="lg"
                style={{ marginTop: theme.spacing.md, alignSelf: 'stretch' }}
              />
            )}
            <Button
              title="Pagar de novo (cartão ou Pix)"
              variant="outline"
              onPress={() => {
                void (async () => {
                  if (!id) return;
                  const cleared = await resetMerchantPlanPayment(id);
                  if (cleared) setApp(cleared);
                  setForceRenew(true);
                })();
              }}
              style={{ marginTop: theme.spacing.sm, alignSelf: 'stretch' }}
            />
            <Button
              title="Ver todos os planos"
              variant="outline"
              onPress={() => router.push({ pathname: '/partner/plans' as any, params: { id } })}
              style={{ marginTop: theme.spacing.sm, alignSelf: 'stretch' }}
            />
          </View>
        ) : (
          <>
            <View style={styles.infoBox}>
              <Ionicons name="wallet-outline" size={18} color={brand.accent} />
              <Text style={styles.infoText}>
                O valor do plano cai direto na conta Mercado Pago do Peça Já (não passa pelo
                gateway de pedidos). Assim que o MP confirmar o Pix, o painel libera
                automaticamente.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Forma de pagamento</Text>

            <TouchableOpacity
              style={[styles.methodRow, method === 'pix' && styles.methodRowOn]}
              onPress={() => setMethod('pix')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="qr-code"
                size={22}
                color={method === 'pix' ? theme.colors.primary : theme.colors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodLabel, method === 'pix' && styles.methodLabelOn]}>
                  Pix
                </Text>
                <Text style={styles.methodHint}>
                  Recomendado · QR na sua conta MP · confirmação automática
                </Text>
              </View>
              {method === 'pix' && (
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodRow, method === 'card' && styles.methodRowOn]}
              onPress={() => setMethod('card')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="card"
                size={22}
                color={method === 'card' ? theme.colors.primary : theme.colors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodLabel, method === 'card' && styles.methodLabelOn]}>
                  Cartão de crédito ou débito
                </Text>
                <Text style={styles.methodHint}>Mesma conta MP · confirmação do banco</Text>
              </View>
              {method === 'card' && (
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
              )}
            </TouchableOpacity>

            {method === 'card' && (
              <View style={styles.cardPicker}>
                <View style={styles.cardPickerHeader}>
                  <Text style={styles.cardPickerTitle}>Cartão para cobrança</Text>
                  <TouchableOpacity onPress={() => router.push('/cards' as any)}>
                    <Text style={styles.manageLink}>Gerenciar</Text>
                  </TouchableOpacity>
                </View>

                {cards.length === 0 ? (
                  <TouchableOpacity
                    style={styles.addCardBox}
                    onPress={() => router.push('/cards/add' as any)}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
                    <Text style={styles.addCardText}>Cadastrar cartão</Text>
                  </TouchableOpacity>
                ) : (
                  cards.map((card) => (
                    <TouchableOpacity
                      key={card.id}
                      style={[
                        styles.savedCardRow,
                        selectedCardId === card.id && styles.savedCardSelected,
                      ]}
                      onPress={() => setSelectedCardId(card.id)}
                    >
                      <Ionicons
                        name={
                          selectedCardId === card.id ? 'radio-button-on' : 'radio-button-off'
                        }
                        size={20}
                        color={
                          selectedCardId === card.id
                            ? theme.colors.primary
                            : theme.colors.textMuted
                        }
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.savedCardLabel}>{maskCardLabel(card)}</Text>
                        <Text style={styles.savedCardMeta}>
                          {brandLabel(card.brand)} ·{' '}
                          {card.kind === 'credit' ? 'Crédito' : 'Débito'} ·{' '}
                          {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                          {!isCardChargeable(card) ? ' · recadastrar' : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}

                {cards.length > 0 && (
                  <TouchableOpacity
                    style={styles.addAnother}
                    onPress={() => router.push('/cards/add' as any)}
                  >
                    <Text style={styles.addAnotherText}>Adicionar outro cartão</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.ctaPad}>
              <Button
                title={
                  method === 'pix'
                    ? `Pagar ${plan.label} com Pix`
                    : `Pagar ${plan.label} com cartão`
                }
                onPress={handlePay}
                loading={cardCharging}
                size="lg"
              />
            </View>
          </>
        )}
      </ScrollView>

      <PaymentScreen
        visible={pixVisible}
        chargeInput={pixInput}
        variant="subscription"
        onClose={() => {
          setPixVisible(false);
          setPixInput(null);
        }}
        onPaid={(charge) => void handlePixPaid(charge)}
      />

      <CardCvvModal
        visible={cvvVisible}
        card={selectedCard}
        loading={cardCharging}
        onClose={() => {
          if (!cardCharging) setCvvVisible(false);
        }}
        onConfirm={(cvv) => {
          void handleCardCvvConfirm(cvv);
        }}
      />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: theme.spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  muted: { color: theme.colors.textMuted, textAlign: 'center' },
  heroWrap: {
    paddingBottom: theme.spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  mosaicRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    height: 56,
  },
  mosaicTile: { borderRadius: 12, height: '100%' },
  heroText: { paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.md },
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
  heroKicker: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 4,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: theme.fontWeight.extrabold,
    letterSpacing: -0.5,
  },
  heroSub: { color: theme.colors.textSecondary, marginTop: 4, fontSize: theme.fontSize.sm },
  heroPrice: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: theme.fontWeight.extrabold,
    marginTop: theme.spacing.md,
  },
  heroPeriod: {
    marginTop: 8,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  changePlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
  },
  changePlanText: {
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  changePlanHint: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  infoText: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.text, lineHeight: 19 },
  sectionTitle: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
  },
  methodRowOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  methodLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  methodLabelOn: { color: theme.colors.primaryDark },
  methodHint: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  cardPicker: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  cardPickerTitle: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
  manageLink: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },
  addCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
  },
  addCardText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  savedCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    marginBottom: 4,
  },
  savedCardSelected: { backgroundColor: theme.colors.primaryLight },
  savedCardLabel: {
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
  savedCardMeta: {
    marginTop: 2,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  addAnother: { paddingTop: 8, alignItems: 'center' },
  addAnotherText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  ctaPad: { paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.sm },
  paidBox: {
    margin: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    gap: 8,
  },
  paidText: {
    textAlign: 'center',
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 20,
  },
});
