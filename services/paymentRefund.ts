/**
 * Cliente do estorno MP (cancelamento de pedido pago).
 * Envia Bearer + orderId para auth e estorno de ledger no servidor.
 */
import { fetchPaymentsJson } from '@/services/paymentsFetch';
import { getPlatformToken } from '@/services/platformSession';

export type RefundApiResult = {
  ok: boolean;
  skipped?: boolean;
  refundId?: string;
  status?: string;
  /** confirmed | processing | failed — quando o servidor classifica. */
  refundStatus?: string;
  message?: string;
  code?: string;
  ledgerReversed?: number;
};

export async function requestPaymentRefund(input: {
  paymentId: string;
  orderId: string;
  amount?: number;
  reason?: string;
}): Promise<RefundApiResult> {
  const paymentId = String(input.paymentId || '').trim();
  const orderId = String(input.orderId || '').trim();
  if (!paymentId) {
    return { ok: false, code: 'INVALID', message: 'paymentId ausente.' };
  }
  if (!orderId) {
    return { ok: false, code: 'INVALID', message: 'orderId ausente.' };
  }

  const token = await getPlatformToken();
  if (!token) {
    return {
      ok: false,
      code: 'AUTH',
      message: 'Faça login para estornar o pagamento.',
    };
  }

  const hit = await fetchPaymentsJson('/api/payments/refund', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      paymentId,
      orderId,
      amount: input.amount,
      reason: input.reason,
      token,
    }),
  });

  if (!hit) {
    return {
      ok: false,
      code: 'NETWORK',
      message: 'Sem conexão com a API de estorno.',
    };
  }

  const json = hit.json;
  if (!hit.okHttp || !json?.ok) {
    return {
      ok: false,
      code: json?.code || `HTTP_${hit.status}`,
      message: json?.message || `Falha no estorno (HTTP ${hit.status}).`,
    };
  }

  return {
    ok: true,
    skipped: !!json.skipped,
    refundId: json.refundId ? String(json.refundId) : undefined,
    status: json.status ? String(json.status) : undefined,
    refundStatus: json.refundStatus ? String(json.refundStatus) : undefined,
    message: json.message,
    ledgerReversed:
      typeof json.ledgerReversed === 'number' ? json.ledgerReversed : undefined,
  };
}
