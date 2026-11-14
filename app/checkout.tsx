import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
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
  countOrderItemUnits,
  customerSubtotalFromMerchant,
  resolveDeliveryFee,
  resolvePlatformFee,
} from '@/constants/pricing';
import { formatPrice, getBusinessById } from '@/data/businesses';
import { getUserPlaceDetails, openSystemSettings } from '@/services/permissions';
import { getActiveDemoLocation, getSimulatedCityLabel } from '@/utils/demoLocation';
import { sameOperatingCity } from '@/utils/operatingCity';
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
  resolveDeliveryPriceFromDistance,
  gpsFreightAdjustMessage,
} from '@/services/payment';
import { resolveMerchantPinForBusinessId } from '@/utils/merchantPin';
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
import { couponUseKey, loadUsedCouponKeys, markCouponUsed } from '@/utils/couponUses';
import {
  MerchantPromo,
  listPromosByBusiness,
  pickAutoPromo,
  recordPromoRedemption,
} from '@/utils/merchantPromos';
import { getClosedBannerText } from '@/utils/businessHours';
import { loginHref } from '@/utils/authReturnTo';
import { offersForCheckout } from '@/utils/paymentMethods';
import { useMerchantShopRevision } from '@/hooks/useMerchantShopRevision';

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
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsCanAsk, setGpsCanAsk] = useState(true);
  const [gpsAdjustNote, setGpsAdjustNote] = useState<string | null>(null);
  const [checkoutGps, setCheckoutGps] = useState<{
    deliveryLatitude: number;
    deliveryLongitude: number;
    businessLatitude: number;
    businessLongitude: number;
  } | null>(null);
  const checkoutGpsRef = useRef(checkoutGps);
  checkoutGpsRef.current = checkoutGps;
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponDef | null>(null);
  const [couponError, setCouponError] = useState('');
  const [usedCouponKeys, setUsedCouponKeys] = useState<string[]>([]);
  const [merchantPromos, setMerchantPromos] = useState<MerchantPromo[]>([]);
  /** Evita redirect para /cart quando o carrinho é limpo após pagamento. */
  const completingOrderRef = useRef(false);

  const shopRevision = useMerchantShopRevision();
  const business = useMemo(
    () => (businessId ? getBusinessById(businessId) : null),
    [businessId, shopRevision]
  );
  const paymentMethods = useMemo(
    () => offersForCheckout(business?.acceptedPayments, business?.deliveryBy),
    [business?.acceptedPayments, business?.deliveryBy]
  );

  useEffect(() => {
    if (!paymentMethods.length) return;
    if (!paymentMethods.some((method) => method.id === paymentMethod)) {
      setPaymentMethod(paymentMethods[0].id);
    }
  }, [paymentMethods, paymentMethod]);
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
      const usedKey = couponUseKey({
        merchantPromoId: appliedCoupon.merchantPromoId,
        code: appliedCoupon.code,
      });
      if (usedKey && usedCouponKeys.includes(usedKey)) {
        return { ...pricedBase, ...emptyExtra };
      }
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

    const auto = pickAutoPromo(
      merchantPromos.filter(
        (promo) => !usedCouponKeys.includes(couponUseKey({ merchantPromoId: promo.id, code: promo.code }))
      ),
      subtotal
    );
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
  }, [appliedCoupon, pricedBase, subtotal, merchantPromos, platformFee, usedCouponKeys]);

  useEffect(() => {
    if (!appliedCoupon) return;
    const useKey = couponUseKey({
      merchantPromoId: appliedCoupon.merchantPromoId,
      code: appliedCoupon.code,
    });
    if (useKey && usedCouponKeys.includes(useKey)) {
      setAppliedCoupon(null);
      setCouponError('Este cupom já foi usado.');
    }
  }, [appliedCoupon, usedCouponKeys]);

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
      if (!user?.id) {
        setUsedCouponKeys([]);
        return;
      }
      void loadUsedCouponKeys(user.id).then(setUsedCouponKeys);
    }, [refreshCards, user?.id])
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

  const captureDeliveryGps = useCallback(async (): Promise<boolean> => {
    setGpsLoading(true);
    setGpsAdjustNote(null);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      // Cidade demo (Mucugê no link público): não espera o GPS do aparelho para liberar o Pix.
      const demo = getActiveDemoLocation();
      if (demo) {
        latitude = demo.latitude;
        longitude = demo.longitude;
      }

      let perm = demo
        ? { granted: false as const, canAskAgain: true }
        : await Location.getForegroundPermissionsAsync();
      if (!demo && !perm.granted) {
        perm = await Location.requestForegroundPermissionsAsync();
      }

      if (!demo && perm.granted) {
        if (Platform.OS === 'android') {
          const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
          if (!servicesOn) {
            await Location.enableNetworkProviderAsync().catch(() => {});
          }
        }
        try {
          const currentLocation = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('gps-timeout')), 12000)
            ),
          ]);
          latitude = currentLocation.coords.latitude;
          longitude = currentLocation.coords.longitude;
        } catch {
          /* cai no fallback abaixo */
        }
      } else {
        setGpsCanAsk(perm.canAskAgain !== false);
      }

      // Demo Mucugê / cidade simulada: libera o checkout na apresentação sem GPS do aparelho
      if (latitude == null || longitude == null) {
        const place = await getUserPlaceDetails();
        if (place) {
          latitude = place.latitude;
          longitude = place.longitude;
        }
      }

      if (latitude == null || longitude == null) {
        setGpsReady(false);
        setCheckoutGps(null);
        checkoutGpsRef.current = null;
        setGpsDeliveryFee(5);
        return false;
      }

      const merchant = await resolveMerchantPinForBusinessId(business?.id || '');
      const nextGps = {
        deliveryLatitude: latitude,
        deliveryLongitude: longitude,
        businessLatitude: merchant.latitude,
        businessLongitude: merchant.longitude,
      };
      checkoutGpsRef.current = nextGps;
      setCheckoutGps(nextGps);
      setGpsReady(true);
      setGpsCanAsk(true);

      const distanceInMeters = await calculateFreeRouteDistance(
        merchant.latitude,
        merchant.longitude,
        latitude,
        longitude
      );
      const result = resolveDeliveryPriceFromDistance(distanceInMeters);
      setGpsDeliveryFee(result.fee);
      if (result.usedGpsPricing) {
        setGpsAdjustNote(gpsFreightAdjustMessage(result));
      }
      return true;
    } catch {
      setGpsReady(false);
      setCheckoutGps(null);
      checkoutGpsRef.current = null;
      setGpsDeliveryFee(5);
      return false;
    } finally {
      setGpsLoading(false);
    }
  }, [business]);

  useEffect(() => {
    void captureDeliveryGps();
  }, [captureDeliveryGps]);

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
    const selected = paymentMethods.find((method) => method.id === paymentMethod);
    if (selected?.kind === 'card' && selectedCard) {
      const kind = selectedCard.kind === 'credit' ? 'Crédito' : 'Débito';
      return `Cartão ${kind} ${brandLabel(selectedCard.brand)} •••• ${selectedCard.last4}`;
    }
    return selected?.label ?? 'Pix';
  }

  async function finalizeOrder(opts?: {
    paymentConfirmed?: boolean;
    charge?: PixCharge;
  }) {
    if (!user || !businessId || items.length === 0) return;
    const place = await getUserPlaceDetails().catch(() => null);
    const customerCity = getSimulatedCityLabel(place?.city);
    if (business?.city && !sameOperatingCity(business.city, customerCity)) {
      Alert.alert(
        'Cidade da loja',
        `${business.name} só atende em ${business.city}.`
      );
      return;
    }

    const selectedOffer = paymentMethods.find((method) => method.id === paymentMethod);
    const storeDelivers = business?.deliveryBy === 'store';
    const payOnDelivery = selectedOffer?.kind === 'offline' && storeDelivers;
    if (selectedOffer?.kind === 'offline' && !storeDelivers) {
      Alert.alert(
        'Pagamento',
        'Com motoboy do Peça Já o pedido só fecha no Pix ou no cartão.'
      );
      return;
    }
    // Online: nunca cria pedido confirmado sem pagamento. Na entrega, a loja cobra ao receber.
    if (!opts?.paymentConfirmed && !payOnDelivery) {
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
        paymentConfirmed: payOnDelivery ? false : true,
        deliveryFee: priced.deliveryFee,
        discount:
          priced.discount + (priced.couponDiscount ?? 0) > 0
            ? priced.discount + (priced.couponDiscount ?? 0)
            : undefined,
        platformFee: opts?.charge?.split?.platformAmount ?? platformFee,
        establishmentAmount: opts?.charge?.split?.merchantAmount,
        driverAmount: opts?.charge?.split?.driverAmount,
        paymentId: opts?.charge?.id,
        paymentProvider:
          opts?.charge?.provider ??
          (payOnDelivery ? 'offline' : paymentMethod === 'card' ? 'card' : 'mock'),
        settlementMode: opts?.charge?.settlement?.mode,
        settlementMerchantPaidViaMp: opts?.charge?.settlement?.merchantPaidViaMp,
        settlementDriverViaLedger: opts?.charge?.settlement?.driverViaLedger,
        settlementApplicationFee: opts?.charge?.settlement?.applicationFee,
        cashFeeDebtRecovered: opts?.charge?.settlement?.cashFeeDebtRecovery,
        deliveryLatitude: checkoutGpsRef.current?.deliveryLatitude,
        deliveryLongitude: checkoutGpsRef.current?.deliveryLongitude,
        businessLatitude: checkoutGpsRef.current?.businessLatitude,
        businessLongitude: checkoutGpsRef.current?.businessLongitude,
        customerName: user.name,
        customerPhone: user.phone,
        customerPhotoUrl: user.photoUrl,
        customerBio: user.bio,
      });

      await consumeUsedBenefits({
        freeDelivery: priced.freeDeliveryApplied,
        discount10: priced.discountApplied,
      });

      if (priced.merchantPromoId && user?.id) {
        await recordPromoRedemption(priced.merchantPromoId);
        const useKey = couponUseKey({
          merchantPromoId: priced.merchantPromoId,
          code: appliedCoupon?.code,
        });
        await markCouponUsed(user.id, useKey);
        if (useKey) {
          setUsedCouponKeys((prev) => (prev.includes(useKey) ? prev : [...prev, useKey]));
        }
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
    const payingWithPix =
      (paymentMethods.find((method) => method.id === paymentMethod) ?? paymentMethods[0])?.kind ===
      'pix';
    if (freightPending && !payingWithPix) {
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

    const selected = paymentMethods.find((method) => method.id === paymentMethod) ?? paymentMethods[0];
    if (!selected) {
      Alert.alert('Pagamento', 'Esta loja não tem uma forma de pagamento disponível.');
      return;
    }

    if (selected.kind === 'pix') {
      if (!checkoutGpsRef.current) void captureDeliveryGps();
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

    if (!checkoutGpsRef.current) {
      await captureDeliveryGps();
    }
    if (!checkoutGpsRef.current) {
      Alert.alert(
        'GPS necessário',
        'Não deu para ler sua localização. Ative o GPS e toque de novo em Pagar.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: gpsCanAsk ? 'Tentar de novo' : 'Abrir ajustes',
            onPress: () => {
              if (!gpsCanAsk) void openSystemSettings();
              else void captureDeliveryGps();
            },
          },
        ]
      );
      return;
    }

    if (selected.kind === 'offline') {
      setLoading(true);
      try {
        await finalizeOrder({ paymentConfirmed: false });
      } finally {
        setLoading(false);
      }
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
    const useKey = couponUseKey({
      merchantPromoId: result.coupon.merchantPromoId,
      code: result.coupon.code,
    });
    if (useKey && usedCouponKeys.includes(useKey)) {
      setAppliedCoupon(null);
      setCouponError('Este cupom já foi usado.');
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
            <View style={[styles.gpsBanner, gpsReady ? styles.gpsBannerOn : styles.gpsBannerOff]}>
              <Ionicons
                name={gpsLoading ? 'locate' : gpsReady ? 'checkmark-circle' : 'warning'}
                size={20}
                color={gpsReady ? '#047857' : '#B45309'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.gpsBannerTitle, gpsReady && styles.gpsBannerTitleOn]}>
                  {gpsLoading
                    ? 'Ligando o GPS…'
                    : gpsReady
                      ? 'GPS ligado'
                      : 'Ative o GPS para a entrega'}
                </Text>
                <Text style={styles.gpsBannerText}>
                  {gpsLoading
                    ? 'Estamos lendo onde você está para o motoboy chegar no ponto certo.'
                    : gpsReady
                      ? 'O ponto do mapa é onde você está agora. Faça o pedido nesse lugar.'
                      : 'Sem o GPS o motoboy não acha a porta. Toque uma vez para ligar.'}
                </Text>
              </View>
            </View>
            {!gpsReady && !gpsLoading ? (
              <TouchableOpacity
                style={styles.gpsBtn}
                onPress={() => {
                  void (async () => {
                    if (!gpsCanAsk) {
                      await openSystemSettings();
                      return;
                    }
                    const ok = await captureDeliveryGps();
                    if (!ok) {
                      Alert.alert(
                        'GPS',
                        'Não foi possível ligar a localização. Permita o acesso do Peça Já e tente de novo.',
                        [
                          { text: 'Ok', style: 'cancel' },
                          {
                            text: 'Abrir ajustes',
                            onPress: () => void openSystemSettings(),
                          },
                        ]
                      );
                    }
                  })();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.gpsBtnText}>
                  {gpsCanAsk ? 'Ativar GPS' : 'Abrir ajustes do celular'}
                </Text>
              </TouchableOpacity>
            ) : null}
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

            {paymentMethods.find((method) => method.id === paymentMethod)?.kind === 'card' && (
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
                <SummaryRow label="Cupom" value={`−${formatPrice(priced.couponDiscount)}`} />
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
          <Text style={styles.couponTitle}>Cupom da loja</Text>
          <View style={styles.couponRow}>
            <View style={styles.couponInputWrap}>
              <Input
                placeholder="Código do cupom"
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
            <Text style={styles.couponOk}>{appliedCoupon.label} aplicado</Text>
          )}
          {!appliedCoupon && priced.couponLabel && priced.fromStoreAuto && (
            <Text style={styles.couponOk}>{priced.couponLabel} aplicado</Text>
          )}
          <Text style={styles.couponHint}>Cupom oferecido pela loja. Vale uma vez.</Text>
          <Button
            title={
              freightPending
                ? 'Calculando frete…'
                : paymentMethods.find((method) => method.id === paymentMethod)?.kind === 'pix'
                  ? `Pagar com Pix • ${formatPrice(priced.total)}`
                  : paymentMethods.find((method) => method.id === paymentMethod)?.kind === 'card'
                    ? `Pagar com cartão • ${formatPrice(priced.total)}`
                    : `Pedir • pagar na entrega ${formatPrice(priced.total)}`
            }
            onPress={handlePlaceOrder}
            loading={loading || (freightPending && paymentMethods.find((method) => method.id === paymentMethod)?.kind !== 'pix')}
            disabled={
              (freightPending &&
                paymentMethods.find((method) => method.id === paymentMethod)?.kind !== 'pix') ||
              (business != null && !business.isOpen)
            }
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
  gpsBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  gpsBannerOn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  gpsBannerOff: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  gpsBannerTitle: {
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  gpsBannerTitleOn: { color: '#047857' },
  gpsBannerText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  gpsBtn: {
    backgroundColor: '#B45309',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  gpsBtnText: { color: '#fff', fontWeight: '800' },
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
