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
