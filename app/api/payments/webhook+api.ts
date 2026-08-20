import { isMercadoPagoConfigured, mpFetch } from '@/services/mercadopagoServer';

/**
 * Webhook Mercado Pago (topic=payment).
 * Em Expo Go local o MP não alcança localhost — o app usa polling.
 * Em produção, aponte a notification_url para esta rota.
 */
export async function POST(request: Request) {
  try {
    if (!isMercadoPagoConfigured()) {
      return Response.json({ ok: true, ignored: true });
    }

    const url = new URL(request.url);
    const queryId = url.searchParams.get('data.id') || url.searchParams.get('id');
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const paymentId =
      queryId ||
      body?.data?.id ||
      body?.id ||
      (body?.type === 'payment' ? body?.data?.id : null);

    if (!paymentId) {
      return Response.json({ ok: true, received: true });
    }

    // Confirma no MP (fonte da verdade)
    const payment = await mpFetch(`/v1/payments/${encodeURIComponent(String(paymentId))}`, {
      method: 'GET',
    });

    console.log(
      '[mp webhook]',
      payment.id,
      payment.status,
      payment.external_reference
    );

    return Response.json({
      ok: true,
      paymentId: String(payment.id),
      status: payment.status,
      externalReference: payment.external_reference ?? null,
    });
  } catch (err: any) {
    console.error('[payments/webhook]', err?.message || err);
    // Sempre 200 para o MP não retentar agressivamente em dev
    return Response.json({ ok: true, error: err?.message || 'webhook error' });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    message: 'Webhook Mercado Pago Peça Já ativo.',
  });
}
