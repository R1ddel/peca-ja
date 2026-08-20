import {
  buildSplit,
  isMercadoPagoConfigured,
  mapMpStatusToPix,
  mpFetch,
} from '@/services/mercadopagoServer';
import { resolvePixChargeAmount } from '@/constants/pixTest';
import {
  buildOrderSettlement,
  loadShopMarketplaceRecipients,
  mpMarketplacePaymentFields,
  publicSettlementMeta,
} from '@/services/marketplaceSplit';

type Body = {
  orderDraftId?: string;
  businessId?: string;
  businessName?: string;
  customerName?: string;
  customerEmail?: string;
  subtotal?: number;
  businessDeliveryFee?: number | null;
  deliveryFeeOverride?: number;
  discount?: number;
  merchantAbsorbsDelivery?: number;
  itemUnits?: number;
  merchantRecipientId?: string;
  driverRecipientId?: string;
  platformRecipientId?: string;
};

export async function POST(request: Request) {
  try {
    if (!isMercadoPagoConfigured()) {
      return Response.json(
        {
          ok: false,
          code: 'NO_TOKEN',
          message:
            'Configure MP_ACCESS_TOKEN no .env para Pix real do Mercado Pago. Usando fallback local.',
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as Body;
    const subtotal = Number(body.subtotal ?? 0);
    if (!body.orderDraftId || !body.businessId || !body.businessName || subtotal <= 0) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'Dados do pagamento incompletos.' },
        { status: 400 }
      );
    }

    const isSubscription = body.businessId === 'pecaja-platform';
    const split = buildSplit(subtotal, body.businessDeliveryFee, {
      deliveryFeeOverride: body.deliveryFeeOverride,
      discount: body.discount,
      merchantAbsorbsDelivery: body.merchantAbsorbsDelivery,
      itemUnits: body.itemUnits,
      purpose: isSubscription ? 'subscription' : 'order',
    });
    const chargeAmount = resolvePixChargeAmount(split.customerTotal, {
      forceReal: isSubscription,
    });

    if (chargeAmount < 0.5 && isSubscription) {
      return Response.json(
        {
          ok: false,
          code: 'INVALID',
          message: 'Valor da assinatura inválido para cobrança.',
        },
        { status: 400 }
      );
    }

    const email =
      body.customerEmail && body.customerEmail.includes('@')
        ? body.customerEmail
        : 'cliente@pecaja.app';

    const firstName = (body.customerName || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';

    const recipients = await loadShopMarketplaceRecipients(body.businessId, {
      merchantCollectorId: body.merchantRecipientId?.trim() || null,
      driverCollectorId: body.driverRecipientId?.trim() || null,
      platformCollectorId: body.platformRecipientId?.trim() || null,
    });
    const settlement = buildOrderSettlement(split, recipients);
    const settlementPublic = publicSettlementMeta(settlement);
    const mpExtra = mpMarketplacePaymentFields(settlement);
    const sellerToken =
      settlement.usedSellerToken && recipients.merchantSellerAccessToken
        ? recipients.merchantSellerAccessToken
        : undefined;

    const payment = await mpFetch('/v1/payments', {
      method: 'POST',
      accessToken: sellerToken,
      headers: {
        'X-Idempotency-Key': `pix-${body.orderDraftId}-${Math.round(chargeAmount * 100)}`,
      },
      body: JSON.stringify({
        transaction_amount: Number(chargeAmount.toFixed(2)),
        description: isSubscription
          ? `Peça Já · Assinatura ${body.businessName}`.slice(0, 230)
          : `Peça Já · ${body.businessName}`.slice(0, 230),
        payment_method_id: 'pix',
        payer: {
          email,
          first_name: firstName,
        },
        external_reference: body.orderDraftId,
        ...mpExtra,
        metadata: {
          order_draft_id: body.orderDraftId,
          business_id: body.businessId,
          business_name: body.businessName,
          platform_fee: split.platformFee,
          merchant_amount: split.merchantAmount,
          driver_amount: split.driverAmount,
          real_total: split.customerTotal,
          charged_amount: chargeAmount,
          purpose: isSubscription ? 'subscription' : 'order',
          source: 'peca-ja',
          settlement_mode: settlement.mode,
          settlement_application_fee: settlement.applicationFee,
          merchant_paid_via_mp: settlement.merchantPaidViaMp,
          driver_via_ledger: settlement.driverViaLedger,
        },
      }),
    });

    const tx = payment?.point_of_interaction?.transaction_data ?? {};
    const copyPaste = String(tx.qr_code || '');
    if (!copyPaste) {
      return Response.json(
        {
          ok: false,
          code: 'GATEWAY',
          message: 'Mercado Pago não retornou o QR Code Pix.',
        },
        { status: 502 }
      );
    }

    const expiresAt =
      payment?.date_of_expiration ||
      new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const charge = {
      id: String(payment.id),
      status: mapMpStatusToPix(payment.status),
      copyPaste,
      qrCodeUrl: tx.qr_code_base64
        ? `data:image/png;base64,${tx.qr_code_base64}`
        : `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(copyPaste)}`,
      amount: chargeAmount,
      split: { ...split, customerTotal: chargeAmount },
      settlement: settlementPublic,
      expiresAt,
      createdAt: payment.date_created || new Date().toISOString(),
      paidAt:
        payment.status === 'approved'
          ? payment.date_approved || new Date().toISOString()
          : undefined,
      orderDraftId: body.orderDraftId,
      businessId: body.businessId,
      businessName: body.businessName,
      provider: 'mercadopago' as const,
      mpPaymentId: String(payment.id),
    };

    return Response.json({ ok: true, charge });
  } catch (err: any) {
    const cause =
      err?.body?.cause?.[0]?.description ||
      err?.body?.message ||
      err?.message ||
      err;
    console.error('[payments/pix]', cause, err?.body);
    return Response.json(
      {
        ok: false,
        code: 'GATEWAY',
        message:
          typeof cause === 'string' ? cause : 'Falha ao criar Pix no Mercado Pago.',
      },
      { status: 502 }
    );
  }
}
