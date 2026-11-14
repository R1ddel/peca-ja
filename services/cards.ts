/**
 * Cofre de cartões do cliente.
 *
 * - Número e CVV NUNCA são persistidos.
 * - Salvamos só metadados + ids do Mercado Pago (customer/card).
 * - Cobrança só confirma pedido quando o MP retorna approved.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '@/services/apiBase';
import type { PaymentSplit } from '@/services/payment';

const CARDS_KEY = '@pecaja_saved_cards_v2';

export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'unknown';
export type CardKind = 'credit' | 'debit';

export type SavedCard = {
  id: string;
  /** Compat / fallback local — preferir mpCardId. */
  token: string;
  mpCustomerId?: string;
  mpCardId?: string;
  paymentMethodId?: string;
  brand: CardBrand;
  last4: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  kind: CardKind;
  isDefault: boolean;
  createdAt: string;
  /** Cartão de teste Mercado Pago (CVV de teste: 123). */
  isGhostTest?: boolean;
};

export type NewCardInput = {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  kind: CardKind;
  setAsDefault?: boolean;
  email: string;
  /** CPF só para tokenizar no MP — não é persistido. */
  identificationNumber: string;
  isGhostTest?: boolean;
};

export type CardChargeResult =
  | {
      ok: true;
      chargeId: string;
      status: 'paid' | 'awaiting_payment' | 'pending' | 'failed';
      amount: number;
      split?: PaymentSplit;
      provider: 'mercadopago';
      statusDetail?: string | null;
    }
  | { ok: false; error: string };

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Luhn — validação básica de número. */
export function isValidCardNumber(number: string): boolean {
  const digits = onlyDigits(number);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function detectBrand(number: string): CardBrand {
  const d = onlyDigits(number);
  if (/^4/.test(d)) return 'visa';
  // Mastercard: 51–55, 2221–2720 e BINs de teste 50xx (ex.: 5031…)
  if (/^5[1-5]/.test(d) || /^2(2[2-9]|[3-6]\d|7[01])/.test(d) || /^50/.test(d)) {
    return 'mastercard';
  }
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(d)) return 'elo';
  if (/^(606282|3841)/.test(d)) return 'hipercard';
  return 'unknown';
}

export function brandLabel(brand: CardBrand): string {
  const map: Record<CardBrand, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    elo: 'Elo',
    amex: 'Amex',
    hipercard: 'Hipercard',
    unknown: 'Cartão',
  };
  return map[brand];
}

export function formatCardNumberInput(value: string): string {
  const d = onlyDigits(value).slice(0, 19);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function formatExpiryInput(value: string): string {
  const d = onlyDigits(value).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function formatCpfInput(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskCardLabel(card: SavedCard): string {
  return `${brandLabel(card.brand)} •••• ${card.last4}`;
}

export function isCardChargeable(card: SavedCard): boolean {
  return !!(
    card.mpCustomerId &&
    card.mpCardId &&
    card.paymentMethodId &&
    !String(card.mpCardId).startsWith('test_')
  );
}

export async function loadSavedCards(): Promise<SavedCard[]> {
  try {
    const raw = await AsyncStorage.getItem(CARDS_KEY);
    if (!raw) {
      // Migra cofre antigo se existir (cartões sem MP precisarão ser recadastrados)
      const legacy = await AsyncStorage.getItem('@pecaja_saved_cards');
      if (!legacy) return [];
      const parsed = JSON.parse(legacy);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (c) => c && typeof c.id === 'string' && typeof c.last4 === 'string'
      ) as SavedCard[];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c) =>
        c &&
        typeof c.id === 'string' &&
        typeof c.last4 === 'string' &&
        typeof c.token === 'string'
    ) as SavedCard[];
  } catch {
    return [];
  }
}

async function persist(cards: SavedCard[]): Promise<void> {
  await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(cards));
}

export type AddCardResult =
  | { ok: true; card: SavedCard }
  | { ok: false; error: string };

export async function addSavedCard(input: NewCardInput): Promise<AddCardResult> {
  const number = onlyDigits(input.number);
  const holderName = input.holderName.trim();
  const cvv = onlyDigits(input.cvv);
  const cpf = onlyDigits(input.identificationNumber);
  const expMonth = Number(onlyDigits(input.expMonth));
  let expYear = Number(onlyDigits(input.expYear));
  if (expYear < 100) expYear += 2000;

  if (!holderName || holderName.length < 3) {
    return { ok: false, error: 'Informe o nome impresso no cartão.' };
  }
  if (!isValidCardNumber(number)) {
    return { ok: false, error: 'Número do cartão inválido.' };
  }
  if (!expMonth || expMonth < 1 || expMonth > 12) {
    return { ok: false, error: 'Mês de validade inválido.' };
  }
  const now = new Date();
  const expDate = new Date(expYear, expMonth, 0);
  if (expDate < new Date(now.getFullYear(), now.getMonth(), 1)) {
    return { ok: false, error: 'Cartão vencido.' };
  }
  if (cvv.length < 3 || cvv.length > 4) {
    return { ok: false, error: 'CVV inválido.' };
  }
  if (cpf.length !== 11) {
    return { ok: false, error: 'Informe um CPF válido.' };
  }
  if (!input.email?.includes('@')) {
    return { ok: false, error: 'E-mail da conta inválido. Faça login novamente.' };
  }

  const brand = detectBrand(number);
  const last4 = number.slice(-4);
  const existing = await loadSavedCards();

  if (
    existing.some(
      (c) => c.last4 === last4 && c.expMonth === expMonth && c.expYear === expYear
    )
  ) {
    return { ok: false, error: 'Este cartão já está cadastrado.' };
  }

  try {
    const base = getApiBaseUrl();
    const { getPlatformToken } = await import('@/services/platformSession');
    const platformToken = await getPlatformToken();
    if (!platformToken) {
      return { ok: false, error: 'Faça login na conta para cadastrar cartão.' };
    }
    const res = await fetch(`${base}/api/payments/card/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${platformToken}`,
      },
      body: JSON.stringify({
        number,
        holderName,
        expMonth,
        expYear,
        cvv,
        kind: input.kind,
        email: input.email,
        identificationNumber: cpf,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.card?.mpCardId) {
      return {
        ok: false,
        error: data?.message || 'Não foi possível salvar o cartão no Mercado Pago.',
      };
    }

    const makeDefault = input.setAsDefault || existing.length === 0;
    const card: SavedCard = {
      id: `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      token: String(data.card.mpCardId),
      mpCustomerId: String(data.card.mpCustomerId),
      mpCardId: String(data.card.mpCardId),
      paymentMethodId: String(data.card.paymentMethodId),
      brand: (data.card.brand as CardBrand) || brand,
      last4: String(data.card.last4 || last4),
      holderName: String(data.card.holderName || holderName.toUpperCase()),
      expMonth: Number(data.card.expMonth || expMonth),
      expYear: Number(data.card.expYear || expYear),
      kind: data.card.kind === 'debit' ? 'debit' : 'credit',
      isDefault: makeDefault,
      createdAt: new Date().toISOString(),
      isGhostTest: !!(input.isGhostTest || data.card.localTest),
    };

    const next = makeDefault
      ? [card, ...existing.map((c) => ({ ...c, isDefault: false }))]
      : [...existing, card];

    await persist(next);
    return { ok: true, card };
  } catch {
    return {
      ok: false,
      error:
        'Falha de conexão ao salvar o cartão. Verifique o Expo (API) e tente de novo.',
    };
  }
}

/** Só existe em desenvolvimento — nunca vai no bundle de produção. */
export async function registerGhostTestCard(email: string): Promise<AddCardResult> {
  if (!__DEV__) {
    return { ok: false, error: 'Cartão de teste indisponível neste ambiente.' };
  }
  const existing = await loadSavedCards();
  const already = existing.find((c) => c.last4 === '6351' || c.last4 === '3311');
  if (already) {
    return { ok: true, card: already };
  }
  return { ok: false, error: 'Use o sandbox do Mercado Pago para cartões de teste.' };
}

export async function removeSavedCard(cardId: string): Promise<SavedCard[]> {
  const existing = await loadSavedCards();
  let next = existing.filter((c) => c.id !== cardId);
  if (next.length > 0 && !next.some((c) => c.isDefault)) {
    next = next.map((c, i) => ({ ...c, isDefault: i === 0 }));
  }
  await persist(next);
  return next;
}

export async function setDefaultCard(cardId: string): Promise<SavedCard[]> {
  const existing = await loadSavedCards();
  const next = existing.map((c) => ({ ...c, isDefault: c.id === cardId }));
  await persist(next);
  return next;
}

export type ChargeSavedCardInput = {
  card: SavedCard;
  amount: number;
  cvv: string;
  orderDraftId: string;
  businessId: string;
  businessName: string;
  customerEmail: string;
  customerName: string;
  subtotal: number;
  businessDeliveryFee?: number | null;
  deliveryFeeOverride?: number;
  discount?: number;
  merchantAbsorbsDelivery?: number;
  itemUnits?: number;
  applicationId?: string;
  plan?: string;
};

/** Cobra cartão salvo no Mercado Pago. Pedido só deve confirmar se status = paid. */
export async function chargeSavedCard(
  opts: ChargeSavedCardInput
): Promise<CardChargeResult> {
  if (!isCardChargeable(opts.card)) {
    return {
      ok: false,
      error: 'Este cartão precisa ser cadastrado de novo para cobrança real.',
    };
  }
  const cvv = onlyDigits(opts.cvv);
  if (cvv.length < 3 || cvv.length > 4) {
    return { ok: false, error: 'Informe o CVV do cartão.' };
  }
  if (opts.amount <= 0) {
    return { ok: false, error: 'Valor inválido para cobrança.' };
  }

  try {
    const { fetchPaymentsJson } = await import('@/services/paymentsFetch');
    const hit = await fetchPaymentsJson('/api/payments/card/charge', {
      method: 'POST',
      body: JSON.stringify({
        mpCustomerId: opts.card.mpCustomerId,
        mpCardId: opts.card.mpCardId,
        securityCode: cvv,
        paymentMethodId: opts.card.paymentMethodId,
        orderDraftId: opts.orderDraftId,
        businessId: opts.businessId,
        businessName: opts.businessName,
        customerEmail: opts.customerEmail,
        customerName: opts.customerName,
        subtotal: opts.subtotal,
        businessDeliveryFee: opts.businessDeliveryFee,
        deliveryFeeOverride: opts.deliveryFeeOverride,
        discount: opts.discount,
        merchantAbsorbsDelivery: opts.merchantAbsorbsDelivery,
        itemUnits: opts.itemUnits,
        kind: opts.card.kind,
        applicationId: opts.applicationId,
        plan: opts.plan,
      }),
      timeoutMs: 20_000,
    });
    const data = hit?.json;
    if (!hit || !hit.okHttp || !data?.ok || !data?.charge?.id) {
      return {
        ok: false,
        error: data?.message || 'Cartão recusado ou indisponível.',
      };
    }

    const status = data.charge.status as CardChargeResult extends { ok: true }
      ? never
      : string;

    if (status === 'failed' || status === 'expired' || status === 'cancelled') {
      return {
        ok: false,
        error:
          data.charge.statusDetail ||
          'Pagamento não aprovado pelo banco. Tente outro cartão.',
      };
    }

    return {
      ok: true,
      chargeId: String(data.charge.id),
      status: status === 'paid' ? 'paid' : 'awaiting_payment',
      amount: Number(data.charge.amount ?? opts.amount),
      split: data.charge.split,
      provider: 'mercadopago',
      statusDetail: data.charge.statusDetail,
    };
  } catch {
    return {
      ok: false,
      error: 'Falha de conexão ao cobrar o cartão. Tente novamente.',
    };
  }
}

/** Consulta status até approved/rejected (igual polling do Pix). */
export async function waitCardPaymentApproved(
  paymentId: string,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<CardChargeResult> {
  const timeoutMs = opts?.timeoutMs ?? 45_000;
  const intervalMs = opts?.intervalMs ?? 2000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/payments/${encodeURIComponent(paymentId)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data?.charge) {
        const status = data.charge.status;
        if (status === 'paid') {
          return {
            ok: true,
            chargeId: String(data.charge.id),
            status: 'paid',
            amount: Number(data.charge.amount ?? 0),
            provider: 'mercadopago',
          };
        }
        if (status === 'failed' || status === 'expired' || status === 'cancelled') {
          return {
            ok: false,
            error: 'Pagamento não aprovado pelo banco.',
          };
        }
      }
    } catch {
      // tenta de novo
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return {
    ok: false,
    error: 'Ainda sem confirmação do banco. Tente novamente em instantes.',
  };
}
