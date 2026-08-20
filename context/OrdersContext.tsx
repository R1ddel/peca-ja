import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order, CartItem, OrderLineIssue } from '@/types';
import { OrderStatus } from '@/constants/theme';
import { getBusinessById } from '@/data/businesses';
import { useAuth } from '@/context/AuthContext';
import {
  countOrderItemUnits,
  resolveCustomerTotal,
  resolveDeliveryFee,
  resolveEstablishmentAmount,
  resolvePlatformFee,
} from '@/constants/pricing';
import { scheduleOrderStatusNotifications, notifyOrderStatusNow } from '@/services/permissions';
import { generateOrderVerificationCodes, normalizeCodeInput } from '@/utils/orderCodes';
import {
  backfillShopOrderNumbers,
  nextShopOrderNumber,
} from '@/utils/merchantOrderNumber';
import { creditOrderToWallet, reverseOrderCredit } from '@/utils/merchantWallet';
import { requestPaymentRefund } from '@/services/paymentRefund';
import { creditDeliveryToDriverWallet } from '@/utils/driverWallet';
import { appendSystemMessage, ensureWelcomeMessages } from '@/services/orderChat';
import {
  canFlagOrReplaceLine,
  hasPendingLineIssues,
  recomputeOrderMoney,
} from '@/utils/orderLineIssues';
import { makeLineId, normalizeCartItem } from '@/utils/cartLine';
import { isMockFleetDriverId } from '@/utils/driverOps';
import {
  applyDispatchPatches,
  computeFairDispatchPatches,
  driverHasActiveJob,
  isOfferActive,
} from '@/utils/driverDispatch';
import { buildFairDispatchDemoOrders } from '@/utils/seedFairDispatchDemo';
import {
  seedDriverLeagueDemo as runLeagueSeed,
  LEAGUE_ORDER_PREFIX,
} from '@/utils/seedDriverLeagueDemo';
import {
  isValidLatLng,
  resolveBusinessCoords,
  resolveDeliveryCoords,
} from '@/utils/orderGeo';
import {
  fleetClaimRemote,
  fleetDeclineRemote,
  fleetPushAndPull,
  fleetReleaseRemote,
  mergeOrdersPreferNewer,
} from '@/services/fleetClient';
import {
  platformListOrders,
  platformSyncOrders,
  platformUpsertOrder,
  asPlatformOrders,
} from '@/services/platformClient';
import {
  requestMerchantLedgerCredit,
  requestDriverLedgerCredit,
  requestLedgerReverse,
} from '@/services/orderLedgerClient';
import { getPlatformToken } from '@/services/platformSession';
import { CustomerChatWatcher } from '@/components/CustomerChatWatcher';
import { clearedDriverAssignment, mergeOrderFields } from '@/utils/orderMerge';
import { isWithinOrderCancelWindow } from '@/utils/orderCancelWindow';

async function withPlatformToken<T>(
  fn: (token: string) => Promise<T | null>
): Promise<T | null> {
  const token = await getPlatformToken();
  if (!token) return null;
  return fn(token);
}

type VerifyResult = { ok: true; order: Order } | { ok: false; error: string };

interface OrdersContextType {
  /** Todos os pedidos locais (comércio/entregador/frota). */
  orders: Order[];
  /** Pedidos só do cliente logado. */
  myOrders: Order[];
  isLoading: boolean;
  createOrder: (params: {
    userId: string;
    businessId: string;
    items: CartItem[];
    subtotal: number;
    address: string;
    paymentMethod: string;
    paymentConfirmed?: boolean;
    deliveryFee?: number;
    discount?: number;
    platformFee?: number;
    establishmentAmount?: number;
    driverAmount?: number;
    paymentId?: string;
    paymentProvider?: string;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    businessLatitude?: number;
    businessLongitude?: number;
    customerName?: string;
    customerPhone?: string;
    customerPhotoUrl?: string;
    customerBio?: string;
  }) => Promise<Order>;
  getOrder: (id: string) => Order | undefined;
  /** Pedidos ativos do cliente logado. */
  activeOrders: Order[];
  confirmOrderPayment: (orderId: string, paymentId?: string) => void;
  cancelOrder: (
    orderId: string,
    opts?: { reason?: string; by?: 'customer' | 'merchant' | 'system' }
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  confirmPickupByCode: (orderId: string, code: string) => VerifyResult;
  confirmDeliveryByCode: (orderId: string, code: string) => VerifyResult;
  assignDriverToOrder: (
    orderId: string,
    driver: {
      id: string;
      name: string;
      phone: string;
      photoUrl?: string;
      bio?: string;
      vehicle?: string;
    }
  ) => Promise<VerifyResult>;
  releaseDriverFromOrder: (
    orderId: string,
    driverId: string
  ) => Promise<VerifyResult>;
  /** true quando a frota remota respondeu no último sync. */
  fleetOnline: boolean;
  /** postgres | filesystem quando a frota respondeu. */
  fleetPersistence: 'postgres' | 'filesystem' | null;
  /** Roda a fila justa (expira ofertas e oferece novas). */
  runFairDispatch: () => Promise<void>;
  /** Motoboy recusa a oferta exclusiva (e reabre a fila). */
  declineDriverOffer: (
    orderId: string,
    driverId: string
  ) => Promise<VerifyResult>;
  /** Injeta 3 pedidos prontos para testar a fila. */
  seedFairDispatchDemo: () => Promise<number>;
  /** Contas rivais + entregas da semana para a Liga. */
  seedDriverLeagueDemo: () => Promise<{ drivers: number; orders: number }>;
  markOrderPreparing: (orderId: string) => VerifyResult;
  markOrderKitchenReady: (orderId: string) => VerifyResult;
  togglePreparedLine: (orderId: string, lineId: string) => VerifyResult;
  flagOrderLineUnavailable: (
    orderId: string,
    lineId: string,
    reason?: string,
    suggestion?: {
      itemId: string;
      name: string;
      image?: string;
      price?: number;
    } | null
  ) => VerifyResult;
  replaceOrderLine: (
    orderId: string,
    lineId: string,
    newLine: CartItem
  ) => VerifyResult;
  removeUnavailableLine: (orderId: string, lineId: string) => VerifyResult;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);
const ORDERS_KEY = '@pecaja_orders';

const CANCELABLE: OrderStatus[] = ['pendente', 'confirmado', 'preparando'];

function ensureOrderGeo(order: Order): Order {
  const delivery = resolveDeliveryCoords(order.address, {
    latitude: order.deliveryLatitude,
    longitude: order.deliveryLongitude,
  });
  const business = isValidLatLng(order.businessLatitude, order.businessLongitude)
    ? {
        latitude: order.businessLatitude as number,
        longitude: order.businessLongitude as number,
      }
    : resolveBusinessCoords(order.businessId, order.businessName);

  if (
    order.deliveryLatitude === delivery.latitude &&
    order.deliveryLongitude === delivery.longitude &&
    order.businessLatitude === business.latitude &&
    order.businessLongitude === business.longitude
  ) {
    return order;
  }
  return {
    ...order,
    deliveryLatitude: delivery.latitude,
    deliveryLongitude: delivery.longitude,
    businessLatitude: business.latitude,
    businessLongitude: business.longitude,
  };
}

function ensureCodes(order: Order): Order {
  const withGeo = ensureOrderGeo(order);
  if (
    withGeo.pickupCode &&
    withGeo.deliveryCode &&
    withGeo.pickupCode !== withGeo.deliveryCode
  ) {
    return withGeo;
  }
  const { pickupCode, deliveryCode } = generateOrderVerificationCodes();
  return {
    ...withGeo,
    pickupCode: withGeo.pickupCode || pickupCode,
    deliveryCode:
      withGeo.deliveryCode &&
      withGeo.deliveryCode !== (withGeo.pickupCode || pickupCode)
        ? withGeo.deliveryCode
        : deliveryCode,
  };
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fleetOnline, setFleetOnline] = useState(false);
  const [fleetPersistence, setFleetPersistence] = useState<
    'postgres' | 'filesystem' | null
  >(null);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const syncingRef = useRef(false);
  const lastPushRef = useRef(0);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    }
  }, [orders, isLoading]);

  const applyRemoteOrders = useCallback((remote: Order[]) => {
    if (!remote.length) return;
    setOrders((prev) => {
      const merged = mergeOrdersPreferNewer(prev, remote.map(ensureCodes));
      const next = backfillShopOrderNumbers(merged);
      if (next.length !== prev.length) return next;
      const prevById = new Map(prev.map((o) => [o.id, o]));
      for (const b of next) {
        const a = prevById.get(b.id);
        if (
          !a ||
          a.updatedAt !== b.updatedAt ||
          a.status !== b.status ||
          a.driverId !== b.driverId ||
          a.offeredToDriverId !== b.offeredToDriverId ||
          a.offerExpiresAt !== b.offerExpiresAt ||
          a.kitchenReadyAt !== b.kitchenReadyAt
        ) {
          return next;
        }
      }
      return prev;
    });
  }, []);

  const syncFleet = useCallback(
    async (opts?: { runDispatch?: boolean; force?: boolean; extraOrders?: Order[] }) => {
      if (syncingRef.current && !opts?.force) return;
      const now = Date.now();
      if (!opts?.force && now - lastPushRef.current < 1200) return;
      syncingRef.current = true;
      lastPushRef.current = now;
      try {
        const base = opts?.extraOrders?.length
          ? mergeOrdersPreferNewer(ordersRef.current, opts.extraOrders)
          : ordersRef.current;
        const remote = await fleetPushAndPull(base, {
          runDispatch: opts?.runDispatch !== false,
        });
        if (remote?.ok && Array.isArray(remote.orders)) {
          setFleetOnline(true);
          if (remote.persistence) setFleetPersistence(remote.persistence);
          applyRemoteOrders(remote.orders);
          // Espelha na plataforma (fonte de verdade compartilhada)
          void withPlatformToken((token) =>
            platformSyncOrders(
              mergeOrdersPreferNewer(ordersRef.current, remote.orders!),
              token
            )
          ).then((plat) => {
            if (plat?.ok) {
              const list = asPlatformOrders(plat);
              if (list.length) applyRemoteOrders(list);
            }
          });
        } else {
          setFleetOnline(false);
          // Sem frota: ainda tenta puxar/empurrar plataforma
          const plat = await withPlatformToken((token) =>
            platformSyncOrders(ordersRef.current, token)
          );
          if (plat?.ok) {
            applyRemoteOrders(asPlatformOrders(plat));
          } else {
            const listed = await withPlatformToken((token) =>
              platformListOrders({ token })
            );
            if (listed?.ok) applyRemoteOrders(asPlatformOrders(listed));
          }
        }
      } catch {
        setFleetOnline(false);
      } finally {
        syncingRef.current = false;
      }
    },
    [applyRemoteOrders]
  );

  // Poll frota compartilhada (vários motoboys no mesmo host)
  useEffect(() => {
    if (isLoading) return;
    void syncFleet({ force: true });
    const id = setInterval(() => {
      void syncFleet();
    }, 3500);
    return () => clearInterval(id);
  }, [isLoading, syncFleet]);

  // Status da cozinha é controlado pelo comércio (sem avanço automático).

  async function loadOrders() {
    try {
      const stored = await AsyncStorage.getItem(ORDERS_KEY);
      let list: Order[] = [];
      if (stored) {
        const parsed = JSON.parse(stored) as Order[];
        list = Array.isArray(parsed) ? parsed.map(ensureCodes) : [];
      }
      const remote = await withPlatformToken((token) => platformListOrders({ token }));
      if (remote?.ok) {
        const remoteOrders = asPlatformOrders(remote);
        if (remoteOrders.length) {
          list = mergeOrdersPreferNewer(list, remoteOrders.map(ensureCodes));
        }
      }
      setOrders(backfillShopOrderNumbers(list));
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  const createOrder = useCallback(
    async (params: {
      userId: string;
      businessId: string;
      items: CartItem[];
      subtotal: number;
      address: string;
      paymentMethod: string;
      paymentConfirmed?: boolean;
      deliveryFee?: number;
      discount?: number;
      platformFee?: number;
      establishmentAmount?: number;
      driverAmount?: number;
      paymentId?: string;
      paymentProvider?: string;
      deliveryLatitude?: number;
      deliveryLongitude?: number;
      businessLatitude?: number;
      businessLongitude?: number;
      customerName?: string;
      customerPhone?: string;
      customerPhotoUrl?: string;
      customerBio?: string;
    }) => {
      const business = getBusinessById(params.businessId);
      const baseDeliveryFee = resolveDeliveryFee(business?.deliveryFee);
      const deliveryFee =
        typeof params.deliveryFee === 'number' ? params.deliveryFee : baseDeliveryFee;
      const discount = Math.max(0, params.discount ?? 0);
      const itemUnits = countOrderItemUnits(params.items);
      const platformFee = params.platformFee ?? resolvePlatformFee(itemUnits);
      const total = resolveCustomerTotal(params.subtotal, deliveryFee, discount, platformFee);
      const now = new Date().toISOString();
      const paid = !!params.paymentConfirmed;
      const orderId = `PJ${Date.now().toString().slice(-8)}`;
      const { pickupCode, deliveryCode } = generateOrderVerificationCodes();
      const delivery = resolveDeliveryCoords(params.address, {
        latitude: params.deliveryLatitude,
        longitude: params.deliveryLongitude,
      });
      const shopCoords = isValidLatLng(
        params.businessLatitude,
        params.businessLongitude
      )
        ? {
            latitude: params.businessLatitude as number,
            longitude: params.businessLongitude as number,
          }
        : resolveBusinessCoords(params.businessId, business?.name);

      let created!: Order;
      setOrders((prev) => {
        const shopOrderNumber = nextShopOrderNumber(prev, params.businessId);
        created = {
          id: orderId,
          userId: params.userId,
          businessId: params.businessId,
          businessName: business?.name ?? 'Comércio',
          businessImage: business?.image ?? '',
          items: params.items,
          subtotal: params.subtotal,
          deliveryFee,
          discount: discount > 0 ? discount : undefined,
          total,
          status: paid ? 'confirmado' : 'pendente',
          address: params.address,
          deliveryLatitude: delivery.latitude,
          deliveryLongitude: delivery.longitude,
          businessLatitude: shopCoords.latitude,
          businessLongitude: shopCoords.longitude,
          paymentMethod: params.paymentMethod,
          createdAt: now,
          updatedAt: now,
          estimatedDelivery: business?.deliveryTime ?? '30-45 min',
          platformFee,
          establishmentAmount:
            params.establishmentAmount ??
            resolveEstablishmentAmount(params.subtotal, discount),
          driverAmount: params.driverAmount ?? deliveryFee,
          paymentId: params.paymentId,
          paymentProvider: params.paymentProvider,
          paymentConfirmed: paid,
          // Sem auto-assign: motoboy real aceita no painel
          driverId: undefined,
          driverName: undefined,
          driverPhone: undefined,
          customerName: params.customerName?.trim() || undefined,
          customerPhone: params.customerPhone?.trim() || undefined,
          customerPhotoUrl: params.customerPhotoUrl?.trim() || undefined,
          customerBio: params.customerBio?.trim() || undefined,
          pickupCode,
          deliveryCode,
          shopOrderNumber,
        };
        return [created, ...prev];
      });

      if (paid) {
        scheduleOrderStatusNotifications({
          id: created.id,
          businessName: created.businessName,
          status: created.status,
        }).catch(() => {});
        creditOrderToWallet(created).catch(() => {});
        void (async () => {
          await withPlatformToken((token) => platformUpsertOrder(created, token));
          const credit = await requestMerchantLedgerCredit(created);
          if (!credit.ok) {
            console.warn('[ledger] crédito loja falhou', created.id, credit.code, credit.message);
          }
        })();
      } else {
        void withPlatformToken((token) => platformUpsertOrder(created, token));
      }
      void syncFleet({ force: true, extraOrders: [created] });
      return created;
    },
    [syncFleet]
  );

  const getOrder = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);

  const confirmOrderPayment = useCallback((orderId: string, paymentId?: string) => {
    let credited: Order | null = null;
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        if (order.paymentConfirmed && order.status !== 'pendente') return order;
        const next: Order = {
          ...ensureCodes(order),
          paymentConfirmed: true,
          paymentId: paymentId ?? order.paymentId,
          status: order.status === 'pendente' ? 'confirmado' : order.status,
          updatedAt: new Date().toISOString(),
        };
        credited = next;
        scheduleOrderStatusNotifications({
          id: next.id,
          businessName: next.businessName,
          status: next.status,
        }).catch(() => {});
        return next;
      })
    );
    if (credited) {
      creditOrderToWallet(credited).catch(() => {});
      void (async () => {
        await withPlatformToken((token) => platformUpsertOrder(credited!, token));
        const credit = await requestMerchantLedgerCredit(credited!);
        if (!credit.ok) {
          console.warn('[ledger] crédito loja falhou', credited!.id, credit.code, credit.message);
        }
      })();
    }
  }, []);

  const cancelOrder = useCallback(
    async (
      orderId: string,
      opts?: { reason?: string; by?: 'customer' | 'merchant' | 'system' }
    ) => {
      const target = ordersRef.current.find((o) => o.id === orderId);
      if (!target) return { ok: false as const, error: 'Pedido não encontrado.' };
      if (target.pickupVerifiedAt) {
        return {
          ok: false as const,
          error: 'Não é possível cancelar: o entregador já retirou o pedido no comércio.',
        };
      }
      if (!isWithinOrderCancelWindow(target.createdAt)) {
        return {
          ok: false as const,
          error: 'O cancelamento só é permitido nos primeiros 2 minutos após o pedido.',
        };
      }
      if (!CANCELABLE.includes(target.status)) {
        return {
          ok: false as const,
          error: 'Só é possível cancelar antes da retirada no comércio.',
        };
      }
      const reason = (opts?.reason || '').trim();
      if (reason.length < 3) {
        return {
          ok: false as const,
          error: 'Informe o motivo do cancelamento (mín. 3 caracteres).',
        };
      }

      const needsRefund =
        !!target.paymentConfirmed &&
        !!target.paymentId &&
        (target.paymentProvider === 'mercadopago' ||
          target.paymentProvider === 'card' ||
          (!target.paymentProvider && !String(target.paymentId).startsWith('mock_')));

      if (needsRefund && target.paymentId) {
        // Garante pedido no servidor antes do auth do refund
        await withPlatformToken((token) => platformUpsertOrder(target, token));
        const refund = await requestPaymentRefund({
          paymentId: target.paymentId,
          orderId: target.id,
          amount: target.total,
          reason,
        });
        if (!refund.ok) {
          return {
            ok: false as const,
            error:
              refund.message ||
              'Não foi possível estornar o pagamento. Tente de novo ou fale com o suporte.',
          };
        }
      }

      const cancelled: Order = {
        ...target,
        status: 'cancelado' as OrderStatus,
        cancelReason: reason,
        cancelledBy: opts?.by ?? 'system',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Libera motoboy se ainda estava atribuído
        driverId: null,
        driverName: null,
        driverPhone: null,
        offeredToDriverId: null,
        offerExpiresAt: null,
      };
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? cancelled : order))
      );
      notifyOrderStatusNow({
        id: target.id,
        businessName: target.businessName,
        status: 'cancelado',
        cancelReason: reason,
      }).catch(() => {});
      reverseOrderCredit(cancelled).catch(() => {});
      // Ledger reverse já roda no endpoint de refund; reforço se não houve refund
      if (!needsRefund) {
        void requestLedgerReverse(cancelled);
      }
      void withPlatformToken((token) => platformUpsertOrder(cancelled, token));
      void syncFleet({ force: true, extraOrders: [cancelled] });
      appendSystemMessage({
        orderId,
        peer: 'merchant',
        text: `Pedido cancelado (${opts?.by ?? 'system'}): ${reason}`,
      }).catch(() => {});
      return { ok: true as const };
    },
    [syncFleet]
  );

  const confirmPickupByCode = useCallback(
    (orderId: string, code: string): VerifyResult => {
      const typed = normalizeCodeInput(code);
      const current = orders.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      const order = ensureCodes(current);

      if (order.status === 'cancelado') {
        return { ok: false, error: 'Pedido cancelado.' };
      }
      if (order.pickupVerifiedAt || order.status === 'saiu_entrega' || order.status === 'entregue') {
        return { ok: false, error: 'Retirada já confirmada.' };
      }
      if (order.status !== 'preparando') {
        return {
          ok: false,
          error: 'Aguarde o pedido ficar pronto no comércio para liberar a retirada.',
        };
      }
      if (!order.kitchenReadyAt) {
        return {
          ok: false,
          error: 'Marque o pedido como pronto na cozinha antes de liberar a retirada.',
        };
      }
      if (typed.length !== 4) {
        return { ok: false, error: 'Digite o código de 4 dígitos do entregador.' };
      }
      if (typed !== order.pickupCode) {
        return { ok: false, error: 'Código de retirada inválido.' };
      }

      const next: Order = {
        ...order,
        status: 'saiu_entrega',
        pickupVerifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));
      notifyOrderStatusNow({
        id: next.id,
        businessName: next.businessName,
        status: next.status,
      }).catch(() => {});
      return { ok: true, order: next };
    },
    [orders]
  );

  const markOrderPreparing = useCallback(
    (orderId: string): VerifyResult => {
      const current = orders.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      if (current.status === 'cancelado') {
        return { ok: false, error: 'Pedido cancelado.' };
      }
      if (current.status === 'preparando') {
        return { ok: true, order: current };
      }
      if (current.status !== 'confirmado' && !(current.status === 'pendente' && current.paymentConfirmed)) {
        return { ok: false, error: 'Só é possível iniciar o preparo de pedidos confirmados.' };
      }
      const next: Order = {
        ...ensureCodes(current),
        status: 'preparando',
        updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));
      notifyOrderStatusNow({
        id: next.id,
        businessName: next.businessName,
        status: next.status,
      }).catch(() => {});
      return { ok: true, order: next };
    },
    [orders]
  );

  const markOrderKitchenReady = useCallback(
    (orderId: string): VerifyResult => {
      const current = orders.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      if (current.status === 'cancelado') {
        return { ok: false, error: 'Pedido cancelado.' };
      }
      if (current.status !== 'preparando') {
        return { ok: false, error: 'Aceite o pedido e inicie o preparo antes de marcar como pronto.' };
      }
      if (current.kitchenReadyAt) {
        return { ok: true, order: current };
      }
      if (hasPendingLineIssues(current)) {
        return {
          ok: false,
          error:
            'Há itens em falta aguardando o cliente trocar. Resolva no chat ou aguarde a troca antes de marcar pronto.',
        };
      }
      const allLineIds = current.items.map((l) => l.lineId);
      const next: Order = {
        ...ensureCodes(current),
        kitchenReadyAt: new Date().toISOString(),
        preparedLineIds: allLineIds,
        updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));
      notifyOrderStatusNow({
        id: next.id,
        businessName: next.businessName,
        status: 'kitchen_ready',
      }).catch(() => {});
      void syncFleet({ force: true, runDispatch: true, extraOrders: [next] });
      return { ok: true, order: next };
    },
    [orders, syncFleet]
  );

  const togglePreparedLine = useCallback(
    (orderId: string, lineId: string): VerifyResult => {
      const current = orders.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      if (current.status !== 'preparando') {
        return { ok: false, error: 'Só é possível marcar itens durante o preparo.' };
      }
      if (current.kitchenReadyAt) {
        return { ok: false, error: 'Pedido já está pronto. Não altere os itens.' };
      }
      const issue = current.lineIssues?.find(
        (i) => i.lineId === lineId && i.status === 'awaiting_customer'
      );
      if (issue) {
        return {
          ok: false,
          error: 'Este item está em falta. Aguarde o cliente trocar ou remover.',
        };
      }
      const prevIds = current.preparedLineIds ?? [];
      const has = prevIds.includes(lineId);
      const preparedLineIds = has
        ? prevIds.filter((id) => id !== lineId)
        : [...prevIds, lineId];
      const next: Order = {
        ...current,
        preparedLineIds,
        updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));
      return { ok: true, order: next };
    },
    [orders]
  );

  const flagOrderLineUnavailable = useCallback(
    (
      orderId: string,
      lineId: string,
      reason?: string,
      suggestion?: {
        itemId: string;
        name: string;
        image?: string;
        price?: number;
      } | null
    ): VerifyResult => {
      const current = orders.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      if (!canFlagOrReplaceLine(current)) {
        return {
          ok: false,
          error: 'Só é possível sinalizar falta antes do pedido ficar pronto / sair.',
        };
      }
      const line = current.items.find((l) => l.lineId === lineId);
      if (!line) return { ok: false, error: 'Item não encontrado no pedido.' };
      const already = current.lineIssues?.find(
        (i) => i.lineId === lineId && i.status === 'awaiting_customer'
      );
      if (already) {
        return { ok: false, error: 'Este item já está marcado como em falta.' };
      }

      const issue: OrderLineIssue = {
        lineId,
        itemName: line.item.name,
        reason: (reason ?? 'Item em falta no estoque').trim() || 'Item em falta no estoque',
        flaggedAt: new Date().toISOString(),
        status: 'awaiting_customer',
        suggestedItemId: suggestion?.itemId,
        suggestedItemName: suggestion?.name,
        suggestedItemImage: suggestion?.image,
        suggestedItemPrice: suggestion?.price,
      };
      const preparedLineIds = (current.preparedLineIds ?? []).filter((id) => id !== lineId);
      const next: Order = {
        ...current,
        lineIssues: [...(current.lineIssues ?? []).filter((i) => i.lineId !== lineId), issue],
        preparedLineIds,
        updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));

      const label =
        current.shopOrderNumber != null
          ? `#${current.shopOrderNumber}`
          : `#${current.id.slice(-6).toUpperCase()}`;
      const suggestText = suggestion?.name
        ? ` A loja sugere trocar por “${suggestion.name}”.`
        : ' Você pode trocar por outro item do cardápio ou remover este item.';
      void (async () => {
        await ensureWelcomeMessages({
          orderId,
          peer: 'merchant',
          peerName: 'Cliente',
          businessName: current.businessName,
        });
        await appendSystemMessage({
          orderId,
          peer: 'merchant',
          kind: 'item_unavailable',
          meta: {
            lineId,
            itemName: line.item.name,
            replacedWithName: suggestion?.name,
          },
          text:
            `⚠️ A loja avisou: “${line.item.name}” está em falta e impede montar o pedido ${label}.` +
            suggestText +
            ` Motivo: ${issue.reason}.`,
        });
      })();

      notifyOrderStatusNow({
        id: next.id,
        businessName: next.businessName,
        status: next.status,
      }).catch(() => {});

      return { ok: true, order: next };
    },
    [orders]
  );

  const replaceOrderLine = useCallback(
    (orderId: string, lineId: string, newLineRaw: CartItem): VerifyResult => {
      const current = orders.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      if (!canFlagOrReplaceLine(current)) {
        return { ok: false, error: 'Não é mais possível trocar itens neste pedido.' };
      }
      const issue = current.lineIssues?.find(
        (i) => i.lineId === lineId && i.status === 'awaiting_customer'
      );
      if (!issue) {
        return { ok: false, error: 'Este item não está marcado como em falta.' };
      }
      const oldLine = current.items.find((l) => l.lineId === lineId);
      if (!oldLine) return { ok: false, error: 'Item original não encontrado.' };
      if (newLineRaw.businessId !== current.businessId) {
        return { ok: false, error: 'Escolha um item do mesmo comércio.' };
      }

      const newLine = normalizeCartItem({
        ...newLineRaw,
        quantity: newLineRaw.quantity > 0 ? newLineRaw.quantity : oldLine.quantity,
        businessId: current.businessId,
        businessName: current.businessName,
        lineId: makeLineId(
          newLineRaw.item.id,
          newLineRaw.selectedAddons ?? [],
          newLineRaw.note
        ),
      });

      const items = current.items.map((l) => (l.lineId === lineId ? newLine : l));
      const money = recomputeOrderMoney(current, items);
      const resolvedIssue: OrderLineIssue = {
        ...issue,
        status: 'replaced',
        replacedWithName: newLine.item.name,
        resolvedAt: new Date().toISOString(),
      };
      const next: Order = {
        ...current,
        ...money,
        lineIssues: (current.lineIssues ?? []).map((i) =>
          i.lineId === lineId && i.status === 'awaiting_customer' ? resolvedIssue : i
        ),
        preparedLineIds: (current.preparedLineIds ?? []).filter((id) => id !== lineId),
        updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));

      appendSystemMessage({
        orderId,
        peer: 'merchant',
        kind: 'item_replaced',
        meta: {
          lineId: newLine.lineId,
          itemName: issue.itemName,
          replacedWithName: newLine.item.name,
        },
        text:
          `✅ Cliente trocou “${issue.itemName}” por “${newLine.item.name}”. ` +
          `Novo total do pedido: R$ ${next.total.toFixed(2).replace('.', ',')}.`,
      }).catch(() => {});

      return { ok: true, order: next };
    },
    [orders]
  );

  const removeUnavailableLine = useCallback(
    (orderId: string, lineId: string): VerifyResult => {
      const current = orders.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      if (!canFlagOrReplaceLine(current)) {
        return { ok: false, error: 'Não é mais possível alterar itens neste pedido.' };
      }
      const issue = current.lineIssues?.find(
        (i) => i.lineId === lineId && i.status === 'awaiting_customer'
      );
      if (!issue) {
        return { ok: false, error: 'Este item não está marcado como em falta.' };
      }
      if (current.items.length <= 1) {
        return {
          ok: false,
          error: 'Não dá para remover o único item. Cancele o pedido ou troque por outro do cardápio.',
        };
      }

      const items = current.items.filter((l) => l.lineId !== lineId);
      const money = recomputeOrderMoney(current, items);
      const resolvedIssue: OrderLineIssue = {
        ...issue,
        status: 'removed',
        resolvedAt: new Date().toISOString(),
      };
      const next: Order = {
        ...current,
        ...money,
        lineIssues: (current.lineIssues ?? []).map((i) =>
          i.lineId === lineId && i.status === 'awaiting_customer' ? resolvedIssue : i
        ),
        preparedLineIds: (current.preparedLineIds ?? []).filter((id) => id !== lineId),
        updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));

      appendSystemMessage({
        orderId,
        peer: 'merchant',
        kind: 'item_removed',
        meta: { lineId, itemName: issue.itemName },
        text:
          `🗑️ Cliente removeu “${issue.itemName}” do pedido. ` +
          `Novo total: R$ ${next.total.toFixed(2).replace('.', ',')}.`,
      }).catch(() => {});

      return { ok: true, order: next };
    },
    [orders]
  );

  const confirmDeliveryByCode = useCallback(
    (orderId: string, code: string): VerifyResult => {
      const typed = normalizeCodeInput(code);
      const current = orders.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      const order = ensureCodes(current);

      if (order.status === 'cancelado') {
        return { ok: false, error: 'Pedido cancelado.' };
      }
      if (order.deliveryVerifiedAt || order.status === 'entregue') {
        return { ok: false, error: 'Entrega já confirmada.' };
      }
      if (order.status !== 'saiu_entrega') {
        return {
          ok: false,
          error: 'O entregador só confirma a entrega depois de retirar no comércio.',
        };
      }
      if (typed.length !== 4) {
        return { ok: false, error: 'Digite o código de 4 dígitos do cliente.' };
      }
      if (typed !== order.deliveryCode) {
        return { ok: false, error: 'Código de entrega inválido.' };
      }

      const next: Order = {
        ...order,
        status: 'entregue',
        deliveryVerifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));
      notifyOrderStatusNow({
        id: next.id,
        businessName: next.businessName,
        status: next.status,
      }).catch(() => {});
      creditDeliveryToDriverWallet(next).catch(() => {});
      if (next.driverId && next.driverAmount) {
        void (async () => {
          const stamped =
            user?.id && !next.driverPlatformUserId
              ? { ...next, driverPlatformUserId: user.id }
              : next;
          if (stamped !== next) {
            setOrders((prev) => prev.map((o) => (o.id === orderId ? stamped : o)));
          }
          await withPlatformToken((token) => platformUpsertOrder(stamped, token));
          const credit = await requestDriverLedgerCredit(stamped);
          if (!credit.ok) {
            console.warn('[ledger] crédito frete falhou', stamped.id, credit.code, credit.message);
          }
        })();
      } else {
        void withPlatformToken((token) => platformUpsertOrder(next, token));
      }
      return { ok: true, order: next };
    },
    [orders, user?.id]
  );

  const assignDriverToOrder = useCallback(
    async (
      orderId: string,
      driver: {
        id: string;
        name: string;
        phone: string;
        photoUrl?: string;
        bio?: string;
        vehicle?: string;
      }
    ): Promise<VerifyResult> => {
      const profilePatch = {
        driverPhotoUrl: driver.photoUrl?.trim() || null,
        driverBio: driver.bio?.trim() || null,
        driverVehicle: driver.vehicle?.trim() || null,
      };
      const remote = await fleetClaimRemote({
        orderId,
        fleetId: driver.id,
        name: driver.name,
        phone: driver.phone,
        photoUrl: driver.photoUrl,
        bio: driver.bio,
        vehicle: driver.vehicle,
      });
      if (remote?.ok && remote.order) {
        setFleetOnline(true);
        const stamped = {
          ...ensureCodes(remote.order),
          ...profilePatch,
          driverName: driver.name,
          driverPhone: driver.phone,
          driverPlatformUserId: user?.id || remote.order.driverPlatformUserId || null,
        };
        if (Array.isArray(remote.orders)) {
          applyRemoteOrders(
            remote.orders.map((o) => (o.id === orderId ? { ...o, ...stamped } : o))
          );
        } else {
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? stamped : o))
          );
        }
        appendSystemMessage({
          orderId,
          peer: 'driver',
          text: `🚴 ${driver.name} aceitou a entrega.`,
        }).catch(() => {});
        ensureWelcomeMessages({
          orderId,
          peer: 'driver',
          peerName: driver.name,
          businessName: stamped.businessName,
        }).catch(() => {});
        void withPlatformToken((token) => platformUpsertOrder(stamped, token));
        return { ok: true, order: stamped };
      }
      if (remote && remote.ok === false && remote.message) {
        setFleetOnline(true);
        if (Array.isArray(remote.orders)) applyRemoteOrders(remote.orders);
        return { ok: false, error: remote.message };
      }

      // Fallback offline — claim local (um aparelho)
      const current = ordersRef.current.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      if (current.status === 'cancelado' || current.status === 'entregue') {
        return { ok: false, error: 'Pedido não está disponível.' };
      }
      if (current.status === 'pendente' && !current.paymentConfirmed) {
        return { ok: false, error: 'Pedido ainda sem pagamento confirmado.' };
      }
      if (
        current.driverId &&
        !isMockFleetDriverId(current.driverId) &&
        current.driverId !== driver.id
      ) {
        return { ok: false, error: 'Outro entregador já aceitou esta corrida.' };
      }
      if (current.driverId === driver.id) {
        return { ok: true, order: current };
      }
      if (
        !isOfferActive(current) ||
        current.offeredToDriverId !== driver.id
      ) {
        return {
          ok: false,
          error: 'Esta oferta não é mais sua ou expirou. Aguarde a próxima.',
        };
      }
      if (driverHasActiveJob(ordersRef.current, driver.id)) {
        return {
          ok: false,
          error: 'Você já tem uma corrida ativa. Finalize antes de aceitar outra.',
        };
      }

      const next: Order = {
        ...ensureCodes(current),
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        driverPlatformUserId: user?.id || null,
        ...profilePatch,
        offeredToDriverId: null,
        offerExpiresAt: null,
        offerDeclinedBy: [],
        updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));
      appendSystemMessage({
        orderId,
        peer: 'driver',
        text: `🚴 ${driver.name} aceitou a entrega.`,
      }).catch(() => {});
      ensureWelcomeMessages({
        orderId,
        peer: 'driver',
        peerName: driver.name,
        businessName: next.businessName,
      }).catch(() => {});
      void withPlatformToken((token) => platformUpsertOrder(next, token));
      void syncFleet({ force: true, extraOrders: [next] });
      return { ok: true, order: next };
    },
    [applyRemoteOrders, syncFleet, user?.id]
  );

  const releaseDriverFromOrder = useCallback(
    async (orderId: string, driverId: string): Promise<VerifyResult> => {
      const remote = await fleetReleaseRemote({ orderId, fleetId: driverId });
      if (remote?.ok && remote.order) {
        setFleetOnline(true);
        const released = {
          ...clearedDriverAssignment(ensureCodes(remote.order)),
          updatedAt: remote.order.updatedAt || new Date().toISOString(),
        };
        const remoteList = Array.isArray(remote.orders)
          ? remote.orders.map((o) => (o.id === orderId ? released : o))
          : [released];
        applyRemoteOrders(remoteList);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? mergeOrderFields(o, released) : o))
        );
        appendSystemMessage({
          orderId,
          peer: 'driver',
          text: 'Entregador liberou a corrida. Aguardando outro motoboy.',
        }).catch(() => {});
        void withPlatformToken((token) => platformUpsertOrder(released, token));
        return { ok: true, order: released };
      }
      if (remote && remote.ok === false && remote.message) {
        if (Array.isArray(remote.orders)) applyRemoteOrders(remote.orders);
        return { ok: false, error: remote.message };
      }

      const current = ordersRef.current.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      if (current.driverId !== driverId) {
        return { ok: false, error: 'Esta corrida não é sua.' };
      }
      if (current.pickupVerifiedAt || current.status === 'saiu_entrega') {
        return {
          ok: false,
          error: 'Não dá para desistir depois da retirada no comércio.',
        };
      }
      if (current.status === 'entregue' || current.status === 'cancelado') {
        return { ok: false, error: 'Pedido já finalizado.' };
      }
      const next = clearedDriverAssignment(current);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? next : o)));
      appendSystemMessage({
        orderId,
        peer: 'driver',
        text: 'Entregador liberou a corrida. Aguardando outro motoboy.',
      }).catch(() => {});
      void withPlatformToken((token) => platformUpsertOrder(next, token));
      void syncFleet({ force: true, extraOrders: [next] });
      return { ok: true, order: next };
    },
    [applyRemoteOrders, syncFleet]
  );

  const runFairDispatch = useCallback(async () => {
    const remote = await fleetPushAndPull(ordersRef.current, {
      runDispatch: true,
    });
    if (remote?.ok && Array.isArray(remote.orders)) {
      setFleetOnline(true);
      if (remote.persistence) setFleetPersistence(remote.persistence);
      applyRemoteOrders(remote.orders);
      return;
    }
    setFleetOnline(false);
    const snapshot = ordersRef.current;
    const patches = await computeFairDispatchPatches(snapshot);
    if (!patches.length) return;
    setOrders((prev) => applyDispatchPatches(prev, patches));
  }, [applyRemoteOrders]);

  const declineDriverOffer = useCallback(
    async (orderId: string, driverId: string): Promise<VerifyResult> => {
      const remote = await fleetDeclineRemote({ orderId, fleetId: driverId });
      if (remote?.ok && remote.order) {
        setFleetOnline(true);
        if (Array.isArray(remote.orders)) applyRemoteOrders(remote.orders);
        return { ok: true, order: ensureCodes(remote.order) };
      }
      if (remote && remote.ok === false && remote.message) {
        if (Array.isArray(remote.orders)) applyRemoteOrders(remote.orders);
        return { ok: false, error: remote.message };
      }

      const current = ordersRef.current.find((o) => o.id === orderId);
      if (!current) return { ok: false, error: 'Pedido não encontrado.' };
      if (current.offeredToDriverId !== driverId || !isOfferActive(current)) {
        return { ok: false, error: 'Esta oferta não é mais sua.' };
      }
      const declined = Array.from(
        new Set([...(current.offerDeclinedBy ?? []), driverId])
      );
      const afterDecline = ordersRef.current.map((o) =>
        o.id === orderId
          ? {
              ...o,
              offeredToDriverId: null,
              offerExpiresAt: null,
              offerDeclinedBy: declined,
              updatedAt: new Date().toISOString(),
            }
          : o
      );
      const patches = await computeFairDispatchPatches(afterDecline);
      const final = applyDispatchPatches(afterDecline, patches);
      setOrders(final);
      const next = final.find((o) => o.id === orderId)!;
      void syncFleet({ force: true });
      return { ok: true, order: next };
    },
    [applyRemoteOrders, syncFleet]
  );

  const seedFairDispatchDemo = useCallback(async () => {
    if (!__DEV__) return 0;
    const demos = buildFairDispatchDemoOrders();
    const withoutOldDemo = ordersRef.current.filter(
      (o) => !o.id.startsWith('PJFAIR')
    );
    const merged = [...demos, ...withoutOldDemo];
    const patches = await computeFairDispatchPatches(merged);
    const final = applyDispatchPatches(merged, patches);
    setOrders(final);
    void syncFleet({ force: true, runDispatch: true });
    return demos.length;
  }, [syncFleet]);

  const seedDriverLeagueDemo = useCallback(async () => {
    if (!__DEV__) return { drivers: 0, orders: 0 };
    const { accounts, orders: leagueOrders } = await runLeagueSeed();
    setOrders((prev) => {
      const without = prev.filter((o) => !o.id.startsWith(LEAGUE_ORDER_PREFIX));
      return [...leagueOrders, ...without];
    });
    return { drivers: accounts.length, orders: leagueOrders.length };
  }, []);

  const myOrders = useMemo(() => {
    if (!user?.id) return [];
    return orders.filter((o) => o.userId === user.id);
  }, [orders, user?.id]);

  const activeOrders = useMemo(
    () =>
      myOrders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado'),
    [myOrders]
  );

  return (
    <OrdersContext.Provider
      value={{
        orders,
        myOrders,
        isLoading,
        fleetOnline,
        fleetPersistence,
        createOrder,
        getOrder,
        activeOrders,
        confirmOrderPayment,
        cancelOrder,
        confirmPickupByCode,
        confirmDeliveryByCode,
        assignDriverToOrder,
        releaseDriverFromOrder,
        runFairDispatch,
        declineDriverOffer,
        seedFairDispatchDemo,
        seedDriverLeagueDemo,
        markOrderPreparing,
        markOrderKitchenReady,
        togglePreparedLine,
        flagOrderLineUnavailable,
        replaceOrderLine,
        removeUnavailableLine,
      }}
    >
      {children}
      <CustomerChatWatcher />
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error('useOrders deve ser usado dentro de OrdersProvider');
  return context;
}
