/**
 * Cobrança de teste (R$ 0,01) — DESLIGADA por padrão.
 * Só ativa em __DEV__ com EXPO_PUBLIC_ALLOW_TEST_PIX=1.
 * Assinatura de comerciante SEMPRE cobra o valor real (forceReal).
 */
const ALLOW_TEST =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  (process.env.EXPO_PUBLIC_ALLOW_TEST_PIX || '').trim() === '1';

/** null em produção / release. Em dev com flag: 0.01 */
export const TEST_PIX_AMOUNT_REAIS: number | null = ALLOW_TEST ? 0.01 : null;

/** True enquanto cobramos o valor de teste (ex.: R$ 0,01) em pedidos. */
export function isPixTestMode(): boolean {
  return ALLOW_TEST && typeof TEST_PIX_AMOUNT_REAIS === 'number' && TEST_PIX_AMOUNT_REAIS > 0;
}

/**
 * @param forceReal — assinatura Peça Já / valores que não podem ser R$ 0,01
 */
export function resolvePixChargeAmount(
  realTotal: number,
  opts?: { forceReal?: boolean }
): number {
  if (!opts?.forceReal && isPixTestMode()) {
    return Math.round(TEST_PIX_AMOUNT_REAIS! * 100) / 100;
  }
  return Math.round(Math.max(0, realTotal) * 100) / 100;
}
