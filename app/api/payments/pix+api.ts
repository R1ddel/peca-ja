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
  withCashFeeDebtRecovery,
} from '@/services/marketplaceSplit';
import { loadPlatformState } from '@/services/platformStore';
import { merchantCashFeeDebt } from '@/services/orderLedgerServer';
import { requirePaymentSession } from '@/services/paymentAuth';
import {
  isMerchantPlan,
  parsePlanApplicationId,
  registerPlanPayment,
} from '@/services/planSubscriptionServer';

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
  /** Cadastro do comerciante (obrigatório na assinatura). */
  applicationId?: string;
  plan?: string;
  token?: string;
};

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json().catch(() => ({}))) as Body;
    const gate = await requirePaymentSession(request, rawBody);
    if (!gate.ok) return gate.response;

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

    const body = rawBody;
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

    // ——— Assinatura: 100% na conta MP da plataforma (sem marketplace/split) ———
    if (isSubscription) {
      const applicationId =
        String(body.applicationId || '').trim() ||
        parsePlanApplicationId(body.orderDraftId) ||
        '';
      if (!applicationId) {
        return Response.json(
          {
            ok: false,
            code: 'INVALID',
            message: 'Assinatura sem applicationId. Refaça o pagamento do plano.',
          },
          { status: 400 }
        );
      }
      if (!isMerchantPlan(body.plan)) {
        return Response.json(
          { ok: false, code: 'INVALID', message: 'Plano da assinatura inválido.' },
          { status: 400 }
        );
      }

      const payment = await mpFetch('/v1/payments', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': `plan-pix-${applicationId}-${body.orderDraftId}-${Math.round(
            chargeAmount * 100
          )}`,
        },
        body: JSON.stringify({
          transaction_amount: Number(chargeAmount.toFixed(2)),
          description: `Peça Já · Assinatura ${body.businessName}`.slice(0, 230),
          payment_method_id: 'pix',
          payer: {
            email,
            first_name: firstName,
          },
          external_reference: body.orderDraftId,
          metadata: {
            order_draft_id: body.orderDraftId,
            business_id: body.businessId,
            business_name: body.businessName,
            application_id: applicationId,
            plan: body.plan,
            charged_amount: chargeAmount,
            purpose: 'subscription',
            source: 'peca-ja',
            settlement_mode: 'platform_direct',
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

      const mpId = String(payment.id);
      const status = mapMpStatusToPix(payment.status);
      try {
        await registerPlanPayment({
          mpPaymentId: mpId,
          applicationId,
          plan: body.plan,
          amount: chargeAmount,
          method: 'pix',
          externalReference: body.orderDraftId,
          ownerUserId: gate.user?.id,
          businessName: body.businessName,
          status: status === 'paid' ? 'paid' : 'pending',
          paidAt:
            status === 'paid'
              ? payment.date_approved || new Date().toISOString()
              : undefined,
        });
      } catch (regErr: any) {
        console.error('[payments/pix] registerPlanPayment', regErr?.message || regErr);
      }

      const expiresAt =
        payment?.date_of_expiration ||
        new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return Response.json({
        ok: true,
        charge: {
          id: mpId,
          status,
          copyPaste,
          qrCodeUrl: tx.qr_code_base64
            ? `data:image/png;base64,${tx.qr_code_base64}`
            : `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(copyPaste)}`,
          amount: chargeAmount,
          split: { ...split, customerTotal: chargeAmount },
          settlement: {
            mode: 'platform_direct',
            merchantPaidViaMp: false,
            driverViaLedger: false,
            applicationFee: 0,
          },
          expiresAt,
          createdAt: payment.date_created || new Date().toISOString(),
          paidAt:
            payment.status === 'approved'
              ? payment.date_approved || new Date().toISOString()
              : undefined,
          orderDraftId: body.orderDraftId,
          businessId: body.businessId,
          businessName: body.businessName,
          applicationId,
          plan: body.plan,
          provider: 'mercadopago' as const,
          mpPaymentId: mpId,
          purpose: 'subscription' as const,
        },
      });
    }

    // ——— Pedido: gateway / marketplace (fluxo atual) ———
    const recipients = await loadShopMarketplaceRecipients(body.businessId, {
      merchantCollectorId: body.merchantRecipientId?.trim() || null,
      driverCollectorId: body.driverRecipientId?.trim() || null,
      platformCollectorId: body.platformRecipientId?.trim() || null,
    });
    let debt = 0;
    try {
      const plat = await loadPlatformState();
      debt = merchantCashFeeDebt(plat, String(body.businessId));
    } catch {
      debt = 0;
    }
    const settlement = withCashFeeDebtRecovery(
      buildOrderSettlement(split, recipients),
      split,
      debt
    );
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
        description: `Peça Já · ${body.businessName}`.slice(0, 230),
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
          purpose: 'order',
          source: 'peca-ja',
          settlement_mode: settlement.mode,
          settlement_application_fee: settlement.applicationFee,
          cash_fee_debt_recovery: settlement.cashFeeDebtRecovery ?? 0,
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
