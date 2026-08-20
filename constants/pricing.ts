/** Regras financeiras do Peça Já (MVP local). */

/**
 * Taxa Peça Já por unidade de item no pedido.
 * Sobe o preço para o cliente (+R$ 2) e NÃO sai do bolso do comerciante.
 */
export const PLATFORM_FEE_PER_ITEM = 2;

/**
 * Alias legado — preferir PLATFORM_FEE_PER_ITEM / resolvePlatformFee.
 * Mantido como valor unitário (R$ 2).
 */
export const PLATFORM_FEE = PLATFORM_FEE_PER_ITEM;

/**
 * Frete urbano padrão (dentro da cidade / até ~7 km).
 * Fora da cidade: R$ 15 até 13 km; além disso o GPS sobe (ver payment.ts).
 */
export const DELIVERY_FEE_MIN = 5.0;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Taxa Peça Já do pedido = R$ 2 × quantidade de itens. */
export function resolvePlatformFee(itemUnits: number): number {
  return roundMoney(Math.max(0, itemUnits) * PLATFORM_FEE_PER_ITEM);
}

/** Conta unidades no carrinho/pedido. */
export function countOrderItemUnits(
  items: { quantity?: number }[] | undefined | null
): number {
  if (!items?.length) return 0;
  return items.reduce((s, i) => s + Math.max(0, i.quantity ?? 1), 0);
}

/** Frete cobrado do cliente sem GPS: mínimo urbano R$ 5. */
export function resolveDeliveryFee(businessFee?: number | null): number {
  const fee = businessFee ?? DELIVERY_FEE_MIN;
  return Math.max(DELIVERY_FEE_MIN, fee);
}

/**
 * Total pago pelo cliente = produtos + frete + taxa Peça Já − desconto.
 * A taxa é cobrada a mais (não descontada da loja).
 */
export function resolveCustomerTotal(
  subtotal: number,
  deliveryFee: number,
  discount = 0,
  platformFee = 0
): number {
  return roundMoney(
    Math.max(0, subtotal - Math.max(0, discount) + deliveryFee + Math.max(0, platformFee))
  );
}

/**
 * Quanto a loja recebe: o preço que cadastrou (subtotal − desconto).
 * A taxa Peça Já NÃO reduz este valor.
 */
export function resolveEstablishmentAmount(subtotal: number, discount = 0): number {
  return roundMoney(Math.max(0, subtotal - Math.max(0, discount)));
}

/** Texto curto para o comerciante (cardápio, formulário, cadastro). */
export const PLATFORM_FEE_MERCHANT_NOTICE =
  'Cadastre o valor que você quer receber (ex.: R$ 10,00). No app o cliente vê R$ 12,00 (+ R$ 2,00 por item de taxa Peça Já). Esse acréscimo não sai do seu bolso — você recebe exatamente o que cadastrou.';

/** Versão compacta — rodapé do cardápio junto ao termo. */
export const PLATFORM_FEE_MERCHANT_NOTICE_FOOTER =
  `Taxa Peça Já: +R$ ${PLATFORM_FEE_PER_ITEM.toFixed(2).replace('.', ',')} por item no preço do cliente (ex.: cadastrou R$ 10 → cliente vê R$ 12). Não desconta do valor da loja.`;

/** Preço unitário que o cliente vê (cadastro da loja + taxa por item). */
export function customerUnitPrice(merchantUnitPrice: number): number {
  return roundMoney(Math.max(0, merchantUnitPrice) + PLATFORM_FEE_PER_ITEM);
}

/** Subtotal do cliente = subtotal da loja + taxa embutida por unidade. */
export function customerSubtotalFromMerchant(
  merchantSubtotal: number,
  itemUnits: number
): number {
  return roundMoney(Math.max(0, merchantSubtotal) + resolvePlatformFee(itemUnits));
}

/** Texto curto para o cliente no checkout. @deprecated Taxa embutida — não exibir ao cliente. */
export function platformFeeCustomerHint(fee: number, units: number): string {
  const feeLabel = fee.toFixed(2).replace('.', ',');
  if (units <= 1) {
    return `Taxa Peça Já R$ ${feeLabel}: valor a mais no pedido (não descontado do comércio).`;
  }
  return `Taxa Peça Já R$ ${feeLabel} (R$ ${PLATFORM_FEE_PER_ITEM.toFixed(2).replace('.', ',')} × ${units} itens): sobe no total e não sai do bolso da loja.`;
}
