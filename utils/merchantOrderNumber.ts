import { Order } from '@/types';

/** Próximo número sequencial do estabelecimento (1, 2, 3…). */
export function nextShopOrderNumber(orders: Order[], businessId: string): number {
  let max = 0;
  for (const o of orders) {
    if (o.businessId !== businessId) continue;
    const n = o.shopOrderNumber ?? 0;
    if (n > max) max = n;
  }
  return max + 1;
}

/**
 * Preenche shopOrderNumber em pedidos antigos (por data de criação na loja).
 * Não altera números já gravados.
 */
export function backfillShopOrderNumbers(orders: Order[]): Order[] {
  const byBiz = new Map<string, Order[]>();
  for (const o of orders) {
    const list = byBiz.get(o.businessId) ?? [];
    list.push(o);
    byBiz.set(o.businessId, list);
  }

  const assigned = new Map<string, number>();
  for (const [, list] of byBiz) {
    const sorted = [...list].sort(
      (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
    );
    let cursor = 0;
    for (const o of sorted) {
      if (o.shopOrderNumber != null && o.shopOrderNumber > 0) {
        cursor = Math.max(cursor, o.shopOrderNumber);
      }
    }
    for (const o of sorted) {
      if (o.shopOrderNumber != null && o.shopOrderNumber > 0) continue;
      cursor += 1;
      assigned.set(o.id, cursor);
    }
  }

  if (assigned.size === 0) return orders;
  return orders.map((o) => {
    const n = assigned.get(o.id);
    return n != null ? { ...o, shopOrderNumber: n } : o;
  });
}

/** Rótulo amigável no painel: #12 = 12º pedido da loja. */
export function merchantOrderLabel(
  order: Pick<Order, 'id' | 'shopOrderNumber'>
): string {
  if (order.shopOrderNumber != null && order.shopOrderNumber > 0) {
    return `#${order.shopOrderNumber}`;
  }
  return `#${order.id.slice(-6).toUpperCase()}`;
}
