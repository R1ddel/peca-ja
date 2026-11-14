/**
 * Cliente server-side do Mercado Pago (API routes Expo).
 * Não importar React Native aqui.
 */
import {
  resolveCustomerTotal,
  resolveDeliveryFee,
  resolveEstablishmentAmount,
  resolvePlatformFee,
} from '@/constants/pricing';

const MP_BASE = 'https://api.mercadopago.com';

export type PaymentSplit = {
  platformAmount: number;
  merchantAmount: number;
  driverAmount: number;
  customerTotal: number;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
};

export function isMercadoPagoConfigured(): boolean {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  return !!token && token.length > 10;
}

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) {
    throw Object.assign(new Error('MP_ACCESS_TOKEN não configurado.'), {
      body: { message: 'MP_ACCESS_TOKEN não configurado.' },
    });
  }
  return token;
}

/**
 * Fetch autenticado na API Mercado Pago.
 * Em erro, lança com `body` JSON quando disponível.
 */
export async function mpFetch(
  path: string,
  init?: RequestInit & {
    headers?: Record<string, string>;
    /** Override do Bearer (OAuth do seller no marketplace split). */
    accessToken?: string;
  }
): Promise<any> {
  const { accessToken: tokenOverride, headers: initHeaders, ...rest } = init || {};
  const token = tokenOverride?.trim() || getAccessToken();
  const url = path.startsWith('http') ? path : `${MP_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(initHeaders || {}),
  };

  const res = await fetch(url, { ...rest, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }

  if (!res.ok) {
    const err: any = new Error(
      body?.message || body?.error || `Mercado Pago HTTP ${res.status}`
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

export function mapMpStatusToPix(
  status: string | undefined
): 'pending' | 'awaiting_payment' | 'paid' | 'expired' | 'cancelled' | 'failed' {
  switch ((status ?? '').toLowerCase()) {
    case 'approved':
      return 'paid';
    case 'pending':
    case 'in_process':
    case 'authorized':
      return 'awaiting_payment';
    case 'cancelled':
      return 'cancelled';
    case 'rejected':
    case 'charged_back':
      return 'failed';
    case 'expired':
      return 'expired';
    default:
      return 'pending';
  }
}

/**
 * Split: cliente paga produtos + frete + taxa Peça Já.
 * Loja recebe o preço cadastrado — taxa NÃO sai do bolso dela.
 */
export function buildSplit(
  subtotal: number,
  businessDeliveryFee?: number | null,
  opts?: {
    deliveryFeeOverride?: number;
    discount?: number;
    merchantAbsorbsDelivery?: number;
    itemUnits?: number;
    platformFeeOverride?: number;
    purpose?: 'order' | 'subscription';
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

  return {
    platformAmount: platformFee,
    merchantAmount,
    driverAmount: Math.round((deliveryFee + merchantAbsorbsDelivery) * 100) / 100,
    customerTotal,
    subtotal,
    deliveryFee,
    platformFee,
  };
}

export type PixPayoutRequest = {
  amount: number;
  pixKey: string;
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  holderName: string;
  /** CPF (11) ou CNPJ (14) do titular — exigido pelo Pix-out. */
  document: string;
  externalReference: string;
  description?: string;
  idempotencyKey: string;
};

export type PixPayoutResult = {
  payoutId: string;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  endToEndId?: string | null;
  rawStatus?: string | null;
  raw?: unknown;
  simulated?: boolean;
};

function digitsOnly(v: string): string {
  return String(v || '').replace(/\D/g, '');
}

function mapPayoutStatus(raw: string | undefined | null): PixPayoutResult['status'] {
  const s = String(raw || '').toLowerCase();
  if (['approved', 'accredited', 'paid', 'success', 'completed', 'done'].includes(s)) {
    return 'paid';
  }
  if (['rejected', 'cancelled', 'canceled', 'failed', 'error', 'refunded'].includes(s)) {
    return 'failed';
  }
  if (
    ['in_process', 'processing', 'transaction_in_process', 'pending', 'authorized', 'created', 'queued'].includes(
      s
    )
  ) {
    return s === 'pending' || s === 'created' || s === 'queued' ? 'pending' : 'processing';
  }
  return 'pending';
}

function readServerEnvName(name: string): string {
  const env = process.env as Record<string, string | undefined>;
  return (env[name] || '').trim();
}

function payoutRef(raw: string): string {
  const clean = String(raw || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
  return clean || `wd${Date.now()}`;
}

function payoutText(raw: string): string {
  const clean = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 _-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return clean || 'Peca Ja saque';
}

function mpPixKeyType(type: PixPayoutRequest['pixKeyType']): string {
  switch (type) {
    case 'cnpj':
      return 'CNPJ';
    case 'email':
      return 'EMAIL';
    case 'phone':
      return 'PHONE';
    case 'random':
      return 'PIX_CODE';
    default:
      return 'CPF';
  }
}

function pemToDer(pem: string): Uint8Array {
  const normalized = pem.replace(/\\n/g, '\n');
  const b64 = normalized.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Assina o body exatamente como o Mercado Pago exige em produção (Ed25519). */
async function signPayoutBody(body: string): Promise<string | null> {
  const pem = readServerEnvName('MP_PAYOUT_PRIVATE_KEY');
  if (!pem) return null;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw Object.assign(new Error('Este servidor não assina o saque Pix.'), { status: 503 });
  }
  const key = await subtle.importKey('pkcs8', pemToDer(pem), { name: 'Ed25519' }, false, ['sign']);
  const sig = await subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(body));
  return bytesToB64(new Uint8Array(sig));
}

/**
 * Envia Pix-out (saque) pela conta da plataforma no Mercado Pago.
 * Produto Payouts precisa estar liberado. Produção exige assinatura Ed25519.
 *
 * POST /v1/payouts
 * Simulação (dev): MP_PAYOUT_MODE=simulate
 */
export async function createPixPayout(req: PixPayoutRequest): Promise<PixPayoutResult> {
  const amount = Math.round(Number(req.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0.01) {
    throw Object.assign(new Error('Valor de saque inválido.'), { status: 400 });
  }

  const doc = digitsOnly(req.document);
  if (doc.length !== 11 && doc.length !== 14) {
    throw Object.assign(new Error('Informe CPF (11) ou CNPJ (14) do titular.'), {
      status: 400,
    });
  }

  const mode = (process.env.MP_PAYOUT_MODE || 'live').trim().toLowerCase();
  if (mode === 'simulate') {
    if (process.env.NODE_ENV === 'production') {
      throw Object.assign(
        new Error(
          'MP_PAYOUT_MODE=simulate é proibido em produção. Use live com Payouts liberado ou desative saques.'
        ),
        { status: 503, body: { code: 'PAYOUT_SIMULATE_BLOCKED' } }
      );
    }
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    return {
      payoutId: `sim_${req.externalReference}`,
      status: 'paid',
      endToEndId: `E${stamp}${digitsOnly(req.externalReference).slice(-8) || '00000000'}`,
      rawStatus: 'simulated',
      simulated: true,
    };
  }

  if (!isMercadoPagoConfigured()) {
    throw Object.assign(new Error('MP_ACCESS_TOKEN não configurado.'), {
      status: 503,
      body: { code: 'NO_TOKEN' },
    });
  }

  const ref = payoutRef(req.externalReference);
  const body = {
    external_reference: ref,
    description: payoutText(req.description || 'Peca Ja saque'),
    transactions: [
      {
        description: payoutText(req.holderName ? `Saque ${req.holderName}` : 'Saque Peca Ja'),
        type: 'pix',
        pix: {
          type: mpPixKeyType(req.pixKeyType),
          chave: String(req.pixKey || '').trim(),
        },
        amount: {
          currency: 'BRL',
          value: amount,
        },
        external_reference: ref,
      },
    ],
  };
  const rawBody = JSON.stringify(body);
  const signature = await signPayoutBody(rawBody);
  if (!signature) {
    throw Object.assign(
      new Error(
        'Saque real ainda não assinado. O Mercado Pago exige a chave privada Ed25519 em produção. O Pix não saiu e o saldo não foi debitado.'
      ),
      { status: 503, body: { code: 'PAYOUT_SIGNATURE' } }
    );
  }

  try {
    const payout = await mpFetch('/v1/payouts', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': req.idempotencyKey,
        'X-enforce-signature': 'true',
        'X-signature': signature,
      },
      body: rawBody,
    });

    const tx = Array.isArray(payout?.transactions) ? payout.transactions[0] : null;
    const payoutId = String(payout?.id ?? tx?.id ?? ref);
    const rawStatus = String(tx?.status ?? payout?.status ?? 'created');
    const endToEndId = tx?.id ? String(tx.id) : null;

    return {
      payoutId,
      status: mapPayoutStatus(rawStatus),
      endToEndId: endToEndId ? String(endToEndId) : null,
      rawStatus,
      raw: payout,
    };
  } catch (err: any) {
    const status = err?.status;
    const msg =
      err?.body?.message ||
      err?.message ||
      'Falha no Pix-out do Mercado Pago.';
    if (status === 404 || status === 403 || status === 401) {
      throw Object.assign(
        new Error(
          `${msg} Liberação de Payouts (Pix transfer) no painel Mercado Pago pode ser necessária. Contate o suporte MP ou use MP_PAYOUT_MODE=simulate só em testes.`
        ),
        { status: status || 502, body: err?.body }
      );
    }
    throw Object.assign(new Error(msg), { status: status || 502, body: err?.body });
  }
}

export async function getPixPayout(payoutId: string): Promise<PixPayoutResult> {
  if (String(payoutId).startsWith('sim_')) {
    return {
      payoutId,
      status: 'paid',
      endToEndId: payoutId,
      rawStatus: 'simulated',
      simulated: true,
    };
  }
  const payout = await mpFetch(`/v1/payouts/${encodeURIComponent(payoutId)}`, {
    method: 'GET',
  });
  const tx = Array.isArray(payout?.transactions) ? payout.transactions[0] : null;
  const rawStatus = String(tx?.status ?? payout?.status ?? 'pending');
  const endToEndId = tx?.id ? String(tx.id) : null;
  return {
    payoutId: String(payout?.id ?? payoutId),
    status: mapPayoutStatus(rawStatus),
    endToEndId: endToEndId ? String(endToEndId) : null,
    rawStatus,
    raw: payout,
  };
}

/**
 * Estorno total ou parcial de um pagamento MP.
 * POST /v1/payments/:id/refunds
 */
export async function refundMercadoPagoPayment(input: {
  paymentId: string;
  amount?: number;
  reason?: string;
}): Promise<{
  refundId: string;
  status: string;
  amount: number | null;
}> {
  if (!isMercadoPagoConfigured()) {
    throw Object.assign(new Error('MP_ACCESS_TOKEN não configurado.'), {
      status: 503,
      body: { code: 'NO_TOKEN' },
    });
  }

  const paymentId = String(input.paymentId || '').trim();
  if (!paymentId) {
    throw Object.assign(new Error('paymentId obrigatório.'), { status: 400 });
  }

  const body: Record<string, unknown> = {};
  if (input.amount != null && Number.isFinite(input.amount) && input.amount > 0) {
    body.amount = Math.round(Number(input.amount) * 100) / 100;
  }

  const refund = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: 'POST',
    headers: {
      // Mesma chave = retry seguro se a rede cair no meio do cancelamento.
      'X-Idempotency-Key': `refund-${paymentId}-${body.amount ?? 'full'}`,
    },
    body: JSON.stringify(body),
  });

  return {
    refundId: String(refund?.id ?? ''),
    status: String(refund?.status ?? 'unknown'),
    amount:
      refund?.amount != null
        ? Number(refund.amount)
        : body.amount != null
          ? Number(body.amount)
          : null,
  };
}

export { mapPayoutStatus };
