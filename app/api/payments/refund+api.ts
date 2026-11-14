/**
 * Estorno Mercado Pago — cancelamento de pedido pago.
 * Exige sessão (cliente do pedido ou dono da loja) + paymentId vinculado ao pedido.
 * POST { paymentId, orderId, amount?, reason?, token? }
 */
import { isMercadoPagoConfigured, refundMercadoPagoPayment } from '@/services/mercadopagoServer';
import { loadPlatformState } from '@/services/platformStore';
import { reverseLedgerCreditsForOrder } from '@/services/orderLedgerServer';

type Body = {
  paymentId?: string;
  orderId?: string;
  amount?: number;
  reason?: string;
  token?: string;
};

function bearerToken(request: Request, body: Body): string | null {
  const h = request.headers.get('authorization') || request.headers.get('Authorization');
  if (h?.toLowerCase().startsWith('bearer ')) {
    return h.slice(7).trim() || null;
  }
  return body.token?.trim() || null;
}

function syncSecretOk(token: string | null): boolean {
  if (!token) return false;
  const secrets = [
    process.env.PLATFORM_LEDGER_SECRET?.trim(),
    process.env.FLEET_SYNC_SECRET?.trim(),
  ].filter(Boolean) as string[];
  return secrets.some((s) => s === token);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const paymentId = String(body.paymentId || '').trim();
    const orderId = String(body.orderId || '').trim();
    if (!paymentId) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'paymentId obrigatório.' },
        { status: 400 }
      );
    }
    if (!orderId) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'orderId obrigatório.' },
        { status: 400 }
      );
    }

    const token = bearerToken(request, body);
    if (!token) {
      return Response.json(
        { ok: false, code: 'AUTH', message: 'Sessão obrigatória para estorno.' },
        { status: 401 }
      );
    }

    const isService = syncSecretOk(token);
    const state = await loadPlatformState();

    if (!isService) {
      const session = state.sessions.find((s) => s.token === token);
      if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
        return Response.json(
          { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' },
          { status: 401 }
        );
      }
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        return Response.json(
          {
            ok: false,
            code: 'NOT_FOUND',
            message: 'Pedido não encontrado. Sincronize o pedido antes de cancelar.',
          },
          { status: 404 }
        );
      }
      const ownsShop = state.shops.some(
        (s) => s.businessId === order.businessId && s.ownerUserId === session.userId
      );
      const isCustomer = order.userId === session.userId;
      if (!isCustomer && !ownsShop) {
        return Response.json(
          { ok: false, code: 'AUTH', message: 'Sem permissão para estornar este pedido.' },
          { status: 403 }
        );
      }
      const orderPayId = String(order.paymentId || '').trim();
      if (orderPayId && orderPayId !== paymentId) {
        return Response.json(
          {
            ok: false,
            code: 'MISMATCH',
            message: 'paymentId não corresponde ao pedido.',
          },
          { status: 403 }
        );
      }
    }

    // Não estorna mocks / ids locais
    if (
      paymentId.startsWith('mock_') ||
      paymentId.startsWith('local_') ||
      paymentId.startsWith('sim_')
    ) {
      const reversed = await reverseLedgerCreditsForOrder(orderId);
      return Response.json({
        ok: true,
        skipped: true,
        refundStatus: 'skipped',
        message: 'Pagamento local/mock — sem estorno no gateway.',
        ledgerReversed: reversed.reversed,
      });
    }

    if (!isMercadoPagoConfigured()) {
      return Response.json(
        { ok: false, code: 'NO_TOKEN', message: 'MP_ACCESS_TOKEN não configurado.' },
        { status: 503 }
      );
    }

    const result = await refundMercadoPagoPayment({
      paymentId,
      amount: body.amount != null ? Number(body.amount) : undefined,
      reason: body.reason,
    });

    const order = state.orders.find((o) => o.id === orderId);
    const reversed = await reverseLedgerCreditsForOrder(orderId);

    const gatewayStatus = String(result.status || '').toLowerCase();
    const refundStatus =
      ['approved', 'accredited', 'refunded'].includes(gatewayStatus)
        ? 'confirmed'
        : ['rejected', 'cancelled', 'canceled', 'failed'].includes(gatewayStatus)
          ? 'failed'
          : 'processing';

    // Grava o estorno no pedido da plataforma para o cliente ver no sync.
    if (order && refundStatus !== 'failed') {
      try {
        const { savePlatformState } = await import('@/services/platformStore');
        const nextOrders = state.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                refundStatus,
                refundId: result.refundId || o.refundId,
                refundMessage:
                  refundStatus === 'confirmed'
                    ? 'Estorno confirmado no Mercado Pago.'
                    : 'Estorno enviado ao Mercado Pago e em processamento.',
                refundAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : o
        );
        await savePlatformState({ ...state, orders: nextOrders });
      } catch (stampErr: any) {
        console.warn('[payments/refund] stamp order refund:', stampErr?.message || stampErr);
      }
    }

    if (refundStatus === 'failed') {
      return Response.json(
        {
          ok: false,
          code: 'REFUND_REJECTED',
          message: 'O Mercado Pago recusou o estorno. O pedido não deve ser cancelado.',
          ...result,
        },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      ...result,
      refundStatus,
      ledgerReversed: reversed.reversed,
      settlementMode: order?.settlementMode || 'collector_ledger',
      note:
        order?.settlementMode === 'marketplace_split'
          ? 'Estorno MP desfaz o split proporcional (loja + application_fee). Ledger só reverte frete/créditos internos restantes.'
          : 'Estorno MP + reversão do ledger (loja/motoboy).',
    });
  } catch (err: any) {
    console.error('[payments/refund]', err?.message || err);
    return Response.json(
      {
        ok: false,
        code: err?.body?.code || 'REFUND',
        message: err?.message || 'Falha ao estornar no Mercado Pago.',
        details: err?.body || undefined,
      },
      { status: err?.status && Number.isFinite(err.status) ? err.status : 502 }
    );
  }
}
