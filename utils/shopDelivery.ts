/**
 * Quem entrega a loja e como o dinheiro em espécie muda de mão.
 * Pix e cartão não passam por aqui: o app reparte sozinho.
 */
import type { Order } from '@/types';
import { resolveEstablishmentAmount, roundMoney } from '@/constants/pricing';

/** store = entregador da própria loja. app = motoboy da Peça Já. */
export type ShopDeliveryMode = 'store' | 'app';

export function normalizeDeliveryMode(value: unknown): ShopDeliveryMode {
  return value === 'store' ? 'store' : 'app';
}

export function isCashOnDelivery(order: Pick<Order, 'paymentProvider'>): boolean {
  return order.paymentProvider === 'offline';
}

export type CashHandoff = {
  mode: ShopDeliveryMode;
  /** Valor dos produtos, já com desconto. É o que a loja tem que receber. */
  storeAmount: number;
  /** Total que o cliente paga na porta. */
  collectAtDoor: number;
  /** Frete. Fica com quem fez a entrega. */
  deliveryFee: number;
  /** Taxa Peça Já. Não é da loja nem do frete. */
  platformFee: number;
};

/** Contas do dinheiro vivo. Só existe em pedido pago na entrega. */
export function cashHandoffForOrder(order: Order): CashHandoff | null {
  if (!isCashOnDelivery(order)) return null;
  if (order.deliveryBy !== 'store') return null;
  const storeAmount =
    typeof order.establishmentAmount === 'number'
      ? roundMoney(Math.max(0, order.establishmentAmount))
      : resolveEstablishmentAmount(order.subtotal, order.discount ?? 0);
  return {
    mode: order.deliveryBy === 'store' ? 'store' : 'app',
    storeAmount,
    collectAtDoor: roundMoney(Math.max(0, order.total)),
    deliveryFee: roundMoney(Math.max(0, order.deliveryFee)),
    platformFee: roundMoney(Math.max(0, order.platformFee ?? 0)),
  };
}
