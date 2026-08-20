/**
 * Cliente do crédito/estorno de ledger no servidor (pós-Pix / entrega / cancel).
 * Retry automático — falha silenciosa quebrava o dinheiro do piloto.
 */
import { getApiBaseUrl, getFleetBaseUrl } from '@/services/apiBase';
import { getPlatformToken } from '@/services/platformSession';
import type { Order } from '@/types';

export type OrderCreditResult = {
  ok: boolean;
  skipped?: boolean;
  reversed?: number;
  message?: string;
  code?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postOrderCreditOnce(body: Record<string, unknown>): Promise<OrderCreditResult> {
  const token = await getPlatformToken();
  if (!token) {
    return {
      ok: false,
      code: 'AUTH',
      message: 'Faça login para sincronizar a carteira.',
    };
  }

  const bases = [getFleetBaseUrl(), getApiBaseUrl()].filter((v, i, a) => a.indexOf(v) === i);

  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/payments/order-credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...body, token }),
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok || !json?.ok) {
        if (res.status >= 500 || res.status === 404) continue;
        return {
          ok: false,
          code: json?.code || `HTTP_${res.status}`,
          message: json?.message || `Falha no crédito (HTTP ${res.status}).`,
        };
      }
      return {
        ok: true,
        skipped: !!json.skipped,
        reversed: typeof json.reversed === 'number' ? json.reversed : undefined,
        message: json.message,
      };
    } catch {
      /* próxima base */
    }
  }

  return {
    ok: false,
    code: 'NETWORK',
    message: 'Sem conexão com a API de crédito.',
  };
}

async function postOrderCredit(body: Record<string, unknown>): Promise<OrderCreditResult> {
  let last: OrderCreditResult = {
    ok: false,
    code: 'NETWORK',
    message: 'Sem conexão com a API de crédito.',
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    last = await postOrderCreditOnce(body);
    if (last.ok) return last;
    // Auth / regras de negócio: não adianta retry
    if (last.code && ['AUTH', 'NOT_PAID', 'NOT_DELIVERED', 'NO_DRIVER_USER', 'CREDIT'].includes(last.code)) {
      return last;
    }
    if (attempt < 2) await sleep(400 * (attempt + 1));
  }
  return last;
}

/** Após Pix confirmado / pedido pago criado. */
export async function requestMerchantLedgerCredit(order: Order): Promise<OrderCreditResult> {
  return postOrderCredit({
    phase: 'paid',
    orderId: order.id,
    order,
  });
}

/** Após entrega confirmada — credita userId da sessão do entregador. */
export async function requestDriverLedgerCredit(order: Order): Promise<OrderCreditResult> {
  return postOrderCredit({
    phase: 'delivered',
    orderId: order.id,
    order,
  });
}

/** Após estorno MP no cancelamento. */
export async function requestLedgerReverse(order: Order): Promise<OrderCreditResult> {
  return postOrderCredit({
    phase: 'reverse',
    orderId: order.id,
    order,
  });
}
