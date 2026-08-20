/**
 * Critérios compartilhados — mapa ao vivo do entregador (home + pedido).
 */
import type { Order } from '@/types';
import { isMockFleetDriverId } from '@/utils/driverOps';

/** Pedido elegível para mapa com motoboy real (pagamento confirmado). */
export function isCustomerLiveMapOrder(order: Order): boolean {
  if (!order.paymentConfirmed) return false;
  if (order.status === 'entregue' || order.status === 'cancelado' || order.status === 'pendente') {
    return false;
  }
  if (!order.driverId || isMockFleetDriverId(order.driverId)) return false;
  return true;
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
