/**
 * Cupons promocionais: plataforma (demo) + loja (bolso do comerciante).
 */
import {
  findMerchantCoupon,
  MerchantPromo,
  normalizePromoCode as normalizeMerchantCode,
} from '@/utils/merchantPromos';

export type CouponType = 'percent' | 'fixed' | 'free_delivery';

export type CouponDef = {
  code: string;
  type: CouponType;
  /** percent: 0–100; fixed: R$; free_delivery: ignorado */
  value: number;
  maxDiscount?: number;
  label: string;
  minSubtotal?: number;
  /** Quem banca o benefício. */
  fundedBy?: 'platform' | 'merchant';
  /** id da promoção da loja (quando fundedBy = merchant). */
  merchantPromoId?: string;
};

export const COUPONS: Record<string, CouponDef> = {
  PECAJA10: {
    code: 'PECAJA10',
    type: 'percent',
    value: 10,
    maxDiscount: 15,
    label: '10% de desconto (máx. R$ 15)',
    minSubtotal: 20,
    fundedBy: 'platform',
  },
  BEMVINDO: {
    code: 'BEMVINDO',
    type: 'fixed',
    value: 8,
    label: 'R$ 8 de desconto',
    minSubtotal: 25,
    fundedBy: 'platform',
  },
  FRETEGRATIS: {
    code: 'FRETEGRATIS',
    type: 'free_delivery',
    value: 0,
    label: 'Frete grátis',
    minSubtotal: 15,
    fundedBy: 'platform',
  },
};

export type CouponResult =
  | {
      ok: true;
      coupon: CouponDef;
      discount: number;
      deliveryFee: number;
      freeDelivery: boolean;
      /** Frete que a loja cobre (cliente paga 0; entregador ainda recebe). */
      merchantAbsorbsDelivery: number;
    }
  | {
      ok: false;
      error: string;
    };

export function normalizeCouponCode(raw: string): string {
  return normalizeMerchantCode(raw);
}

function promoToCoupon(p: MerchantPromo): CouponDef {
  return {
    code: p.code || `AUTO_${p.id}`,
    type: p.type,
    value: p.value,
    maxDiscount: p.maxDiscount,
    label: p.title,
    minSubtotal: p.minSubtotal,
    fundedBy: 'merchant',
    merchantPromoId: p.id,
  };
}

function evaluateCoupon(
  coupon: CouponDef,
  input: { subtotal: number; deliveryFee: number; clubDiscount?: number }
): CouponResult {
  const min = coupon.minSubtotal ?? 0;
  if (input.subtotal < min) {
    return {
      ok: false,
      error: `Este cupom vale a partir de R$ ${min.toFixed(2).replace('.', ',')}.`,
    };
  }

  let discount = 0;
  let deliveryFee = input.deliveryFee;
  let freeDelivery = false;
  let merchantAbsorbsDelivery = 0;

  if (coupon.type === 'percent') {
    discount = Math.round(input.subtotal * (coupon.value / 100) * 100) / 100;
    if (coupon.maxDiscount != null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else if (coupon.type === 'fixed') {
    discount = Math.min(coupon.value, input.subtotal);
  } else if (coupon.type === 'free_delivery') {
    freeDelivery = true;
    if (coupon.fundedBy === 'merchant') {
      merchantAbsorbsDelivery = input.deliveryFee;
    }
    deliveryFee = 0;
  }

  const club = Math.max(0, input.clubDiscount ?? 0);
  discount = Math.min(discount, Math.max(0, input.subtotal - club));

  return {
    ok: true,
    coupon,
    discount,
    deliveryFee,
    freeDelivery,
    merchantAbsorbsDelivery,
  };
}

export function applyCoupon(input: {
  code: string;
  subtotal: number;
  deliveryFee: number;
  /** Desconto já aplicado pelo clube. */
  clubDiscount?: number;
  /** Cupons ativos da loja atual. */
  merchantPromos?: MerchantPromo[];
}): CouponResult {
  const code = normalizeCouponCode(input.code);
  if (!code) {
    return { ok: false, error: 'Digite um cupom.' };
  }

  const merchant = input.merchantPromos
    ? findMerchantCoupon(input.merchantPromos, code)
    : null;
  if (merchant) {
    return evaluateCoupon(promoToCoupon(merchant), input);
  }

  const coupon = COUPONS[code];
  if (!coupon) {
    return { ok: false, error: 'Cupom inválido ou expirado.' };
  }

  return evaluateCoupon(coupon, input);
}

/** Aplica promoção automática da loja (sem código). */
export function applyMerchantAutoPromo(input: {
  promo: MerchantPromo;
  subtotal: number;
  deliveryFee: number;
  clubDiscount?: number;
}): CouponResult {
  return evaluateCoupon(promoToCoupon(input.promo), input);
}
