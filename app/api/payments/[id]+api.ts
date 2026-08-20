import { isMercadoPagoConfigured, mapMpStatusToPix, mpFetch } from '@/services/mercadopagoServer';

/**
 * Expo Router passa os segmentos dinâmicos no 2º argumento (ex.: { id }),
 * NÃO em context.params. Fallback: extrai da URL.
 */
function resolvePaymentId(request: Request, routeParams?: Record<string, string>): string | null {
  const fromParams = routeParams?.id?.trim();
  if (fromParams) return fromParams;

  try {
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(/\/api\/payments\/([^/?#]+)/i);
    if (match?.[1] && match[1].toLowerCase() !== 'pix') {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // ignore
  }
  return null;
}

export async function GET(request: Request, routeParams: Record<string, string> = {}) {
  try {
    if (!isMercadoPagoConfigured()) {
      return Response.json(
        { ok: false, code: 'NO_TOKEN', message: 'MP_ACCESS_TOKEN não configurado.' },
        { status: 503 }
      );
    }

    const id = resolvePaymentId(request, routeParams);
    if (!id) {
      return Response.json({ ok: false, message: 'ID inválido.' }, { status: 400 });
    }

    const payment = await mpFetch(`/v1/payments/${encodeURIComponent(id)}`, {
      method: 'GET',
    });

    const status = mapMpStatusToPix(payment.status);
    const tx = payment?.point_of_interaction?.transaction_data ?? {};

    return Response.json({
      ok: true,
      charge: {
        id: String(payment.id),
        status,
        copyPaste: String(tx.qr_code || ''),
        amount: Number(payment.transaction_amount ?? 0),
        expiresAt: payment.date_of_expiration || null,
        paidAt:
          status === 'paid'
            ? payment.date_approved || new Date().toISOString()
            : undefined,
        mpPaymentId: String(payment.id),
        provider: 'mercadopago',
        mpStatus: payment.status,
        externalReference: payment.external_reference ?? null,
      },
    });
  } catch (err: any) {
    console.error('[payments/id]', err?.message || err);
    return Response.json(
      { ok: false, code: 'GATEWAY', message: err?.message || 'Erro ao consultar pagamento.' },
      { status: 502 }
    );
  }
}
