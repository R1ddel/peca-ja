/**
 * Normas de saque Peça Já — espelhadas no cliente e no servidor.
 * Alterar aqui atualiza a regra de negócio do Pix-out.
 */

/** Comerciante: mínimo por saque (R$). */
export const MERCHANT_MIN_WITHDRAW = 20;
/** Comerciante: máximo de saques por dia (calendário local). */
export const MERCHANT_MAX_WITHDRAWS_PER_DAY = 1;

/** Entregador: mínimo por saque (R$). */
export const DRIVER_MIN_WITHDRAW = 15;
/** Entregador: máximo de saques por dia. */
export const DRIVER_MAX_WITHDRAWS_PER_DAY = 2;

export function sameLocalCalendarDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
