/**
 * Critérios compartilhados — mapa ao vivo do entregador (home + pedido).
 */
import type { Order } from '@/types';
import { isMockFleetDriverId } from '@/utils/driverOps';

export function hasPlatformDriver(order: Order): boolean {
  return !!order.driverId && !isMockFleetDriverId(order.driverId);
}

/** Pedido elegível para mapa com motoboy real (pagamento confirmado). */
export function isCustomerLiveMapOrder(order: Order): boolean {
  if (!order.paymentConfirmed) return false;
  if (order.status === 'entregue' || order.status === 'cancelado' || order.status === 'pendente') {
    return false;
  }
  if (!hasPlatformDriver(order)) return false;
  return true;
}

/**
 * A loja saiu para entregar sem motoboy da Peça Já.
 * Nesse caso não há mapa: a tela diz que a loja entrega.
 */
export function isStoreOwnDelivery(order: Order): boolean {
  if (!order.paymentConfirmed) return false;
  if (order.status !== 'saiu_entrega') return false;
  return !hasPlatformDriver(order);
}

/** Motoboy já saiu da loja / a caminho do cliente. */
export function isDriverEnRouteToCustomer(order: Order): boolean {
  return !!order.pickupVerifiedAt || order.status === 'saiu_entrega';
}

/** Melhor pedido para exibir no mapa da home (prioriza rota até o cliente). */
export function pickHomeLiveMapOrder(orders: Order[], userId?: string | null): Order | null {
  if (!userId) return null;
  const mine = orders.filter((o) => o.userId === userId && isCustomerLiveMapOrder(o));
  if (!mine.length) return null;
  mine.sort((a, b) => {
    const aEnRoute = isDriverEnRouteToCustomer(a) ? 1 : 0;
    const bEnRoute = isDriverEnRouteToCustomer(b) ? 1 : 0;
    if (bEnRoute !== aEnRoute) return bEnRoute - aEnRoute;
    return +new Date(b.updatedAt) - +new Date(a.updatedAt);
  });
  return mine[0] ?? null;
}

/** Entrega confirmada há pouco: a home troca o mapa por esta conclusão. */
export function pickHomeJustDelivered(
  orders: Order[],
  userId?: string | null,
  nowMs = Date.now()
): Order | null {
  if (!userId) return null;
  const windowMs = 45 * 60 * 1000;
  const mine = orders.filter((o) => {
    if (o.userId !== userId || o.status !== 'entregue') return false;
    const t = +new Date(o.deliveryVerifiedAt || o.updatedAt || 0);
    return Number.isFinite(t) && nowMs - t < windowMs;
  });
  if (!mine.length) return null;
  mine.sort(
    (a, b) =>
      +new Date(b.deliveryVerifiedAt || b.updatedAt) -
      +new Date(a.deliveryVerifiedAt || a.updatedAt)
  );
  return mine[0] ?? null;
}

/** Pedido da home em que a própria loja está entregando. */
export function pickHomeStoreDelivery(orders: Order[], userId?: string | null): Order | null {
  if (!userId) return null;
  const mine = orders.filter((o) => o.userId === userId && isStoreOwnDelivery(o));
  if (!mine.length) return null;
  mine.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  return mine[0] ?? null;
}
