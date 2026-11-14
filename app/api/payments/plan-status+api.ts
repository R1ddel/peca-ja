import { requirePaymentSession } from '@/services/paymentAuth';
import { findLatestPaidPlanPayment } from '@/services/planSubscriptionServer';

type Body = {
  applicationId?: string;
  token?: string;
};

/**
 * Consulta se a assinatura do comerciante já foi confirmada pelo Mercado Pago
 * (via webhook ou cobrança aprovada).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const gate = await requirePaymentSession(request, body);
    if (!gate.ok) return gate.response;

    const applicationId = String(body.applicationId || '').trim();
    if (!applicationId) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'applicationId obrigatório.' },
        { status: 400 }
      );
    }

    const payment = await findLatestPaidPlanPayment(applicationId);
    if (!payment) {
      return Response.json({ ok: true, paid: false });
    }

    return Response.json({
      ok: true,
      paid: true,
      payment: {
        id: payment.id,
        applicationId: payment.applicationId,
        plan: payment.plan,
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.paidAt,
        externalReference: payment.externalReference,
      },
    });
  } catch (err: any) {
    console.error('[payments/plan-status]', err?.message || err);
    return Response.json(
      { ok: false, code: 'SERVER', message: 'Falha ao consultar assinatura.' },
      { status: 500 }
    );
  }
}
