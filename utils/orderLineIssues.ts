import { Order, CartItem, OrderLineIssue } from '@/types';
import {
  countOrderItemUnits,
  resolveCustomerTotal,
  resolveEstablishmentAmount,
  resolvePlatformFee,
} from '@/constants/pricing';
import { getLineTotal } from '@/utils/cartLine';

/** Issues ainda aguardando ação do cliente. */
export function pendingLineIssues(order: Order): OrderLineIssue[] {
  return (order.lineIssues ?? []).filter((i) => i.status === 'awaiting_customer');
}

export function hasPendingLineIssues(order: Order): boolean {
  return pendingLineIssues(order).length > 0;
}

export function getLineIssue(order: Order, lineId: string): OrderLineIssue | undefined {
  return order.lineIssues?.find((i) => i.lineId === lineId && i.status === 'awaiting_customer');
}

/** Loja/cliente podem sinalizar ou trocar só antes de pronto/retirada. */
export function canFlagOrReplaceLine(order: Order): boolean {
  if (order.kitchenReadyAt || order.pickupVerifiedAt) return false;
  if (order.status === 'cancelado' || order.status === 'entregue' || order.status === 'saiu_entrega') {
    return false;
  }
  return (
    order.status === 'confirmado' ||
    order.status === 'preparando' ||
    (order.status === 'pendente' && !!order.paymentConfirmed)
  );
}

/**
 * Recalcula subtotal/total/caixa após troca ou remoção de item.
 * Taxa Peça Já sobe no total do cliente e NÃO reduz o valor da loja.
 */
export function recomputeOrderMoney(
  order: Order,
  items: CartItem[]
): Pick<Order, 'items' | 'subtotal' | 'total' | 'establishmentAmount' | 'platformFee' | 'driverAmount'> {
  const discount = order.discount ?? 0;
  const subtotal =
    Math.round(items.reduce((s, l) => s + getLineTotal(l), 0) * 100) / 100;
  const itemUnits = countOrderItemUnits(items);
  const platformFee = resolvePlatformFee(itemUnits);
  const total = resolveCustomerTotal(subtotal, order.deliveryFee, discount, platformFee);
  const establishmentAmount = resolveEstablishmentAmount(subtotal, discount);

  return {
    items,
    subtotal,
    total,
    platformFee,
    establishmentAmount,
    driverAmount: order.driverAmount ?? order.deliveryFee,
  };
}

/** @deprecated use recomputeOrderMoney */
export function recomputeOrderTotals(
  order: Order,
  items: Order['items'],
  discount = order.discount ?? 0
) {
  return recomputeOrderMoney({ ...order, discount }, items);
}
