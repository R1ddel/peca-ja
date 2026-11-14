/**
 * Janela em que cliente/comércio podem cancelar o pedido após a criação.
 */
export const ORDER_CANCEL_WINDOW_MS = 2 * 60 * 1000;

export function orderCancelDeadlineMs(createdAt: string | undefined): number {
  const t = createdAt ? +new Date(createdAt) : NaN;
  if (!Number.isFinite(t)) return 0;
  return t + ORDER_CANCEL_WINDOW_MS;
}

/** true enquanto ainda faltam ≤ 2 min desde createdAt. */
export function isWithinOrderCancelWindow(
  createdAt: string | undefined,
  nowMs = Date.now()
): boolean {
  const deadline = orderCancelDeadlineMs(createdAt);
  if (!deadline) return false;
  return nowMs <= deadline;
}

/** Tolerância da entrega, depois do prazo combinado. Não muda. */
export const DELIVERY_WAIT_MS = 20 * 60 * 1000;

/** Tolerância da loja para deixar o pedido pronto, depois do prazo que ela deu. */
export const STORE_WAIT_MS = 35 * 60 * 1000;

/** @deprecated Use DELIVERY_WAIT_MS. Mantido para não quebrar import antigo. */
export const LATE_REFUND_GRACE_MS = DELIVERY_WAIT_MS;

type CancelPolicyOrder = {
  createdAt?: string;
  status: string;
  pickupVerifiedAt?: string | null;
  kitchenReadyAt?: string | null;
  estimatedDelivery?: string;
  paymentConfirmed?: boolean;
  paymentProvider?: string;
  deliveryBy?: string;
};

/** Maior minuto de um texto tipo "30-45 min". Sem número, usa 45 (padrão da loja). */
export function deliveryPromiseMinutes(label: string | undefined): number {
  const nums = String(label || '')
    .match(/\d+/g)
    ?.map((n) => Number(n))
    .filter((n) => n > 0 && n < 24 * 60);
  if (!nums?.length) return 45;
  return Math.max(...nums);
}

function promiseMinutes(label: string | undefined): number {
  const text = String(label || '').toLowerCase();
  const hour = text.match(/(\d+)\s*hora/);
  if (hour) return Math.min(24 * 60, Math.max(1, Number(hour[1]) * 60));
  const hm = text.match(/(\d+)\s*h(?:\s*(\d+))?/);
  if (hm) return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
  return deliveryPromiseMinutes(label);
}

function leftStore(order: CancelPolicyOrder): boolean {
  return !!order.pickupVerifiedAt || order.status === 'saiu_entrega';
}

/** Loja: prazo informado + 35 min, contado da criação, enquanto o pedido não fica pronto. */
export function storeReadyDeadlineMs(order: CancelPolicyOrder): number {
  const created = order.createdAt ? +new Date(order.createdAt) : NaN;
  if (!Number.isFinite(created)) return 0;
  return created + promiseMinutes(order.estimatedDelivery) * 60_000 + STORE_WAIT_MS;
}

/**
 * Entrega: prazo informado + 20 min.
 * Começa quando sai da loja. Se ainda não saiu, mas já está pronto, começa nesse instante.
 */
export function deliveryLateDeadlineMs(order: CancelPolicyOrder): number {
  const startIso = order.pickupVerifiedAt || order.kitchenReadyAt;
  const start = startIso ? +new Date(startIso) : NaN;
  if (!Number.isFinite(start)) return 0;
  return start + promiseMinutes(order.estimatedDelivery) * 60_000 + DELIVERY_WAIT_MS;
}

export type DelayCancelKind = 'store' | 'delivery';

/** Opção do cliente. Não cancela sozinho: ele pode esperar. */
export function customerDelayCancel(
  order: CancelPolicyOrder,
  nowMs = Date.now()
): DelayCancelKind | null {
  if (order.status === 'cancelado' || order.status === 'entregue') return null;
  if (!leftStore(order) && !order.kitchenReadyAt) {
    const deadline = storeReadyDeadlineMs(order);
    return deadline > 0 && nowMs >= deadline ? 'store' : null;
  }
  const deadline = deliveryLateDeadlineMs(order);
  return deadline > 0 && nowMs >= deadline ? 'delivery' : null;
}

/**
 * Vazio = pode cancelar (o estorno segue se o pagamento foi confirmado).
 * Cliente: antes da loja aceitar, nos 2 min iniciais, ou depois da tolerância de atraso.
 * A tolerância abre a opção. O cliente pode esperar e não cancelar.
 * Loja: antes da retirada, com estorno integral.
 */
export function orderCancelBlockReason(
  order: CancelPolicyOrder,
  by: 'customer' | 'merchant' | 'system' = 'customer',
  nowMs = Date.now()
): string {
  if (order.status === 'cancelado') return 'Pedido já cancelado.';
  if (order.status === 'entregue') {
    return 'Pedido já entregue. Problema no item precisa de análise do suporte.';
  }

  if (by === 'merchant' || by === 'system') {
    if (leftStore(order)) {
      return 'O entregador já retirou o pedido. O cliente pode cancelar com reembolso 20 minutos depois do prazo da entrega.';
    }
    return '';
  }

  if (order.status === 'pendente') return '';

  if (!leftStore(order) && isWithinOrderCancelWindow(order.createdAt, nowMs)) {
    return '';
  }

  if (customerDelayCancel(order, nowMs)) return '';

  if (leftStore(order) || order.kitchenReadyAt) {
    return 'O pedido já está a caminho. Você pode cancelar e receber o reembolso 20 minutos depois do prazo da entrega. Se quiser esperar, o pedido continua.';
  }

  return 'A loja já aceitou o pedido. Você pode cancelar e receber o reembolso se ele não ficar pronto no prazo informado mais 35 minutos. Se quiser esperar, o pedido continua.';
}

export function orderCancelWindowError(createdAt: string | undefined): string {
  if (!isWithinOrderCancelWindow(createdAt)) {
    return 'O cancelamento só é permitido nos primeiros 2 minutos após o pedido.';
  }
  return '';
}

/** Segundos restantes (0 se já expirou). */
export function orderCancelSecondsLeft(
  createdAt: string | undefined,
  nowMs = Date.now()
): number {
  const left = orderCancelDeadlineMs(createdAt) - nowMs;
  return Math.max(0, Math.ceil(left / 1000));
}
