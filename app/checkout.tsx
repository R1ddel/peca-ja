import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useRootNavigationState } from 'expo-router';
import * as Location from 'expo-location';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { MobileShell } from '@/components/MobileShell';
import { PaymentScreen } from '@/components/PaymentScreen';
import { CardCvvModal } from '@/components/CardCvvModal';
import { theme } from '@/constants/theme';
import {
  PLATFORM_FEE,
  countOrderItemUnits,
  customerSubtotalFromMerchant,
  resolveDeliveryFee,
  resolvePlatformFee,
} from '@/constants/pricing';
import { formatPrice, getBusinessById } from '@/data/businesses';
import { formatAddonsLabel, getCustomerLineTotal } from '@/utils/cartLine';
import {
  ActiveBenefits,
  applyBenefitsToTotals,
  consumeUsedBenefits,
  loadActiveBenefits,
} from '@/utils/rewards';
import {
  CreatePixChargeInput,
  PixCharge,
  calculateFreeRouteDistance,
  merchantCoordsNearCustomer,
  resolveDeliveryPriceFromDistance,
  gpsFreightAdjustMessage,
} from '@/services/payment';
import { parseDistanceKm } from '@/components/HomeFilters';
import {
  SavedCard,
  brandLabel,
  chargeSavedCard,
  isCardChargeable,
  loadSavedCards,
  maskCardLabel,
  waitCardPaymentApproved,
} from '@/services/cards';
import {
  SavedAddress,
  getDefaultAddress,
  loadAddresses,
  upsertAddress,
} from '@/utils/addresses';
import { applyCoupon, applyMerchantAutoPromo, CouponDef, normalizeCouponCode } from '@/utils/coupons';
import {
  MerchantPromo,
  listPromosByBusiness,
  pickAutoPromo,
  recordPromoRedemption,
} from '@/utils/merchantPromos';
import { getClosedBannerText } from '@/utils/businessHours';
import { loginHref } from '@/utils/authReturnTo';

const paymentMethods = [
  {
    id: 'pix',
    label: 'Pix',
    hint: 'QR Code · confirmação automática do banco',
    icon: 'qr-code' as const,
  },
  {
    id: 'card',
    label: 'Cartão',
    hint: 'Crédito/débito salvo · confirmação do banco',
    icon: 'card' as const,
  },
];

export default function CheckoutScreen() {
  const rootNavigationState = useRootNavigationState();
  const navigationReady = Boolean(rootNavigationState?.key);
  const { items, subtotal, businessId, clearCart } = useCart();
  const { user } = useAuth();
  const { createOrder } = useOrders();
  const [address, setAddress] = useState(user?.address ?? '');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [loading, setLoading] = useState(false);
  const [pixVisible, setPixVisible] = useState(false);
  const [pixInput, setPixInput] = useState<CreatePixChargeInput | null>(null);
  const [cvvVisible, setCvvVisible] = useState(false);
  const [cardCharging, setCardCharging] = useState(false);
  const [benefits, setBenefits] = useState<ActiveBenefits>({});
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [gpsDeliveryFee, setGpsDeliveryFee] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsAdjustNote, setGpsAdjustNote] = useState<string | null>(null);
  const [checkoutGps, setCheckoutGps] = useState<{
    deliveryLatitude: number;
    deliveryLongitude: number;
    businessLatitude: number;
    businessLongitude: number;
  } | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponDef | null>(null);
  const [couponError, setCouponError] = useState('');
  const [merchantPromos, setMerchantPromos] = useState<MerchantPromo[]>([]);
  /** Evita redirect para /cart quando o carrinho é limpo após pagamento. */
  const completingOrderRef = useRef(false);

  const business = businessId ? getBusinessById(businessId) : null;
  const baseDeliveryFee =
    gpsDeliveryFee != null
      ? gpsDeliveryFee
      : gpsLoading
        ? 0
        : resolveDeliveryFee(business?.deliveryFee);
  const itemUnits = useMemo(
    () => countOrderItemUnits(items),
    [items]
  );
  const platformFee = useMemo(
    () => resolvePlatformFee(itemUnits),
    [itemUnits]
  );
  const customerSubtotal = useMemo(
    () => customerSubtotalFromMerchant(subtotal, itemUnits),
    [subtotal, itemUnits]
  );
  const pricedBase = useMemo(
    () => applyBenefitsToTotals(subtotal, baseDeliveryFee, benefits, platformFee),
    [subtotal, baseDeliveryFee, benefits, platformFee]
  );

  const priced = useMemo(() => {
    const emptyExtra = {
      couponDiscount: 0,
      couponLabel: null as string | null,
      merchantAbsorbsDelivery: 0,
      merchantPromoId: null as string | null,
      fromStoreAuto: false,
      platformFee,
    };

    const applyResult = (result: ReturnType<typeof applyCoupon>, label: string, auto: boolean) => {
      if (!result.ok) {
        return { ...pricedBase, ...emptyExtra };
      }
      const couponDiscount = result.discount;
      const deliveryFee = result.freeDelivery ? 0 : result.deliveryFee;
      const total = Math.max(
        0,
        Math.round(
          (subtotal - pricedBase.discount - couponDiscount + deliveryFee + platformFee) * 100
        ) / 100
      );
      return {
        deliveryFee,
        discount: pricedBase.discount,
        total,
        freeDeliveryApplied: pricedBase.freeDeliveryApplied || result.freeDelivery,
        discountApplied: pricedBase.discountApplied,
        couponDiscount,
        couponLabel: label,
        merchantAbsorbsDelivery: result.merchantAbsorbsDelivery,
        merchantPromoId: result.coupon.merchantPromoId ?? null,
        fromStoreAuto: auto,
        platformFee,
      };
    };

    if (appliedCoupon) {
      return applyResult(
        applyCoupon({
          code: appliedCoupon.code,
          subtotal,
          deliveryFee: pricedBase.deliveryFee,
          clubDiscount: pricedBase.discount,
          merchantPromos,
        }),
        appliedCoupon.label,
        false
      );
    }

    const auto = pickAutoPromo(merchantPromos, subtotal);
    if (auto) {
      return applyResult(
        applyMerchantAutoPromo({
          promo: auto,
          subtotal,
          deliveryFee: pricedBase.deliveryFee,
          clubDiscount: pricedBase.discount,
        }),
        auto.title,
        true
      );
    }

    return { ...pricedBase, ...emptyExtra };
  }, [appliedCoupon, pricedBase, subtotal, merchantPromos, platformFee]);

  useEffect(() => {
    if (!businessId) {
      setMerchantPromos([]);
      return;
    }
    void listPromosByBusiness(businessId).then(setMerchantPromos);
  }, [businessId]);

  const freightPending = gpsLoading && !priced.freeDeliveryApplied;

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );

  const draftId = useMemo(
    () => `draft_${Date.now()}`,
    [items.length, businessId, subtotal]
  );

  const refreshCards = useCallback(async () => {
    try {
      const list = await loadSavedCards();
      setCards(list);
      setSelectedCardId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        const def = list.find((c) => c.isDefault) ?? list[0];
        return def?.id ?? null;
      });
    } catch {
      setCards([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshCards();
    }, [refreshCards])
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let list = await loadAddresses();
        if (list.length === 0 && user?.address?.trim()) {
          list = await upsertAddress({
            label: 'Casa',
            line: user.address.trim(),
            makeDefault: true,
          });
        }
        if (cancelled) return;
        setSavedAddresses(list);
        const def = getDefaultAddress(list);
        if (def) {
          setSelectedAddressId(def.id);
          setAddress((prev) => (prev.trim() ? prev : def.line));
        }
      } catch {
        if (!cancelled) setSavedAddresses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.address]);

  useEffect(() => {
    loadActiveBenefits().then(setBenefits).catch(() => setBenefits({}));
  }, [items.length, subtotal]);

  useEffect(() => {
    let cancelled = false;

    async function loadGpsFreight() {
      setGpsLoading(true);
      setGpsAdjustNote(null);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            Alert.alert(
              'Permissão negada',
              'Sem GPS usamos o frete urbano fixo de R$ 5,00 (entregas dentro da cidade).'
            );
            setGpsDeliveryFee(5);
            setGpsLoading(false);
          }
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = currentLocation.coords;

        const approxKm = business ? parseDistanceKm(business.distance) : 1.5;
        const merchant = merchantCoordsNearCustomer(latitude, longitude, approxKm || 1.5);

        if (!cancelled) {
          setCheckoutGps({
            deliveryLatitude: latitude,
            deliveryLongitude: longitude,
            businessLatitude: merchant.latitude,
            businessLongitude: merchant.longitude,
          });
        }

        const distanceInMeters = await calculateFreeRouteDistance(
          merchant.latitude,
          merchant.longitude,
          latitude,
          longitude
        );

        const result = resolveDeliveryPriceFromDistance(distanceInMeters);
        if (!cancelled) {
          setGpsDeliveryFee(result.fee);
          if (result.usedGpsPricing) {
            // Banner no checkout; o alerta já aparece no carrinho ao calcular.
            setGpsAdjustNote(gpsFreightAdjustMessage(result));
          }
        }
      } catch {
        if (!cancelled) {
          Alert.alert(
            'GPS indisponível',
            'Não foi possível medir a rota. Usamos o frete urbano fixo de R$ 5,00.'
          );
          setGpsDeliveryFee(5);
        }
      } finally {
        if (!cancelled) setGpsLoading(false);
      }
    }

    loadGpsFreight();
    return () => {
      cancelled = true;
    };
  }, [businessId, business?.distance]);

  useEffect(() => {
    if (!navigationReady) return;
    const timer = setTimeout(() => {
      if (!user) {
        router.replace(loginHref('/checkout') as any);
        return;
      }
      // Depois do Pix/cartão pago vamos para /order/[id] — não voltar ao carrinho
      if (completingOrderRef.current) return;
      if (items.length === 0 || !businessId) {
        router.replace('/cart');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [navigationReady, user, items.length, businessId]);

  function paymentLabelForOrder(): string {
    if (paymentMethod === 'pix') return 'Pix';
    if (selectedCard) {
      const kind = selectedCard.kind === 'credit' ? 'Crédito' : 'Débito';
      return `Cartão ${kind} ${brandLabel(selectedCard.brand)} •••• ${selectedCard.last4}`;
    }
    return 'Cartão';
  }

  async function finalizeOrder(opts?: {
    paymentConfirmed?: boolean;
    charge?: PixCharge;
  }) {
    if (!user || !businessId || items.length === 0) return;

    // iFood-style: nunca cria pedido "confirmado" sem pagamento
    if (!opts?.paymentConfirmed) {
      Alert.alert(
        'Aguardando pagamento',
        'O pedido só é confirmado depois que o pagamento for aprovado.'
      );
      return;
    }

    setLoading(true);
    // Trava redirect antes de qualquer await (carrinho vazio não pode mandar para /cart)
    completingOrderRef.current = true;
    try {
      const orderItems = [...items];
      const order = await createOrder({
        userId: user.id,
        businessId,
        items: orderItems,
        subtotal,
        address: address.trim(),
        paymentMethod: paymentLabelForOrder(),
        paymentConfirmed: true,
        deliveryFee: priced.deliveryFee,
        discount:
          priced.discount + (priced.couponDiscount ?? 0) > 0
            ? priced.discount + (priced.couponDiscount ?? 0)
            : undefined,
        platformFee: opts?.charge?.split?.platformAmount ?? PLATFORM_FEE,
        establishmentAmount: opts?.charge?.split?.merchantAmount,
        driverAmount: opts?.charge?.split?.driverAmount,
        paymentId: opts?.charge?.id,
        paymentProvider: opts?.charge?.provider ?? (paymentMethod === 'card' ? 'card' : 'mock'),
        settlementMode: opts?.charge?.settlement?.mode,
        settlementMerchantPaidViaMp: opts?.charge?.settlement?.merchantPaidViaMp,
        settlementDriverViaLedger: opts?.charge?.settlement?.driverViaLedger,
        settlementApplicationFee: opts?.charge?.settlement?.applicationFee,
        deliveryLatitude: checkoutGps?.deliveryLatitude,
        deliveryLongitude: checkoutGps?.deliveryLongitude,
        businessLatitude: checkoutGps?.businessLatitude,
        businessLongitude: checkoutGps?.businessLongitude,
        customerName: user.name,
        customerPhone: user.phone,
        customerPhotoUrl: user.photoUrl,
        customerBio: user.bio,
      });

      await consumeUsedBenefits({
        freeDelivery: priced.freeDeliveryApplied,
        discount10: priced.discountApplied,
      });

      if (priced.merchantPromoId) {
        await recordPromoRedemption(priced.merchantPromoId);
      }

      setPixVisible(false);
      setPixInput(null);
      setCvvVisible(false);
      clearCart();
      // Mesmo padrão do Pix: deixa o modal desmontar antes de navegar
      await new Promise((r) => setTimeout(r, 0));
      router.replace(`/order/${order.id}`);
    } catch (err) {
      completingOrderRef.current = false;
      console.error('[checkout] finalizeOrder', err);
      Alert.alert('Erro', 'Não foi possível realizar o pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function payWithCard() {
    if (!selectedCard) {
      Alert.alert(
        'Cadastre um cartão',
        'Para pagar com cartão, adicione um cartão de crédito ou débito no app.',
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
        'Este cartão foi salvo no modo antigo. Remova e cadastre de novo para cobrança com confirmação do banco.',
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
    if (!user || !businessId || !business || !selectedCard) return;

    setCardCharging(true);
    setLoading(true);
    try {
      const result = await chargeSavedCard({
        card: selectedCard,
        amount: priced.total,
        cvv,
        orderDraftId: draftId,
        businessId,
        businessName: business.name,
        customerEmail: user.email,
        customerName: user.name,
        subtotal,
        businessDeliveryFee: business.deliveryFee,
        deliveryFeeOverride: priced.deliveryFee,
        discount:
          priced.discount + (priced.couponDiscount ?? 0) > 0
            ? priced.discount + (priced.couponDiscount ?? 0)
            : undefined,
        merchantAbsorbsDelivery:
          priced.merchantAbsorbsDelivery > 0
            ? priced.merchantAbsorbsDelivery
            : undefined,
        itemUnits,
      });

      if (!result.ok) {
        Alert.alert('Pagamento recusado', result.error);
        return;
      }

      let finalStatus = result.status;
      let chargeId = result.chargeId;
      let amount = result.amount;
      let split = result.split;

      // Cobrança de teste local (testpay_*) já vem approved — não consulta o MP
      const isLocalTestCharge = String(chargeId).startsWith('testpay_');

      // Se o banco ainda estiver processando, espera approved (igual Pix)
      if (finalStatus !== 'paid' && !isLocalTestCharge) {
        const waited = await waitCardPaymentApproved(chargeId);
        if (!waited.ok) {
          Alert.alert('Pagamento pendente', waited.error);
          return;
        }
        finalStatus = 'paid';
        chargeId = waited.chargeId;
        amount = waited.amount || amount;
        if (waited.split) split = waited.split;
      }

      if (finalStatus !== 'paid' && isLocalTestCharge) {
        finalStatus = 'paid';
      }

      await finalizeOrder({
        paymentConfirmed: true,
        charge: {
          id: chargeId,
          status: 'paid',
          copyPaste: '',
          qrCodeUrl: '',
          amount,
          split: split ?? {
            platformAmount: platformFee,
            merchantAmount: Math.max(
              0,
              Math.round(
                (subtotal -
                  priced.discount -
                  (priced.couponDiscount ?? 0) -
                  (priced.merchantAbsorbsDelivery ?? 0)) *
                  100
              ) / 100
            ),
            driverAmount:
              priced.deliveryFee + (priced.merchantAbsorbsDelivery ?? 0),
            customerTotal: amount,
            subtotal,
            deliveryFee: priced.deliveryFee,
            platformFee,
          },
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
          orderDraftId: draftId,
          businessId,
          businessName: business.name,
          provider: 'mercadopago',
        },
      });
    } catch (err) {
      console.error('[checkout] card charge', err);
      Alert.alert('Erro', 'Não foi possível cobrar o cartão. Tente novamente.');
    } finally {
      setCardCharging(false);
      setLoading(false);
    }
  }

  async function handlePlaceOrder() {
    if (freightPending) {
      Alert.alert('Aguarde', 'Estamos calculando a taxa de entrega pelo GPS.');
      return;
    }
    if (!user) {
      Alert.alert('Login necessário', 'Entre na conta para finalizar o pedido.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Entrar', onPress: () => router.push(loginHref('/checkout') as any) },
      ]);
      return;
    }
    if (business && !business.isOpen) {
      Alert.alert('Comércio fechado', getClosedBannerText(business));
      return;
    }
    if (!address.trim()) {
      Alert.alert('Endereço obrigatório', 'Informe o endereço de entrega.');
      return;
    }
    if (!user || !businessId || items.length === 0 || !business) return;

    if (paymentMethod === 'pix') {
      setPixInput({
        orderDraftId: draftId,
        businessId,
        businessName: business.name,
        customerName: user.name,
        customerEmail: user.email,
        subtotal,
        businessDeliveryFee: business.deliveryFee,
        deliveryFeeOverride: priced.deliveryFee,
        discount:
          priced.discount + (priced.couponDiscount ?? 0) > 0
            ? priced.discount + (priced.couponDiscount ?? 0)
            : undefined,
        merchantAbsorbsDelivery:
          priced.merchantAbsorbsDelivery > 0
            ? priced.merchantAbsorbsDelivery
            : undefined,
        itemUnits,
      });
      setPixVisible(true);
      return;
    }

    await payWithCard();
  }

  async function handlePixPaid(charge: PixCharge) {
    // Trava final: nunca cria pedido sem status paid de verdade
    if (charge.status !== 'paid') {
      Alert.alert(
        'Pagamento pendente',
        'O pedido só é confirmado depois que o pagamento for aprovado.'
      );
      return;
    }
    // Evita setState no Checkout enquanto o PaymentScreen ainda renderiza
    await new Promise((r) => setTimeout(r, 0));
    await finalizeOrder({ paymentConfirmed: true, charge });
  }

  function selectSavedAddress(addr: SavedAddress) {
    setSelectedAddressId(addr.id);
    setAddress(addr.line);
  }

  async function handleSaveAddress() {
    if (!address.trim()) {
      Alert.alert('Endereço obrigatório', 'Informe o endereço antes de salvar.');
      return;
    }
    setSavingAddress(true);
    try {
      const next = await upsertAddress({
        label: savedAddresses.length === 0 ? 'Casa' : 'Entrega',
        line: address.trim(),
        makeDefault: true,
      });
      setSavedAddresses(next);
      const def = getDefaultAddress(next);
      setSelectedAddressId(def?.id ?? null);
      Alert.alert('Endereço salvo', 'Este endereço ficará disponível nos próximos pedidos.');
    } finally {
      setSavingAddress(false);
    }
  }

  function handleApplyCoupon() {
    const result = applyCoupon({
      code: couponInput,
      subtotal,
      deliveryFee: pricedBase.deliveryFee,
      clubDiscount: pricedBase.discount,
      merchantPromos,
    });
    if (!result.ok) {
      setAppliedCoupon(null);
      setCouponError(result.error);
      return;
    }
    setAppliedCoupon(result.coupon);
    setCouponError('');
    setCouponInput(normalizeCouponCode(couponInput));
  }

  function clearCoupon() {
    setAppliedCoupon(null);
    setCouponError('');
    setCouponInput('');
  }

  if (!user || items.length === 0) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Finalizar pedido" />
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>
            {!user
              ? 'Entre na conta para finalizar o pedido.'
              : 'Carregando...'}
          </Text>
          {!user && (
            <Button
              title="Entrar"
              onPress={() => router.push(loginHref('/checkout') as any)}
              style={{ marginTop: theme.spacing.md }}
            />
          )}
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Finalizar pedido" />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location" size={20} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Endereço de entrega</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/addresses' as any)}
                activeOpacity={0.85}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Gerenciar endereços"
              >
                <Text style={styles.manageAddressLink}>Gerenciar endereços</Text>
              </TouchableOpacity>
            </View>
            {savedAddresses.length > 0 && (
              <View style={styles.addressChips}>
                {savedAddresses.map((addr) => {
                  const selected =
                    selectedAddressId === addr.id ||
                    address.trim().toLowerCase() === addr.line.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={addr.id}
                      style={[styles.addressChip, selected && styles.addressChipSelected]}
                      onPress={() => selectSavedAddress(addr)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={addr.isDefault ? 'home' : 'location-outline'}
                        size={14}
                        color={selected ? theme.colors.primaryDark : theme.colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.addressChipLabel,
                            selected && styles.addressChipLabelSelected,
                          ]}
                        >
                          {addr.label}
                          {addr.isDefault ? ' · padrão' : ''}
                        </Text>
                        <Text style={styles.addressChipLine} numberOfLines={2}>
                          {addr.line}
                        </Text>
                      </View>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <Input
              placeholder="Rua, número, complemento, bairro"
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                setSelectedAddressId(null);
              }}
              icon="location-outline"
            />
            <TouchableOpacity
              style={styles.saveAddressBtn}
              onPress={handleSaveAddress}
              disabled={savingAddress}
              activeOpacity={0.85}
            >
              <Ionicons name="bookmark-outline" size={16} color={theme.colors.primaryDark} />
              <Text style={styles.saveAddressText}>
                {savingAddress ? 'Salvando…' : 'Salvar este endereço'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="card" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Forma de pagamento</Text>
            </View>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentOption,
                  paymentMethod === method.id && styles.paymentSelected,
                ]}
                onPress={() => setPaymentMethod(method.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: paymentMethod === method.id }}
              >
                <Ionicons
                  name={method.icon}
                  size={22}
                  color={
                    paymentMethod === method.id
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
                <View style={styles.paymentTextCol}>
                  <Text
                    style={[
                      styles.paymentLabel,
                      paymentMethod === method.id && styles.paymentLabelSelected,
                    ]}
                  >
                    {method.label}
                  </Text>
                  <Text style={styles.paymentHint}>{method.hint}</Text>
                </View>
                {paymentMethod === method.id && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}

            {paymentMethod === 'card' && (
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
                    <Ionicons name="add" size={16} color={theme.colors.primaryDark} />
                    <Text style={styles.addAnotherText}>Adicionar outro cartão</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="receipt" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Resumo do pedido</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.businessLabel}>{business?.name}</Text>
              {business && !business.isOpen && (
                <View style={styles.closedNote}>
                  <Ionicons name="time-outline" size={16} color={theme.colors.warning} />
                  <Text style={styles.closedNoteText}>{getClosedBannerText(business)}</Text>
                </View>
              )}
              {!!gpsAdjustNote && !priced.freeDeliveryApplied && (
                <View style={styles.gpsNote}>
                  <Ionicons name="navigate-outline" size={16} color={theme.colors.warning} />
                  <Text style={styles.gpsNoteText}>{gpsAdjustNote}</Text>
                </View>
              )}
              {items.map((line) => {
                const addonsLabel = formatAddonsLabel(line.selectedAddons);
                return (
                  <View key={line.lineId} style={styles.summaryItem}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.summaryItemName}>
                        {line.quantity}x {line.item.name}
                      </Text>
                      {!!addonsLabel && (
                        <Text style={styles.summaryAddons}>{addonsLabel}</Text>
                      )}
                    </View>
                    <Text style={styles.summaryItemPrice}>
                      {formatPrice(getCustomerLineTotal(line))}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.divider} />

              <Text style={styles.couponTitle}>Cupom</Text>
              <View style={styles.couponRow}>
                <View style={styles.couponInputWrap}>
                  <Input
                    placeholder="PECAJA10, BEMVINDO…"
                    value={couponInput}
                    onChangeText={setCouponInput}
                    autoCapitalize="characters"
                  />
                </View>
                {appliedCoupon ? (
                  <Button title="Remover" variant="outline" onPress={clearCoupon} />
                ) : (
                  <Button title="Aplicar" onPress={handleApplyCoupon} />
                )}
              </View>
              {!!couponError && <Text style={styles.couponError}>{couponError}</Text>}
              {appliedCoupon && (
                <Text style={styles.couponOk}>
                  {appliedCoupon.label} aplicado
                  {appliedCoupon.fundedBy === 'merchant' ? ' · custo da loja' : ''}
                </Text>
              )}
              {!appliedCoupon && priced.couponLabel && priced.fromStoreAuto && (
                <Text style={styles.couponOk}>
                  {priced.couponLabel} (promo da loja) · custo da loja
                </Text>
              )}
              <Text style={styles.couponHint}>
                Cupons da loja ou Peça Já (PECAJA10 · BEMVINDO · FRETEGRATIS)
              </Text>

              <SummaryRow label="Subtotal" value={formatPrice(customerSubtotal)} />
              {freightPending ? (
                <View style={styles.gpsRow}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.gpsText}>Calculando frete pelo GPS…</Text>
                </View>
              ) : (
                <SummaryRow
                  label={
                    priced.freeDeliveryApplied
                      ? 'Taxa de entrega (grátis)'
                      : 'Taxa de entrega'
                  }
                  value={formatPrice(priced.deliveryFee)}
                />
              )}
              {priced.discountApplied && (
                <SummaryRow
                  label="Desconto do clube"
                  value={`−${formatPrice(priced.discount)}`}
                />
              )}
              {(priced.couponDiscount ?? 0) > 0 && (
                <SummaryRow
                  label={priced.fromStoreAuto ? 'Promo da loja' : 'Cupom'}
                  value={`−${formatPrice(priced.couponDiscount)}`}
                />
              )}
              {(priced.merchantAbsorbsDelivery ?? 0) > 0 && (
                <SummaryRow
                  label="Frete (loja assume)"
                  value={formatPrice(0)}
                />
              )}
              {freightPending ? (
                <SummaryRow label="Total a pagar" value="Aguardando frete…" bold />
              ) : (
                <SummaryRow label="Total a pagar" value={formatPrice(priced.total)} bold />
              )}
              {business && (
                <View style={styles.estimate}>
                  <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                  <Text style={styles.estimateText}>Previsão: {business.deliveryTime}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={
              freightPending
                ? 'Calculando frete…'
                : paymentMethod === 'pix'
                  ? `Pagar com Pix • ${formatPrice(priced.total)}`
                  : `Pagar com cartão • ${formatPrice(priced.total)}`
            }
            onPress={handlePlaceOrder}
            loading={loading || freightPending}
            disabled={freightPending || (business != null && !business.isOpen)}
            size="lg"
          />
        </View>
      </View>

      <PaymentScreen
        visible={pixVisible}
        chargeInput={pixInput}
        onClose={() => {
          setPixVisible(false);
          setPixInput(null);
        }}
        onPaid={handlePixPaid}
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

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: theme.colors.textSecondary },
  section: { marginBottom: theme.spacing.lg },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  manageAddressLink: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  addressChips: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  addressChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  addressChipLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  addressChipLabelSelected: { color: theme.colors.primaryDark },
  addressChipLine: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  saveAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingVertical: 8,
  },
  saveAddressText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  paymentSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  paymentTextCol: { flex: 1 },
  paymentLabel: { fontSize: theme.fontSize.md, color: theme.colors.text },
  paymentLabelSelected: {
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primaryDark,
  },
  paymentHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  cardPicker: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
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
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  manageLink: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
  },
  addCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.primaryMuted,
    borderRadius: theme.radius.md,
  },
  addCardText: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  savedCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 4,
  },
  savedCardSelected: { backgroundColor: theme.colors.primaryLight },
  savedCardLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  savedCardMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  addAnother: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.sm,
    paddingVertical: 6,
  },
  addAnotherText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.medium,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  businessLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  closedNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  closedNoteText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 18,
  },
  gpsNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  gpsNoteText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    lineHeight: 17,
  },
  couponTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  couponInputWrap: { flex: 1 },
  couponError: {
    color: theme.colors.error,
    fontSize: theme.fontSize.xs,
    marginBottom: 4,
  },
  couponOk: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 2,
  },
  couponHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryItemName: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  summaryAddons: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
  summaryItemPrice: { fontSize: theme.fontSize.sm, color: theme.colors.text },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: theme.spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  summaryValue: { fontSize: theme.fontSize.sm, color: theme.colors.text },
  bold: {
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    paddingVertical: 2,
  },
  gpsText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.sm,
  },
  estimateText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  footer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
});
