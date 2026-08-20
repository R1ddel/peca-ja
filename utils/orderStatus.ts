/**
 * Transições válidas de status de pedido.
 */
import type { OrderStatus } from '@/constants/theme';

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pendente: ['confirmado', 'preparando', 'cancelado'],
  confirmado: ['preparando', 'cancelado'],
  preparando: ['saiu_entrega', 'cancelado'],
  saiu_entrega: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};

export function canTransitionOrderStatus(
  from: OrderStatus | string | undefined,
  to: OrderStatus | string | undefined
): boolean {
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = ALLOWED[from as OrderStatus];
  if (!allowed) return false;
  return allowed.includes(to as OrderStatus);
}

/** Se a transição for inválida, mantém o status anterior. */
export function coerceOrderStatus(
  from: OrderStatus | string | undefined,
  to: OrderStatus | string | undefined
): OrderStatus {
  const fallback = (from || 'pendente') as OrderStatus;
  if (!to) return fallback;
  if (canTransitionOrderStatus(from, to)) return to as OrderStatus;
  return fallback;
}
