/**
 * Pagamento Pix Peça Já + frete GPS (OSRM).
 *
 * Fluxo anti-golpe (estilo iFood):
 * 1) Cria cobrança Pix dinâmica no Mercado Pago (MP_ACCESS_TOKEN no .env)
 * 2) App faz polling até o gateway marcar status = paid
 * 3) Só então o pedido é criado/confirmado
 *
 * Chave Pix estática do banco NÃO confirma sozinha — o banco não avisa o app.
 * Sem token MP o checkout Pix falha de propósito (evita “Já paguei” fraudulento).
 */

import {
  resolveCustomerTotal,
  resolveDeliveryFee,
  resolveEstablishmentAmount,
  resolvePlatformFee,
} from '@/constants/pricing';
import { PIX_RECEIVER } from '@/constants/pixReceiver';
import { resolvePixChargeAmount } from '@/constants/pixTest';
import { fetchPaymentsJson, paymentApiBases } from '@/services/paymentsFetch';

/** Status possíveis de uma cobrança Pix. */
export type PixChargeStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'expired'
  | 'cancelled'
  | 'failed';

/** bank = Pix direto na conta do recebedor (copia e cola real). */
export type PaymentProvider = 'mercadopago' | 'bank' | 'mock';

/** Partes do split financeiro (valores em BRL). */
export type PaymentSplit = {
  platformAmount: number;
  merchantAmount: number;
  driverAmount: number;
  customerTotal: number;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
};

export type CreatePixChargeInput = {
  orderDraftId: string;
  businessId: string;
  businessName: string;
  customerName: string;
  customerEmail?: string;
  subtotal: number;
  /** Frete bruto do comércio (será normalizado pelo mínimo). */
  businessDeliveryFee?: number | null;
  /** Frete já calculado (ex.: GPS ou frete grátis). Tem prioridade. */
  deliveryFeeOverride?: number;
  /** Desconto de clube / cupom (R$). */
  discount?: number;
  /** Frete bancado pela loja (frete grátis do comerciante). */
  merchantAbsorbsDelivery?: number;
  /** Unidades de item no pedido (taxa Peça Já = R$ 2 × unidades). */
  itemUnits?: number;
  merchantRecipientId?: string;
  driverRecipientId?: string;
  platformRecipientId?: string;
  driverId?: string;
  /** Assinatura do comerciante (businessId = pecaja-platform). */
  applicationId?: string;
  plan?: string;
};

export type PixCharge = {
  id: string;
  status: PixChargeStatus;
  copyPaste: string;
  qrCodeUrl: string;
  amount: number;
  split: PaymentSplit;
  expiresAt: string;
  createdAt: string;
  paidAt?: string;
  orderDraftId: string;
  businessId: string;
  businessName: string;
  provider?: PaymentProvider;
  mpPaymentId?: string;
  /** Plano de liquidação (sem tokens). */
  settlement?: {
    mode: 'collector_ledger' | 'marketplace_split';
    merchantPaidViaMp: boolean;
    driverViaLedger: boolean;
    applicationFee: number;
    cashFeeDebtRecovery?: number;
    reason: string;
  };
};

export class PaymentError extends Error {
  code: 'NETWORK' | 'GATEWAY' | 'EXPIRED' | 'UNKNOWN';

  constructor(message: string, code: PaymentError['code'] = 'UNKNOWN') {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
  }
}

export const PAYMENT_CONFIG = {
  pixExpiresInMs: 15 * 60 * 1000,
  pollIntervalMs: 2500,
  /**
   * Pix direto na conta (QR do banco) NÃO permite detectar pagamento sozinho.
   * Só use com EXPO_PUBLIC_PIX_DIRECT_BANK=1 — e o pedido NÃO confirma no botão.
   * Para detectar de verdade: configure MP_ACCESS_TOKEN (Mercado Pago).
   */
  useBankPix:
    process.env.EXPO_PUBLIC_PIX_DIRECT_BANK === '1' ||
    process.env.EXPO_PUBLIC_PIX_DIRECT_BANK === 'true',
  receiverName: PIX_RECEIVER.merchantName,
  /** Nunca auto-aprovar sem gateway (evita pedido falso). */
  mockAutoPayAfterMs: 0,
  /**
   * NUNCA ligue em produção. Confirmação “na confiança” = risco de golpe.
   * O pedido só deve confirmar quando o Mercado Pago marcar o Pix como aprovado.
   */
  allowManualPixConfirm:
    process.env.EXPO_PUBLIC_ALLOW_MANUAL_PIX_CONFIRM === '1' ||
    process.env.EXPO_PUBLIC_ALLOW_MANUAL_PIX_CONFIRM === 'true',
  forceMock:
    process.env.EXPO_PUBLIC_USE_MOCK_PAYMENTS === '1' ||
    process.env.EXPO_PUBLIC_USE_MOCK_PAYMENTS === 'true',
};

export { resolvePixChargeAmount } from '@/constants/pixTest';

/** Frete mínimo garantido (dentro da cidade / fallback). */
export const DELIVERY_PRICE_MIN_REAIS = 5.0;
/** Frete fora da cidade até o raio intermediário (≤ 13 km). */
export const DELIVERY_PRICE_OUTSIDE_CITY_REAIS = 15.0;
/** Valor por KM além dos 13 km (rota muito longa — GPS). */
export const DELIVERY_PRICE_PER_EXTRA_KM = 2.0;
/** Até este raio (ida): frete urbano fixo R$ 5 — dentro da cidade. */
export const CITY_DELIVERY_MAX_KM = 7;
/**
 * Fora da cidade até este raio: frete intermediário R$ 15.
 * Acima disso o GPS calcula além dos R$ 15.
 */
export const OUTSIDE_FLAT_MAX_KM = 13;
/** Distância máxima usada ao estimar pin do comércio perto do cliente. */
export const DELIVERY_DISTANCE_MAX_KM = 25;

export type DeliveryPriceResult = {
  fee: number;
  distanceKm: number | null;
  /** true quando a rota sai do raio urbano e o frete sobe. */
  usedGpsPricing: boolean;
  /** Faixa aplicada: cidade | fora (até 13 km) | longe (GPS). */
  band: 'city' | 'outside' | 'far';
};

/**
 * Frete a partir da distância GPS.
 * ≤ 7 km: R$ 5 (dentro da cidade)
 * > 7 km e ≤ 13 km: R$ 15 (fora da cidade — meio termo)
 * > 13 km: R$ 15 + R$ 2/km além dos 13 (muito longe — GPS)
 */
export function resolveDeliveryPriceFromDistance(
  distanceInMeters: number | null | undefined
): DeliveryPriceResult {
  if (distanceInMeters == null || !Number.isFinite(distanceInMeters) || distanceInMeters <= 0) {
    return {
      fee: DELIVERY_PRICE_MIN_REAIS,
      distanceKm: null,
      usedGpsPricing: false,
      band: 'city',
    };
  }

  const distanceKm = Math.round((distanceInMeters / 1000) * 10) / 10;

  if (distanceKm <= CITY_DELIVERY_MAX_KM) {
    return {
      fee: DELIVERY_PRICE_MIN_REAIS,
      distanceKm,
      usedGpsPricing: false,
      band: 'city',
    };
  }

  if (distanceKm <= OUTSIDE_FLAT_MAX_KM) {
    return {
      fee: DELIVERY_PRICE_OUTSIDE_CITY_REAIS,
      distanceKm,
      usedGpsPricing: true,
      band: 'outside',
    };
  }

  const extraKm = distanceKm - OUTSIDE_FLAT_MAX_KM;
  const fee =
    Math.round(
      (DELIVERY_PRICE_OUTSIDE_CITY_REAIS + extraKm * DELIVERY_PRICE_PER_EXTRA_KM) * 100
    ) / 100;

  return {
    fee,
    distanceKm,
    usedGpsPricing: true,
    band: 'far',
  };
}

/** Texto do alerta quando o GPS sobe o frete (fora da cidade). */
export function gpsFreightAdjustMessage(result: DeliveryPriceResult): string {
  const km =
    result.distanceKm != null
      ? `${result.distanceKm.toFixed(1).replace('.', ',')} km`
      : 'fora do raio urbano';
  const fee = result.fee.toFixed(2).replace('.', ',');

  if (result.band === 'outside') {
    return (
      `Sua rota tem cerca de ${km} de ida — fora da cidade (acima de ${CITY_DELIVERY_MAX_KM} km). ` +
      `Até ${OUTSIDE_FLAT_MAX_KM} km o frete intermediário é R$ ${fee} ` +
      `(o urbano de R$ 5,00 vale só dentro da cidade).`
    );
  }

  return (
    `Sua rota tem cerca de ${km} de ida — bem longe (acima de ${OUTSIDE_FLAT_MAX_KM} km). ` +
    `O GPS calculou o frete em R$ ${fee} ` +
    `(R$ 15,00 até ${OUTSIDE_FLAT_MAX_KM} km + R$ ${DELIVERY_PRICE_PER_EXTRA_KM.toFixed(0)} por km além disso).`
  );
}

/**
 * @deprecated Não usar para frete. Inventa pin perto do cliente e distorce a taxa.
 * Só para pins decorativos no mapa (ex.: vitrines). Frete → `resolveMerchantPin`.
 */
export function merchantCoordsNearCustomer(
  customerLat: number,
  customerLng: number,
  distanceKm = 1.5
): { latitude: number; longitude: number } {
  const safeKm = Math.min(Math.max(distanceKm, 0.4), DELIVERY_DISTANCE_MAX_KM);
  const dLat = (safeKm * 0.707) / 111;
  const dLng = (safeKm * 0.707) / (111 * Math.cos((customerLat * Math.PI) / 180) || 1);
  return {
    latitude: customerLat + dLat,
    longitude: customerLng + dLng,
  };
}

/**
 * Distância real de ruas (metros) via OSRM público.
 * Em falha: retorna `null` para o caller aplicar frete mínimo.
 */
export async function calculateFreeRouteDistance(
  merchantLat: number,
  merchantLng: number,
  customerLat: number,
  customerLng: number
): Promise<number | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${merchantLng},${merchantLat};${customerLng},${customerLat}?overview=false`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return data.routes[0].distance as number;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Converte distância GPS em taxa de entrega (R$).
 * ≤ 7 km: R$ 5 · ≤ 13 km fora: R$ 15 · > 13 km: GPS (R$ 15 + R$ 2/km).
 */
export function calculateDeliveryPriceInReais(
  distanceInMeters: number | null | undefined
): number {
  return resolveDeliveryPriceFromDistance(distanceInMeters).fee;
}

/**
 * Split: cliente paga produtos + frete + taxa Peça Já.
 * Loja recebe o preço cadastrado (subtotal − desconto − absorção de frete).
 * Taxa NÃO sai do bolso do comerciante.
 */
export function calculatePaymentSplit(
  subtotal: number,
  businessDeliveryFee?: number | null,
  opts?: {
    deliveryFeeOverride?: number;
    discount?: number;
    purpose?: 'order' | 'subscription';
    /**
     * Frete bancado pela loja (frete grátis do comerciante).
     * Cliente paga 0 de frete; entregador recebe este valor; loja absorve.
     */
    merchantAbsorbsDelivery?: number;
    itemUnits?: number;
    platformFeeOverride?: number;
  }
): PaymentSplit {
  const deliveryFee =
    typeof opts?.deliveryFeeOverride === 'number'
      ? Math.max(0, opts.deliveryFeeOverride)
      : resolveDeliveryFee(businessDeliveryFee);
  const discount = Math.max(0, opts?.discount ?? 0);
  const merchantAbsorbsDelivery = Math.max(0, opts?.merchantAbsorbsDelivery ?? 0);
  const platformFee =
    typeof opts?.platformFeeOverride === 'number'
      ? Math.max(0, opts.platformFeeOverride)
      : resolvePlatformFee(opts?.itemUnits ?? 1);
  const customerTotal = resolveCustomerTotal(subtotal, deliveryFee, discount, platformFee);

  if (opts?.purpose === 'subscription') {
    return {
      platformAmount: customerTotal,
      merchantAmount: 0,
      driverAmount: 0,
      customerTotal,
      subtotal,
      deliveryFee: 0,
      platformFee: customerTotal,
    };
  }

  const merchantAmount = Math.max(
    0,
    Math.round(
      (resolveEstablishmentAmount(subtotal, discount) - merchantAbsorbsDelivery) * 100
    ) / 100
  );
  const driverAmount = Math.round((deliveryFee + merchantAbsorbsDelivery) * 100) / 100;
  const platformAmount = platformFee;

  return {
    platformAmount,
    merchantAmount,
    driverAmount,
    customerTotal,
    subtotal,
    deliveryFee,
    platformFee,
  };
}

function buildMockPixPayload(chargeId: string, amount: number, merchantName: string): string {
  const amountStr = amount.toFixed(2);
  const name = merchantName.slice(0, 25).toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  return [
    '00020126',
    '0014BR.GOV.BCB.PIX',
    `0136${chargeId}`,
    '520400005303986',
    `54${String(amountStr.length).padStart(2, '0')}${amountStr}`,
    '5802BR',
    `59${String(name.length).padStart(2, '0')}${name}`,
    '6009SAO PAULO',
    '62070503***',
    '6304ABCD',
  ].join('');
}

function qrImageUrl(payload: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(payload)}`;
}

const mockCharges = new Map<string, PixCharge & { autoPayAt: number }>();
/** Cache das cobranças live para o polling manter split/orderDraft. */
const liveChargeCache = new Map<string, PixCharge>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createMockPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
  await delay(350 + Math.random() * 250);

  const split = calculatePaymentSplit(input.subtotal, input.businessDeliveryFee, {
    deliveryFeeOverride: input.deliveryFeeOverride,
    discount: input.discount,
    merchantAbsorbsDelivery: input.merchantAbsorbsDelivery,
    itemUnits: input.itemUnits,
  });
  const chargeAmount = resolvePixChargeAmount(split.customerTotal);
  const id = `mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const copyPaste = buildMockPixPayload(id, chargeAmount, input.businessName);

  const charge: PixCharge & { autoPayAt: number } = {
    id,
    status: 'awaiting_payment',
    copyPaste,
    qrCodeUrl: qrImageUrl(copyPaste),
    amount: chargeAmount,
    split: { ...split, customerTotal: chargeAmount },
    settlement: {
      mode: 'collector_ledger',
      merchantPaidViaMp: false,
      driverViaLedger: true,
      applicationFee: 0,
      cashFeeDebtRecovery: 0,
      reason: 'Mock / piloto — collector + ledger.',
    },
    expiresAt: new Date(now + PAYMENT_CONFIG.pixExpiresInMs).toISOString(),
    createdAt: new Date(now).toISOString(),
    orderDraftId: input.orderDraftId,
    businessId: input.businessId,
    businessName: input.businessName,
    provider: 'mock',
    autoPayAt: PAYMENT_CONFIG.mockAutoPayAfterMs > 0 ? now + PAYMENT_CONFIG.mockAutoPayAfterMs : 0,
  };

  mockCharges.set(id, charge);
  const { autoPayAt: _, ...publicCharge } = charge;
  return publicCharge;
}

async function getMockPixChargeStatus(chargeId: string): Promise<PixCharge> {
  await delay(80);
  const stored = mockCharges.get(chargeId);
  if (!stored) {
    throw new PaymentError('Cobrança Pix não encontrada.', 'GATEWAY');
  }

  const now = Date.now();
  if (stored.status === 'awaiting_payment' || stored.status === 'pending') {
    if (now >= new Date(stored.expiresAt).getTime()) {
      stored.status = 'expired';
    } else if (stored.autoPayAt > 0 && now >= stored.autoPayAt) {
      stored.status = 'paid';
      stored.paidAt = new Date().toISOString();
    }
  }

  mockCharges.set(chargeId, stored);
  const { autoPayAt: _, ...publicCharge } = stored;
  return publicCharge;
}

/** Cliente confirma que pagou o Pix no banco — só se allowManualPixConfirm (dev). */
export async function confirmBankPixPaid(chargeId: string): Promise<PixCharge> {
  if (!PAYMENT_CONFIG.allowManualPixConfirm) {
    throw new PaymentError(
      'O app não confirma Pix “na confiança”. Aguarde a detecção automática do pagamento (Mercado Pago) ou configure MP_ACCESS_TOKEN no .env.',
      'GATEWAY'
    );
  }

  const stored = mockCharges.get(chargeId);
  if (!stored) {
    throw new PaymentError('Cobrança Pix não encontrada.', 'GATEWAY');
  }
  if (stored.status === 'expired' || stored.status === 'cancelled') {
    throw new PaymentError('Este Pix expirou. Gere um novo QR Code.', 'EXPIRED');
  }
  if (stored.status !== 'paid') {
    stored.status = 'paid';
    stored.paidAt = new Date().toISOString();
    mockCharges.set(chargeId, stored);
  }
  const { autoPayAt: _, ...publicCharge } = stored;
  return publicCharge;
}

/**
 * Verifica se o pagamento foi aprovado de verdade.
 * - mercadopago: consulta a API
 * - bank/mock: nunca marca como pago (exceto allowManualPixConfirm)
 */
export async function verifyPixPayment(chargeId: string): Promise<PixCharge> {
  const charge = await getPixChargeStatus(chargeId);

  if (charge.status === 'paid') {
    return charge;
  }

  if (charge.provider === 'mercadopago' || (!chargeId.startsWith('bank_') && !chargeId.startsWith('mock_'))) {
    const live = await getLivePixChargeStatus(chargeId);
    if (live?.status === 'paid') {
      const cached = liveChargeCache.get(chargeId);
      const merged: PixCharge = {
        ...(cached || charge),
        ...live,
        status: 'paid',
        paidAt: live.paidAt || new Date().toISOString(),
        provider: 'mercadopago',
        split: cached?.split || charge.split,
        orderDraftId: cached?.orderDraftId || charge.orderDraftId,
        businessId: cached?.businessId || charge.businessId,
        businessName: cached?.businessName || charge.businessName,
        copyPaste: cached?.copyPaste || charge.copyPaste || live.copyPaste,
      };
      liveChargeCache.set(chargeId, merged);
      return merged;
    }
  }

  return charge;
}

async function createLivePixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
  if (PAYMENT_CONFIG.forceMock) {
    throw new PaymentError(
      'Pagamentos mock estão ativos (EXPO_PUBLIC_USE_MOCK_PAYMENTS). Desative para usar Mercado Pago.',
      'GATEWAY'
    );
  }

  try {
    const hit = await fetchPaymentsJson('/api/payments/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
      timeoutMs: 12_000,
    });

    if (!hit) {
      throw new PaymentError(
        'Não foi possível conectar à API de pagamento. Use o mesmo Wi‑Fi do computador e reinicie o Expo com o token MP_ACCESS_TOKEN no .env.',
        'NETWORK'
      );
    }

    const data = hit.json;

    if (hit.status === 503 || data?.code === 'NO_TOKEN') {
      throw new PaymentError(
        'Configure MP_ACCESS_TOKEN no arquivo .env e reinicie o Expo. Sem o Mercado Pago o app não consegue confirmar o Pix automaticamente (chave do banco sozinha não avisa o app).',
        'GATEWAY'
      );
    }

    if (!hit.okHttp || !data?.ok || !data?.charge?.copyPaste) {
      throw new PaymentError(
        data?.message || 'Mercado Pago recusou a cobrança Pix.',
        'GATEWAY'
      );
    }

    return {
      ...data.charge,
      provider: 'mercadopago',
      status: data.charge.status || 'awaiting_payment',
    } as PixCharge;
  } catch (err) {
    if (err instanceof PaymentError) throw err;
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new PaymentError(
      aborted
        ? 'Tempo esgotado ao falar com o Mercado Pago. Verifique se o Expo está rodando e tente de novo.'
        : 'Não foi possível conectar à API de pagamento. Use o mesmo Wi‑Fi do computador e reinicie o Expo com o token MP_ACCESS_TOKEN no .env.',
      'NETWORK'
    );
  }
}

async function getLivePixChargeStatus(chargeId: string): Promise<PixCharge | null> {
  if (
    PAYMENT_CONFIG.forceMock ||
    chargeId.startsWith('mock_') ||
    chargeId.startsWith('bank_')
  ) {
    return null;
  }

  try {
    for (const base of paymentApiBases()) {
      try {
        const res = await fetch(`${base}/api/payments/${encodeURIComponent(chargeId)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (res.status === 503 || res.status === 404) continue;
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data?.charge) continue;

        return {
          id: String(data.charge.id),
          status: data.charge.status,
          copyPaste: data.charge.copyPaste || '',
          qrCodeUrl: qrImageUrl(data.charge.copyPaste || chargeId),
          amount: Number(data.charge.amount ?? 0),
          split: data.charge.split || {
            platformAmount: 0,
            merchantAmount: 0,
            driverAmount: 0,
            customerTotal: Number(data.charge.amount ?? 0),
            subtotal: 0,
            deliveryFee: 0,
            platformFee: 0,
          },
          expiresAt: data.charge.expiresAt || new Date(Date.now() + 60_000).toISOString(),
          createdAt: new Date().toISOString(),
          paidAt: data.charge.paidAt,
          orderDraftId: data.charge.externalReference || '',
          businessId: '',
          businessName: '',
          provider: 'mercadopago',
          mpPaymentId: String(data.charge.mpPaymentId || data.charge.id),
        };
      } catch {
        /* próxima base */
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
  try {
    // Só mock explícito (dev UI) — sem auto-confirmação
    if (PAYMENT_CONFIG.forceMock) {
      return createMockPixCharge(input);
    }

    // Único caminho seguro: Mercado Pago detecta o Pix pago e confirma o pedido
    const live = await createLivePixCharge(input);
    liveChargeCache.set(live.id, live);
    return live;
  } catch (err) {
    if (err instanceof PaymentError) throw err;
    throw new PaymentError('Não foi possível gerar o Pix. Tente novamente.', 'UNKNOWN');
  }
}

export async function getPixChargeStatus(chargeId: string): Promise<PixCharge> {
  try {
    if (!chargeId.startsWith('mock_')) {
      const liveUpdate = await getLivePixChargeStatus(chargeId);
      const cached = liveChargeCache.get(chargeId);
      if (liveUpdate) {
        const merged: PixCharge = {
          ...(cached || liveUpdate),
          ...liveUpdate,
          split: cached?.split || liveUpdate.split,
          orderDraftId: cached?.orderDraftId || liveUpdate.orderDraftId,
          businessId: cached?.businessId || liveUpdate.businessId,
          businessName: cached?.businessName || liveUpdate.businessName,
          copyPaste: liveUpdate.copyPaste || cached?.copyPaste || '',
          qrCodeUrl: cached?.qrCodeUrl || liveUpdate.qrCodeUrl,
          provider: 'mercadopago',
        };
        liveChargeCache.set(chargeId, merged);
        return merged;
      }
      if (cached) return cached;
    }
    return getMockPixChargeStatus(chargeId);
  } catch (err) {
    if (err instanceof PaymentError) throw err;
    throw new PaymentError('Erro ao verificar o pagamento.', 'NETWORK');
  }
}

/** Alias leve para telas que só precisam do status. */
export async function checkPixChargeStatus(chargeId: string): Promise<PixChargeStatus> {
  try {
    const charge = await getPixChargeStatus(chargeId);
    return charge.status;
  } catch {
    return 'awaiting_payment';
  }
}

export async function cancelPixCharge(chargeId: string): Promise<void> {
  if (chargeId.startsWith('mock_')) {
    await delay(80);
    const stored = mockCharges.get(chargeId);
    if (!stored) return;
    if (stored.status === 'paid') return;
    stored.status = 'cancelled';
    mockCharges.set(chargeId, stored);
    return;
  }
  // Em produção o cancelamento Pix no MP é limitado; só marcamos localmente se mock
}

/** Força uma verificação imediata (botão "Já paguei"). */
export async function refreshPixCharge(chargeId: string): Promise<PixCharge> {
  return getPixChargeStatus(chargeId);
}

/** Polling com cancelamento limpo — chame `stop()` no unmount. */
export function pollPixUntilPaid(
  chargeId: string,
  onUpdate: (charge: PixCharge) => void,
  onError?: (error: PaymentError) => void
): { stop: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      const charge = await getPixChargeStatus(chargeId);
      if (stopped) return;
      onUpdate(charge);

      if (
        charge.status === 'paid' ||
        charge.status === 'expired' ||
        charge.status === 'cancelled' ||
        charge.status === 'failed'
      ) {
        return;
      }

      timer = setTimeout(tick, PAYMENT_CONFIG.pollIntervalMs);
    } catch (err) {
      if (stopped) return;
      const error =
        err instanceof PaymentError
          ? err
          : new PaymentError('Falha ao acompanhar o Pix.', 'NETWORK');
      onError?.(error);
      timer = setTimeout(tick, PAYMENT_CONFIG.pollIntervalMs * 2);
    }
  };

  tick();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
