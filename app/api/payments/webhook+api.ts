import { isMercadoPagoConfigured, mapMpStatusToPix, mpFetch } from '@/services/mercadopagoServer';
import { verifyMercadoPagoWebhookSignature } from '@/server/security';
import {
  confirmPlanPaymentFromMp,
  isMerchantPlan,
  parsePlanApplicationId,
} from '@/services/planSubscriptionServer';

const processedEvents = new Map<string, number>();
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

function alreadyProcessed(id: string): boolean {
  const now = Date.now();
  for (const [key, at] of processedEvents) {
    if (now - at > EVENT_TTL_MS) processedEvents.delete(key);
  }
  if (processedEvents.has(id)) return true;
  processedEvents.set(id, now);
  return false;
}

/**
 * Webhook Mercado Pago (topic=payment).
 * Exige x-signature válida (MP_WEBHOOK_SECRET) antes de qualquer processamento.
 * Assinatura de plano: confirma e libera acesso assim que o MP marca approved.
 */
export async function POST(request: Request) {
  try {
    const secret = (process.env.MP_WEBHOOK_SECRET || '').trim();
    if (!secret) {
      console.error('[mp webhook] CRÍTICO: MP_WEBHOOK_SECRET ausente.');
      return Response.json(
        { ok: false, code: 'AUTH', message: 'Webhook indisponível.' },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const xSignature = request.headers.get('x-signature');
    const xRequestId = request.headers.get('x-request-id');

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const dataId =
      url.searchParams.get('data.id') ||
      url.searchParams.get('id') ||
      (body?.data?.id != null ? String(body.data.id) : null) ||
      (body?.id != null ? String(body.id) : null);

    const valid = verifyMercadoPagoWebhookSignature({
      xSignature,
      xRequestId,
      dataId,
      secret,
    });
    if (!valid) {
      return Response.json(
        { ok: false, code: 'AUTH', message: 'Assinatura do webhook inválida.' },
        { status: 401 }
      );
    }

    const eventId = `${xRequestId || ''}:${dataId || ''}`;
    if (eventId !== ':' && alreadyProcessed(eventId)) {
      return Response.json({ ok: true, duplicate: true });
    }

    if (!isMercadoPagoConfigured()) {
      return Response.json({ ok: true, ignored: true });
    }

    if (!dataId) {
      return Response.json({ ok: true, received: true });
    }

    const payment = await mpFetch(`/v1/payments/${encodeURIComponent(String(dataId))}`, {
      method: 'GET',
    });

    console.log('[mp webhook]', payment.id, payment.status);

    const meta = payment?.metadata || {};
    const purpose = String(meta.purpose || '');
    const externalRef = payment.external_reference ?? null;
    const isSubscription =
      purpose === 'subscription' ||
      String(meta.business_id || '') === 'pecaja-platform' ||
      String(externalRef || '').startsWith('plan_');

    let planConfirmed = false;
    if (isSubscription && mapMpStatusToPix(payment.status) === 'paid') {
      const applicationId =
        String(meta.application_id || '').trim() || parsePlanApplicationId(externalRef);
      const planRaw = meta.plan;
      const plan = isMerchantPlan(planRaw) ? planRaw : null;
      const method =
        String(payment.payment_method_id || '').toLowerCase() === 'pix' ? 'pix' : 'card';

      const confirmed = await confirmPlanPaymentFromMp({
        mpPaymentId: String(payment.id),
        applicationId,
        plan,
        amount: Number(payment.transaction_amount || 0),
        method,
        externalReference: externalRef,
        businessName: String(meta.business_name || '') || undefined,
        paidAt: payment.date_approved || new Date().toISOString(),
      });
      planConfirmed = !!confirmed.ok;
      console.log(
        '[mp webhook] subscription',
        payment.id,
        'app=',
        applicationId,
        'confirmed=',
        planConfirmed,
        confirmed.alreadyPaid ? '(already)' : ''
      );
    }

    return Response.json({
      ok: true,
      paymentId: String(payment.id),
      status: payment.status,
      externalReference: externalRef,
      purpose: isSubscription ? 'subscription' : purpose || 'order',
      planConfirmed,
    });
  } catch (err: any) {
    console.error('[payments/webhook]', err?.message || err);
    return Response.json(
      { ok: false, code: 'SERVER', message: 'webhook error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const secret = (process.env.MP_WEBHOOK_SECRET || '').trim();
  return Response.json(
    { ok: true, webhook: secret ? 'ok' : 'missing' },
    { status: 200 }
  );
}
