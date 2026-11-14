/**
 * Pagamentos que a loja aceita. Pix e cartão cobram online.
 * Dinheiro e métodos criados pela loja ficam para pagar na entrega.
 */

export type ShopPaymentMethod = {
  id: string;
  label: string;
  enabled: boolean;
  /** Criado pela loja (não é Pix, cartão nem dinheiro). */
  custom?: boolean;
};

export type PaymentOffer = {
  id: string;
  label: string;
  hint: string;
  icon: 'qr-code' | 'card' | 'cash' | 'wallet-outline';
  /** pix e card passam pelo Mercado Pago. O resto só registra no pedido. */
  kind: 'pix' | 'card' | 'offline';
};

const BUILTIN: ShopPaymentMethod[] = [
  { id: 'pix', label: 'Pix', enabled: true },
  { id: 'card', label: 'Cartão', enabled: true },
  { id: 'cash', label: 'Dinheiro na entrega', enabled: false },
];

export function defaultShopPayments(): ShopPaymentMethod[] {
  return BUILTIN.map((method) => ({ ...method }));
}

export function normalizeShopPayments(
  raw?: ShopPaymentMethod[] | null
): ShopPaymentMethod[] {
  const customs = (raw ?? []).filter((method) => method.custom && method.label.trim());
  const byId = new Map((raw ?? []).map((method) => [method.id, method]));
  const builtins = BUILTIN.map((method) => {
    const saved = byId.get(method.id);
    if (!saved) return { ...method };
    return {
      ...method,
      enabled: saved.enabled !== false,
    };
  });
  const extra = customs.map((method) => ({
    id: method.id,
    label: method.label.trim(),
    enabled: method.enabled !== false,
    custom: true as const,
  }));
  const merged = [...builtins, ...extra];
  if (!merged.some((method) => method.enabled)) {
    return merged.map((method) => (method.id === 'pix' ? { ...method, enabled: true } : method));
  }
  return merged;
}

/** No motoboy do app, dinheiro e outras formas na entrega ficam de fora. */
export function offersForCheckout(
  raw?: ShopPaymentMethod[] | null,
  deliveryBy?: 'store' | 'app' | null
): PaymentOffer[] {
  const offers = offersFromShop(raw);
  if (deliveryBy === 'store') return offers;
  return offers.filter((offer) => offer.kind !== 'offline');
}

export function offersFromShop(raw?: ShopPaymentMethod[] | null): PaymentOffer[] {
  return normalizeShopPayments(raw)
    .filter((method) => method.enabled)
    .map((method) => {
      if (method.id === 'pix') {
        return {
          id: method.id,
          label: method.label,
          hint: 'QR Code · confirmação automática do banco',
          icon: 'qr-code' as const,
          kind: 'pix' as const,
        };
      }
      if (method.id === 'card') {
        return {
          id: method.id,
          label: method.label,
          hint: 'Crédito ou débito salvo · confirmação do banco',
          icon: 'card' as const,
          kind: 'card' as const,
        };
      }
      if (method.id === 'cash') {
        return {
          id: method.id,
          label: method.label,
          hint: 'Você paga ao receber o pedido',
          icon: 'cash' as const,
          kind: 'offline' as const,
        };
      }
      return {
        id: method.id,
        label: method.label,
        hint: 'Combinado com a loja · paga na entrega',
        icon: 'wallet-outline' as const,
        kind: 'offline' as const,
      };
    });
}

export function paymentSummary(
  raw?: ShopPaymentMethod[] | null,
  deliveryBy?: 'store' | 'app' | null
): string {
  const enabled = offersForCheckout(raw, deliveryBy);
  if (!enabled.length) return 'Pix';
  return enabled.map((method) => method.label).join(' · ');
}

export function newCustomPayment(label: string): ShopPaymentMethod | null {
  const name = label.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return null;
  return {
    id: `custom_${Date.now().toString(36)}`,
    label: name.slice(0, 32),
    enabled: true,
    custom: true,
  };
}
