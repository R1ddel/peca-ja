/**
 * Credita / estorna ledger após Pix pago, entrega ou cancelamento.
 * Auth: Bearer sessão da plataforma (cliente do pedido, dono da loja, ou entregador).
 * Alternativa: Bearer === FLEET_SYNC_SECRET | PLATFORM_LEDGER_SECRET (ops).
 *
 * POST { phase: 'paid' | 'delivered' | 'reverse' | 'cash-fee', orderId, order?, token? }
 */
import type { Order } from '@/types';
import { loadPlatformState, mutatePlatformState } from '@/services/platformStore';
import {
  creditDriverForDeliveredOrder,
  creditMerchantCashFeeRecovery,
  creditMerchantForPaidOrder,
  debitMerchantCashPlatformFee,
  reverseLedgerCreditsForOrder,
} from '@/services/orderLedgerServer';
import { shouldCreditDriverLedger, shouldCreditMerchantLedger } from '@/services/marketplaceSplit';

type Body = {
  phase?: 'paid' | 'delivered' | 'reverse' | 'cash-fee';
  orderId?: string;
  /** Snapshot do pedido (upsert se ainda não estiver no servidor). */
  order?: Order;
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
    const body = (await request.json().catch(() => ({}))) as Body;
    const token = bearerToken(request, body);
    if (!token) {
      return Response.json(
        { ok: false, code: 'AUTH', message: 'Sessão obrigatória.' },
        { status: 401 }
      );
    }

    const phase = body.phase;
    const orderId = String(body.orderId || body.order?.id || '').trim();
    if (!phase || !['paid', 'delivered', 'reverse', 'cash-fee'].includes(phase)) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'phase deve ser paid|delivered|reverse|cash-fee.' },
        { status: 400 }
      );
    }
    if (!orderId) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'orderId obrigatório.' },
        { status: 400 }
      );
    }

    const isService = syncSecretOk(token);
    let sessionUserId: string | null = null;

    if (!isService) {
      const state = await loadPlatformState();
      const session = state.sessions.find((s) => s.token === token);
      if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
        return Response.json(
          { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' },
          { status: 401 }
        );
      }
      sessionUserId = session.userId;
    }

    // Upsert snapshot se veio no body
    if (body.order?.id) {
      const incoming = body.order;
      await mutatePlatformState((state) => {
        const idx = state.orders.findIndex((o) => o.id === incoming.id);
        const stamp = new Date().toISOString();
        const orders =
          idx >= 0
            ? state.orders.map((o, i) =>
                i === idx ? { ...o, ...incoming, updatedAt: stamp } : o
              )
            : [
                ...state.orders,
                {
                  ...incoming,
                  userId: incoming.userId || sessionUserId || incoming.userId,
                  updatedAt: incoming.updatedAt || stamp,
                },
              ];
        return { state: { ...state, orders }, result: { ok: true as const } };
      });
    }

    const state = await loadPlatformState();
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) {
      return Response.json(
        {
          ok: false,
          code: 'NOT_FOUND',
          message: 'Pedido não encontrado no servidor. Envie o snapshot em order.',
        },
        { status: 404 }
      );
    }

    if (!isService && sessionUserId) {
      const ownsShop = state.shops.some(
        (s) => s.businessId === order.businessId && s.ownerUserId === sessionUserId
      );
      const isCustomer = order.userId === sessionUserId;
      const assignedDriverUserId = String(
        (order as { driverPlatformUserId?: string | null }).driverPlatformUserId || ''
      ).trim();
      const isAssignedDriver =
        !!assignedDriverUserId && assignedDriverUserId === sessionUserId;

      if ((phase === 'paid' || phase === 'cash-fee') && !isCustomer && !ownsShop) {
        return Response.json(
          { ok: false, code: 'AUTH', message: 'Sem permissão para creditar este pedido.' },
          { status: 403 }
        );
      }
      if (phase === 'delivered') {
        if (assignedDriverUserId && !isAssignedDriver && !ownsShop) {
          return Response.json(
            {
              ok: false,
              code: 'AUTH',
              message: 'Só o entregador da corrida pode creditar o frete no ledger.',
            },
            { status: 403 }
          );
        }
        if (!assignedDriverUserId && !sessionUserId) {
          return Response.json(
            { ok: false, code: 'AUTH', message: 'Sem permissão.' },
            { status: 403 }
          );
        }
      }
      if (phase === 'reverse' && !isCustomer && !ownsShop) {
        return Response.json(
          { ok: false, code: 'AUTH', message: 'Sem permissão para estornar ledger.' },
          { status: 403 }
        );
      }
    }

    if (phase === 'cash-fee') {
      if (order.deliveryBy !== 'store' || order.paymentProvider !== 'offline') {
        return Response.json({
          ok: true,
          phase,
          orderId,
          skipped: true,
          message: 'Taxa de dinheiro só vale para entrega da própria loja.',
        });
      }
      const result = await debitMerchantCashPlatformFee(order);
      if (!result.ok) {
        return Response.json(
          { ok: false, code: 'CREDIT', message: result.message || 'Falha ao lançar a taxa.' },
          { status: 400 }
        );
      }
      return Response.json({
        ok: true,
        phase,
        orderId,
        skipped: !!result.skipped,
        entry: result.entry ?? null,
      });
    }

    if (phase === 'paid') {
      if (!order.paymentConfirmed) {
        return Response.json(
          {
            ok: false,
            code: 'NOT_PAID',
            message: 'Pedido ainda não está com pagamento confirmado.',
          },
          { status: 400 }
        );
      }
      if (
        !shouldCreditMerchantLedger({
          mode: order.settlementMode,
          merchantPaidViaMp: order.settlementMerchantPaidViaMp,
        })
      ) {
        const recovery = await creditMerchantCashFeeRecovery(order);
        return Response.json({
          ok: true,
          phase,
          orderId,
          skipped: true,
          entry: recovery.entry ?? null,
          cashFeeDebtRecovered: order.cashFeeDebtRecovered ?? 0,
          message:
            (order.cashFeeDebtRecovered ?? 0) > 0
              ? 'Lojista liquidado no MP; débito de taxa (dinheiro) abatido no ledger.'
              : 'Lojista já liquidado via marketplace split (MP) — sem crédito no ledger.',
        });
      }
      const result = await creditMerchantForPaidOrder(order);
      if (!result.ok) {
        return Response.json(
          { ok: false, code: 'CREDIT', message: result.message || 'Falha no crédito.' },
          { status: 400 }
        );
      }
      return Response.json({
        ok: true,
        phase,
        orderId,
        skipped: !!result.skipped,
        entry: result.entry ?? null,
      });
    }

    if (phase === 'delivered') {
      if (order.status !== 'entregue') {
        return Response.json(
          {
            ok: false,
            code: 'NOT_DELIVERED',
            message: 'Pedido precisa estar entregue para creditar o frete.',
          },
          { status: 400 }
        );
      }
      const assigned = String(
        (order as { driverPlatformUserId?: string | null }).driverPlatformUserId || ''
      ).trim();
      const driverUserId = isService
        ? assigned || sessionUserId || ''
        : sessionUserId || '';
      if (!driverUserId) {
        return Response.json(
          {
            ok: false,
            code: 'NO_DRIVER_USER',
            message: 'Entregador precisa estar logado na plataforma para receber no ledger.',
          },
          { status: 400 }
        );
      }
      if (assigned && driverUserId !== assigned && !isService) {
        return Response.json(
          {
            ok: false,
            code: 'AUTH',
            message: 'Este frete pertence a outro entregador.',
          },
          { status: 403 }
        );
      }
      if (
        !shouldCreditDriverLedger({
          mode: order.settlementMode,
          driverViaLedger: order.settlementDriverViaLedger,
        })
      ) {
        return Response.json({
          ok: true,
          phase,
          orderId,
          skipped: true,
          entry: null,
          message: 'Frete liquidado fora do ledger (split) — sem crédito.',
        });
      }
      const result = await creditDriverForDeliveredOrder(order, driverUserId);
      if (!result.ok) {
        return Response.json(
          { ok: false, code: 'CREDIT', message: result.message || 'Falha no crédito.' },
          { status: 400 }
        );
      }
      return Response.json({
        ok: true,
        phase,
        orderId,
        skipped: !!result.skipped,
        entry: result.entry ?? null,
        ownerId: driverUserId,
      });
    }

    // reverse
    const result = await reverseLedgerCreditsForOrder(orderId);
    return Response.json({
      ok: true,
      phase,
      orderId,
      reversed: result.reversed,
      entries: result.entries,
    });
  } catch (err: any) {
    console.error('[payments/order-credit]', err?.message || err);
    return Response.json(
      {
        ok: false,
        code: 'SERVER',
        message: err?.message || 'Falha ao processar crédito do pedido.',
      },
      { status: 500 }
    );
  }
}
