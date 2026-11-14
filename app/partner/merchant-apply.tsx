import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { BrazilCityField } from '@/components/BrazilCityField';
import { Input } from '@/components/Input';
import { MobileShell } from '@/components/MobileShell';
import { isMerchantPlanId } from '@/constants/plans';
import {
  getApplicationById,
  normalizeRouteParam,
  setMerchantPlan,
  submitMerchantApplication,
} from '@/utils/partners';
import { theme } from '@/constants/theme';
import { PLATFORM_FEE_MERCHANT_NOTICE } from '@/constants/pricing';
import {
  DayHours,
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
  WeekdayKey,
  WeeklyHours,
  defaultWeeklyHours,
  formatWeeklyHoursSummary,
} from '@/utils/weeklyHours';
import {
  ShopPaymentMethod,
  defaultShopPayments,
  newCustomPayment,
  normalizeShopPayments,
} from '@/utils/paymentMethods';
import { ShopDeliveryMode } from '@/utils/shopDelivery';
import { isBrazilCityLabel } from '@/utils/brazilCities';

const CATEGORIES = [
  'Restaurante',
  'Mercado',
  'Farmácia',
  'Padaria',
  'Bebidas',
  'Conveniência',
  'Outro',
];

export default function MerchantApplyScreen() {
  const {
    id: editIdParam,
    plan: planParam,
    next: nextParam,
  } = useLocalSearchParams<{
    id?: string | string[];
    plan?: string | string[];
    next?: string | string[];
  }>();
  const editId = normalizeRouteParam(editIdParam) || undefined;
  const preferredPlan = normalizeRouteParam(planParam);
  const nextAfter = normalizeRouteParam(nextParam);
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('Restaurante');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [document, setDocument] = useState('');
  const [notes, setNotes] = useState('');
  const [weekly, setWeekly] = useState<WeeklyHours>(() => defaultWeeklyHours());
  const [payments, setPayments] = useState<ShopPaymentMethod[]>(() => defaultShopPayments());
  const [deliveryBy, setDeliveryBy] = useState<ShopDeliveryMode>('app');
  const [newPaymentName, setNewPaymentName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(!editId);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const app = await getApplicationById(editId);
      if (cancelled || !app || app.role !== 'merchant') {
        if (!cancelled) setHydrated(true);
        return;
      }
      setOwnerName(app.ownerName);
      setEmail(app.email);
      setPhone(app.phone);
      setBusinessName(app.businessName);
      setCategory(app.category || 'Restaurante');
      setAddress(app.address);
      setCity(app.city || '');
      setDocument(app.document || '');
      setNotes(app.notes || '');
      setWeekly(app.weeklyHours ?? defaultWeeklyHours());
      setPayments(normalizeShopPayments(app.acceptedPayments));
      setDeliveryBy(app.deliveryBy === 'store' ? 'store' : 'app');
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  function patchDay(key: WeekdayKey, patch: Partial<DayHours>) {
    setWeekly((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  function togglePayment(id: string, enabled: boolean) {
    const next = payments.map((method) => (method.id === id ? { ...method, enabled } : method));
    if (!next.some((method) => method.enabled)) {
      Alert.alert('Pagamento', 'A loja precisa aceitar pelo menos uma forma.');
      return;
    }
    setPayments(normalizeShopPayments(next));
  }

  function addPayment() {
    const created = newCustomPayment(newPaymentName);
    if (!created) {
      Alert.alert('Pagamento', 'Escreva o nome do método. Ex.: Vale refeição.');
      return;
    }
    const exists = payments.some(
      (method) => method.label.toLowerCase() === created.label.toLowerCase()
    );
    if (exists) {
      Alert.alert('Pagamento', 'Essa forma já está na lista.');
      return;
    }
    setNewPaymentName('');
    setPayments(normalizeShopPayments([...payments, created]));
  }

  async function handleSubmit() {
    const shopError = validateShop();
    if (shopError) {
      setError(shopError);
      setStep(0);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await submitMerchantApplication({
        ownerName,
        email,
        phone,
        businessName,
        category,
        address,
        city,
        document,
        notes,
        weeklyHours: weekly,
        acceptedPayments: normalizeShopPayments(payments),
        deliveryBy,
      });
      if (!result.ok) {
        setError(result.error);
        setStep(0);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }

      const appId = result.application.id;
      if (isMerchantPlanId(preferredPlan)) {
        await setMerchantPlan(appId, preferredPlan, city.trim() || undefined);
        if (nextAfter === 'pay') {
          router.replace({ pathname: '/partner/pay' as any, params: { id: appId } });
          return;
        }
      }

      router.push({
        pathname: '/partner/plans' as any,
        params: { id: appId },
      });
    } finally {
      setLoading(false);
    }
  }

  const isEdit = !!editId;
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const steps = ['Loja', 'Horário', 'Pagamento'];

  function validateShop(): string | null {
    if (!ownerName.trim() || !email.trim() || !phone.trim() || !businessName.trim()) {
      return 'Preencha nome, e-mail, telefone e o nome da loja.';
    }
    if (!address.trim()) return 'Informe o endereço da loja.';
    if (!isBrazilCityLabel(city)) return 'Escolha a cidade de atuação na lista.';
    return null;
  }

  function goStep(next: number) {
    if (next > 0) {
      const err = validateShop();
      if (err) {
        setError(err);
        setStep(0);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
    }
    setError('');
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader
        title={isEdit ? 'Alterar cadastro' : 'Cadastro comércio'}
        fallbackHref="/partner"
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.lead}>
            {isEdit
              ? 'Ajuste os dados da loja e volte aos planos e termos quando quiser.'
              : 'Preencha os dados da loja. Em seguida você vê os planos Peça Já e o termo de compromisso.'}
          </Text>

          {!hydrated ? (
            <Text style={styles.loading}>Carregando dados…</Text>
          ) : (
            <>
              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.tabs}>
                {steps.map((label, index) => {
                  const on = step === index;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.tab, on && styles.tabOn]}
                      onPress={() => goStep(index)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.tabText, on && styles.tabTextOn]}>
                        {index + 1}. {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {step === 0 ? (
                <>
              <Input
                label="Seu nome *"
                placeholder="Responsável pela loja"
                icon="person-outline"
                value={ownerName}
                onChangeText={setOwnerName}
              />
              <Input
                label="E-mail *"
                placeholder="loja@email.com"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="WhatsApp / telefone *"
                placeholder="(75) 99999-9999"
                icon="call-outline"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Input
                label="Nome do comércio *"
                placeholder="Ex.: Cantina da Praça"
                icon="storefront-outline"
                value={businessName}
                onChangeText={setBusinessName}
              />

              <Text style={styles.label}>Categoria</Text>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => {
                  const on = category === c;
                  return (
                    <Button
                      key={c}
                      title={c}
                      variant={on ? 'primary' : 'outline'}
                      size="sm"
                      onPress={() => setCategory(c)}
                      style={styles.chip}
                    />
                  );
                })}
              </View>

              <Input
                label="Endereço da loja *"
                placeholder="Rua, número, bairro"
                icon="location-outline"
                value={address}
                onChangeText={setAddress}
              />
              <BrazilCityField value={city} onChange={setCity} />
              <Input
                label="CPF ou CNPJ"
                placeholder="Somente números"
                icon="document-text-outline"
                value={document}
                onChangeText={setDocument}
                keyboardType="number-pad"
              />
              <Input
                label="Observações"
                placeholder="Especialidade ou recado (opcional)"
                icon="chatbubble-outline"
                value={notes}
                onChangeText={setNotes}
              />
              <Button title="Próxima aba" onPress={() => goStep(1)} size="lg" style={styles.submit} />
                </>
              ) : null}

              {step === 1 ? (
                <>
              <Text style={styles.label}>Horário de funcionamento</Text>
              <Text style={styles.hint}>{formatWeeklyHoursSummary(weekly)}</Text>
              <Text style={styles.hint}>
                Depois do horário de fechamento, a loja fecha sozinha no app.
              </Text>
              {WEEKDAY_ORDER.map((key) => {
                const day = weekly[key];
                return (
                  <View key={key} style={styles.dayRow}>
                    <Text style={styles.dayLabel}>{WEEKDAY_LABEL[key]}</Text>
                    <Switch
                      value={!day.closed}
                      onValueChange={(open) => patchDay(key, { closed: !open })}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primaryMuted }}
                      thumbColor={!day.closed ? theme.colors.primary : theme.colors.surface}
                    />
                    {day.closed ? (
                      <Text style={styles.dayClosed}>Fechado</Text>
                    ) : (
                      <>
                        <TextInput
                          style={styles.dayInput}
                          value={day.open}
                          onChangeText={(open) => patchDay(key, { open })}
                          placeholder="08:00"
                          placeholderTextColor={theme.colors.textMuted}
                        />
                        <Text style={styles.dayDash}>–</Text>
                        <TextInput
                          style={styles.dayInput}
                          value={day.close}
                          onChangeText={(close) => patchDay(key, { close })}
                          placeholder="22:00"
                          placeholderTextColor={theme.colors.textMuted}
                        />
                      </>
                    )}
                  </View>
                );
              })}
              <Button title="Próxima aba" onPress={() => goStep(2)} size="lg" style={styles.submit} />
                </>
              ) : null}

              {step === 2 ? (
                <>
              <Text style={styles.label}>Quem entrega</Text>
              <TouchableOpacity
                style={[styles.choice, deliveryBy === 'store' && styles.choiceOn]}
                onPress={() => setDeliveryBy('store')}
                activeOpacity={0.85}
              >
                <Text style={styles.payLabel}>A loja tem entregador</Text>
                <Text style={styles.payHint}>
                  A equipe de vocês leva o pedido. O motoboy do app não entra nessa corrida.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choice, deliveryBy === 'app' && styles.choiceOn]}
                onPress={() => setDeliveryBy('app')}
                activeOpacity={0.85}
              >
                <Text style={styles.payLabel}>Preciso de motoboy do Peça Já</Text>
                <Text style={styles.payHint}>
                  O app chama um motoboy quando o pedido fica pronto.
                </Text>
              </TouchableOpacity>
              {deliveryBy === 'app' ? (
                <View style={styles.cashBox}>
                  <Text style={styles.payLabel}>Sem dinheiro na mão do motoboy</Text>
                  <Text style={styles.cashLine}>
                    O cliente paga no Pix ou no cartão. O valor cai no app. A loja recebe os produtos no saldo e o motoboy recebe o frete no saldo.
                  </Text>
                  <Text style={styles.cashLine}>
                    Dinheiro vivo com motoboy do app não entra: ele teria que adiantar o valor da loja e guardar a taxa. Se o cliente não pagasse, o prejuízo ficava com ele.
                  </Text>
                </View>
              ) : (
                <View style={styles.cashBox}>
                  <Text style={styles.payLabel}>Dinheiro só com a sua equipe</Text>
                  <Text style={styles.cashLine}>
                    Seu entregador cobra na porta e o dinheiro vivo fica com a loja. A taxa Peça Já gravada no pedido sai do caixa Pix e cai no Pix do Peça Já.
                  </Text>
                </View>
              )}

              <Text style={styles.label}>Formas de pagamento aceitas</Text>
              <Text style={styles.hint}>
                O cliente só vê estas opções no checkout. Com motoboy do Peça Já, dinheiro e outras formas na entrega não aparecem.
              </Text>
              {payments.map((method) => (
                <View key={method.id} style={styles.payRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payLabel}>{method.label}</Text>
                    {method.custom ? <Text style={styles.payHint}>Criado por esta loja</Text> : null}
                  </View>
                  {method.custom ? (
                    <TouchableOpacity
                      onPress={() =>
                        setPayments(payments.filter((item) => item.id !== method.id))
                      }
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                    </TouchableOpacity>
                  ) : null}
                  <Switch
                    value={method.enabled}
                    onValueChange={(enabled) => togglePayment(method.id, enabled)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primaryMuted }}
                    thumbColor={method.enabled ? theme.colors.primary : theme.colors.surface}
                  />
                </View>
              ))}
              <View style={styles.payAdd}>
                <TextInput
                  style={[styles.dayInput, styles.payInput]}
                  value={newPaymentName}
                  onChangeText={setNewPaymentName}
                  placeholder="Adicionar outro. Ex.: Vale refeição"
                  placeholderTextColor={theme.colors.textMuted}
                  onSubmitEditing={addPayment}
                />
                <TouchableOpacity style={styles.payAddBtn} onPress={addPayment} activeOpacity={0.85}>
                  <Text style={styles.payAddBtnText}>Adicionar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.feeNote}>
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.feeNoteText}>{PLATFORM_FEE_MERCHANT_NOTICE}</Text>
              </View>

              <Button
                title={isEdit ? 'Salvar e voltar aos planos' : 'Continuar para planos e termos'}
                onPress={() => void handleSubmit()}
                loading={loading}
                size="lg"
                style={styles.submit}
              />
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  lead: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  loading: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  chip: { marginBottom: 0 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: { color: theme.colors.error, fontSize: theme.fontSize.sm, flex: 1 },
  feeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  feeNoteText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    lineHeight: 18,
  },
  submit: { marginTop: theme.spacing.sm },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  tabTextOn: { color: theme.colors.white },
  hint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dayLabel: {
    width: 36,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: 13,
  },
  dayClosed: { flex: 1, color: theme.colors.textMuted, fontSize: 13 },
  dayInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: theme.colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
  dayDash: { color: theme.colors.textMuted },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  payLabel: { fontWeight: theme.fontWeight.bold, color: theme.colors.text, fontSize: 14 },
  payHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  payAdd: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  payInput: { textAlign: 'left', paddingVertical: 10 },
  payAddBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  payAddBtnText: { color: theme.colors.white, fontWeight: theme.fontWeight.bold },
  choice: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 12,
    marginBottom: 8,
  },
  choiceOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  cashBox: {
    backgroundColor: '#FFF7E8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3D7A1',
    padding: 12,
    marginBottom: 12,
  },
  cashLine: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
