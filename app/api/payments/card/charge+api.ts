import {
  buildSplit,
  isMercadoPagoConfigured,
  mapMpStatusToPix,
  mpFetch,
} from '@/services/mercadopagoServer';
import { isPixTestMode, resolvePixChargeAmount } from '@/constants/pixTest';
import {
  buildOrderSettlement,
  loadShopMarketplaceRecipients,
  mpMarketplacePaymentFields,
  publicSettlementMeta,
  withCashFeeDebtRecovery,
} from '@/services/marketplaceSplit';
import { loadPlatformState } from '@/services/platformStore';
import { merchantCashFeeDebt } from '@/services/orderLedgerServer';
import {
  isMerchantPlan,
  parsePlanApplicationId,
  registerPlanPayment,
  confirmPlanPaymentFromMp,
} from '@/services/planSubscriptionServer';

type Body = {
  mpCustomerId?: string;
  mpCardId?: string;
  securityCode?: string;
  paymentMethodId?: string;
  orderDraftId?: string;
  businessId?: string;
  businessName?: string;
  customerEmail?: string;
  customerName?: string;
  subtotal?: number;
  businessDeliveryFee?: number | null;
  deliveryFeeOverride?: number;
  discount?: number;
  merchantAbsorbsDelivery?: number;
  itemUnits?: number;
  kind?: 'credit' | 'debit';
  isGhostTest?: boolean;
  last4?: string;
  applicationId?: string;
  plan?: string;
  token?: string;
};

const TEST_CARDS_BY_LAST4: Record<
  string,
  {
    card_number: string;
    expiration_month: number;
    expiration_year: number;
    payment_method_id: string;
  }
> = {
  '6351': {
    card_number: '5031433215406351',
    expiration_month: 11,
    expiration_year: 2030,
    payment_method_id: 'master',
  },
  '3311': {
    card_number: '5480832801033311',
    expiration_month: 11,
    expiration_year: 2030,
    payment_method_id: 'master',
  },
  '5682': {
    card_number: '4235647728025682',
    expiration_month: 11,
    expiration_year: 2030,
    payment_method_id: 'visa',
  },
};

const TEST_HOLDER = {
  name: 'APRO',
  identification: { type: 'CPF', number: '12345678909' },
};

const TEST_CVV = '123';

function isRecoverableTestBinError(err: any): boolean {
  const msg = String(err?.message || err?.body?.message || '').toLowerCase();
  const desc = String(err?.body?.cause?.[0]?.description || '').toLowerCase();
  const code = String(err?.body?.cause?.[0]?.code ?? err?.status ?? '');
  const blob = `${msg} ${desc} ${code}`;
  return (
    blob.includes('bin_not_found') ||
    blob.includes('bin not found') ||
    blob.includes('payment method response is empty') ||
    blob.includes('10105') ||
    code === '128' ||
    code === '10105'
  );
}

function approvedTestCharge(opts: {
  chargeAmount: number;
  split: ReturnType<typeof buildSplit>;
  orderDraftId: string;
  businessId: string;
  businessName: string;
  last4: string;
  paymentMethodId: string;
}) {
  const id = `testpay_${Date.now()}`;
  return {
    ok: true,
    charge: {
      id,
      status: 'paid' as const,
      amount: opts.chargeAmount,
      split: { ...opts.split, customerTotal: opts.chargeAmount },
      paidAt: new Date().toISOString(),
      mpPaymentId: id,
      provider: 'mercadopago' as const,
      mpStatus: 'approved',
      statusDetail: 'accredited_test_mode',
      orderDraftId: opts.orderDraftId,
      businessId: opts.businessId,
      businessName: opts.businessName,
      testMode: true,
      last4: opts.last4,
      paymentMethodId: opts.paymentMethodId,
    },
  };
}

async function createFreshTestToken(last4: string, securityCode: string) {
  const spec = TEST_CARDS_BY_LAST4[last4];
  if (!spec) return null;

  const cvv = securityCode.replace(/\D/g, '').slice(0, 3);
  if (cvv !== TEST_CVV) {
    const err = new Error('CVV inválido para cartão de teste. Use 123.') as Error & {
      status?: number;
    };
    err.status = 400;
    throw err;
  }

  const token = await mpFetch('/v1/card_tokens', {
    method: 'POST',
    body: JSON.stringify({
      card_number: spec.card_number,
      expiration_month: spec.expiration_month,
      expiration_year: spec.expiration_year,
      security_code: cvv,
      cardholder: TEST_HOLDER,
    }),
  });

  return { token, paymentMethodId: spec.payment_method_id };
}

async function createTokenFromSavedCard(
  mpCustomerId: string,
  mpCardId: string,
  securityCode: string
) {
  let expectedLen = 3;
  let paymentMethodId: string | undefined;

  try {
    const card = await mpFetch(
      `/v1/customers/${encodeURIComponent(mpCustomerId)}/cards/${encodeURIComponent(mpCardId)}`,
      { method: 'GET' }
    );
    const len = Number(card?.security_code?.length);
    if (len === 3 || len === 4) expectedLen = len;
    if (card?.payment_method?.id) paymentMethodId = String(card.payment_method.id);
  } catch {
    // segue
  }

  const cvv = securityCode.replace(/\D/g, '').slice(0, expectedLen);
  if (cvv.length !== expectedLen) {
    const err = new Error(
      expectedLen === 4
        ? 'Este cartão exige CVV de 4 dígitos.'
        : 'Informe o CVV com 3 dígitos.'
    ) as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  // Não tokeniza card_id sintético (test_card_*)
  if (mpCardId.startsWith('test_')) {
    const err = new Error('Cartão de teste local — use fluxo de teste.') as Error & {
      status?: number;
    };
    err.status = 400;
    throw err;
  }

  const token = await mpFetch('/v1/card_tokens', {
    method: 'POST',
    body: JSON.stringify({
      card_id: mpCardId,
      security_code: cvv,
    }),
  });

  return { token, paymentMethodId };
}

export async function POST(request: Request) {
  try {
    const { requirePaymentSession } = await import('@/services/paymentAuth');
    const rawBody = (await request.json().catch(() => ({}))) as Body;
    const gate = await requirePaymentSession(request, rawBody as { token?: string });
    if (!gate.ok) return gate.response;

    if (!isMercadoPagoConfigured()) {
      return Response.json(
        {
          ok: false,
          code: 'NO_TOKEN',
          message: 'Configure MP_ACCESS_TOKEN no .env para cobrar cartão de verdade.',
        },
        { status: 503 }
      );
    }

    const body = rawBody;
    const mpCustomerId = String(body.mpCustomerId || '').trim();
    const mpCardId = String(body.mpCardId || '').trim();
    const securityCode = String(body.securityCode || '').replace(/\D/g, '');
    let paymentMethodId = String(body.paymentMethodId || '').trim();
    const subtotal = Number(body.subtotal ?? 0);
    const last4 = String(body.last4 || '').replace(/\D/g, '').slice(-4);
    const allowTestCards = process.env.MP_MODE === 'sandbox' && process.env.NODE_ENV !== 'production';
    const testKey =
      allowTestCards && TEST_CARDS_BY_LAST4[last4] ? last4 : '';

    if (!testKey && (!mpCustomerId || !mpCardId || mpCardId.startsWith('test_'))) {
      return Response.json(
        {
          ok: false,
          code: 'INVALID',
          message: 'Cartão sem vínculo no Mercado Pago. Cadastre de novo.',
        },
        { status: 400 }
      );
    }
    if (securityCode.length < 3 || securityCode.length > 4) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'Informe o CVV do cartão.' },
        { status: 400 }
      );
    }
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
    // Assinatura: valor real. Pedidos: pode usar R$ 0,01 de teste.
    const rawAmount = resolvePixChargeAmount(split.customerTotal, {
      forceReal: isSubscription,
    });
    const chargeAmount = isSubscription
      ? Math.max(rawAmount, 1)
      : isPixTestMode()
        ? Math.max(rawAmount, 0.01)
        : Math.max(rawAmount, 1);

    const subscriptionApplicationId = isSubscription
      ? String(body.applicationId || '').trim() ||
        parsePlanApplicationId(body.orderDraftId) ||
        ''
      : '';
    const subscriptionPlan = isSubscription && isMerchantPlan(body.plan) ? body.plan : null;

    if (isSubscription && (!subscriptionApplicationId || !subscriptionPlan)) {
      return Response.json(
        {
          ok: false,
          code: 'INVALID',
          message: 'Assinatura incompleta (applicationId/plano). Refaça o pagamento.',
        },
        { status: 400 }
      );
    }

    // Assinatura: sem marketplace. Pedido: gateway/split atual.
    let settlementPublic: ReturnType<typeof publicSettlementMeta> | {
      mode: string;
      merchantPaidViaMp: boolean;
      driverViaLedger: boolean;
      applicationFee: number;
    };
    let mpExtra: { application_fee?: number } = {};
    let sellerToken: string | undefined;

    if (isSubscription) {
      settlementPublic = {
        mode: 'platform_direct',
        merchantPaidViaMp: false,
        driverViaLedger: false,
        applicationFee: 0,
      };
    } else {
      const recipients = await loadShopMarketplaceRecipients(String(body.businessId), {});
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
      settlementPublic = publicSettlementMeta(settlement);
      mpExtra = mpMarketplacePaymentFields(settlement);
      sellerToken =
        settlement.usedSellerToken && recipients.merchantSellerAccessToken
          ? recipients.merchantSellerAccessToken
          : undefined;
    }

    const ownerUserId = gate.user.id;

    async function persistSubscriptionIfPaid(opts: {
      mpPaymentId: string;
      status: string;
      paidAt?: string;
    }) {
      if (!isSubscription || !subscriptionApplicationId || !subscriptionPlan) return;
      if (opts.status !== 'paid') {
        try {
          await registerPlanPayment({
            mpPaymentId: opts.mpPaymentId,
            applicationId: subscriptionApplicationId,
            plan: subscriptionPlan,
            amount: chargeAmount,
            method: 'card',
            externalReference: String(body.orderDraftId),
            ownerUserId,
            businessName: body.businessName,
            status: 'pending',
          });
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        await confirmPlanPaymentFromMp({
          mpPaymentId: opts.mpPaymentId,
          applicationId: subscriptionApplicationId,
          plan: subscriptionPlan,
          amount: chargeAmount,
          method: 'card',
          externalReference: body.orderDraftId,
          businessName: body.businessName,
          paidAt: opts.paidAt,
        });
      } catch (e: any) {
        console.error('[payments/card/charge] confirmPlanPayment', e?.message || e);
      }
    }

    // ——— Cartão de TESTE ———
    if (testKey) {
      if (securityCode.slice(0, 3) !== TEST_CVV) {
        return Response.json(
          { ok: false, code: 'INVALID', message: 'CVV inválido. Para cartão de teste use 123.' },
          { status: 400 }
        );
      }

      paymentMethodId = TEST_CARDS_BY_LAST4[testKey]?.payment_method_id || 'master';

      // Só aprova localmente em modo teste explícito — assinatura real vai pro MP.
      if (isPixTestMode()) {
        console.warn(
          '[payments/card/charge] Cartão de teste: aprovando localmente (last4=' +
            testKey +
            ', amount=' +
            chargeAmount +
            ')'
        );
        const local = approvedTestCharge({
          chargeAmount,
          split: { ...split, customerTotal: chargeAmount, platformAmount: chargeAmount },
          orderDraftId: body.orderDraftId!,
          businessId: body.businessId!,
          businessName: body.businessName!,
          last4: testKey,
          paymentMethodId,
        });
        if (isSubscription) {
          await persistSubscriptionIfPaid({
            mpPaymentId: local.charge.id,
            status: 'paid',
            paidAt: local.charge.paidAt,
          });
        }
        return Response.json(local);
      }

      // Sem modo teste: tenta cobrança real no MP (exige credenciais TEST- ou cartão real)
      try {
        const fresh = await createFreshTestToken(testKey, securityCode);
        const tokenId = String(fresh?.token?.id || '');
        if (!tokenId) throw new Error('bin_not_found');

        if (fresh?.paymentMethodId) paymentMethodId = fresh.paymentMethodId;

        const email =
          body.customerEmail && body.customerEmail.includes('@')
            ? body.customerEmail
            : 'test_payer_pecaja@testuser.com';

        const payment = await mpFetch('/v1/payments', {
          method: 'POST',
          accessToken: isSubscription ? undefined : sellerToken,
          headers: {
            'X-Idempotency-Key': `card-test-${body.orderDraftId}-${Date.now()}`,
          },
          body: JSON.stringify({
            transaction_amount: Number(chargeAmount.toFixed(2)),
            token: tokenId,
            description: isSubscription
              ? `Peça Já · Assinatura ${body.businessName}`.slice(0, 230)
              : `Peça Já · ${body.businessName}`.slice(0, 230),
            installments: 1,
            capture: true,
            binary_mode: true,
            payment_method_id: paymentMethodId,
            payer: {
              email,
              identification: TEST_HOLDER.identification,
            },
            external_reference: body.orderDraftId,
            ...(isSubscription ? {} : mpExtra),
            metadata: isSubscription
              ? {
                  order_draft_id: body.orderDraftId,
                  business_id: body.businessId,
                  business_name: body.businessName,
                  application_id: subscriptionApplicationId,
                  plan: subscriptionPlan,
                  purpose: 'subscription',
                  source: 'peca-ja-card-test',
                  last4: testKey,
                  settlement_mode: 'platform_direct',
                }
              : {
                  order_draft_id: body.orderDraftId,
                  source: 'peca-ja-card-test',
                  last4: testKey,
                  settlement_mode: (settlementPublic as any).mode,
                  settlement_application_fee: (settlementPublic as any).applicationFee,
                  cash_fee_debt_recovery: (settlementPublic as any).cashFeeDebtRecovery ?? 0,
                  merchant_paid_via_mp: (settlementPublic as any).merchantPaidViaMp,
                  driver_via_ledger: (settlementPublic as any).driverViaLedger,
                },
          }),
        });

        const status = mapMpStatusToPix(payment.status);
        if (status === 'paid') {
          await persistSubscriptionIfPaid({
            mpPaymentId: String(payment.id),
            status: 'paid',
            paidAt: payment.date_approved || new Date().toISOString(),
          });
          return Response.json({
            ok: true,
            charge: {
              id: String(payment.id),
              status: 'paid',
              amount: chargeAmount,
              split: { ...split, customerTotal: chargeAmount },
              settlement: settlementPublic,
              paidAt: payment.date_approved || new Date().toISOString(),
              mpPaymentId: String(payment.id),
              provider: 'mercadopago',
              mpStatus: payment.status,
              statusDetail: payment.status_detail || null,
              orderDraftId: body.orderDraftId,
              businessId: body.businessId,
              businessName: body.businessName,
              purpose: isSubscription ? 'subscription' : 'order',
            },
          });
        }

        return Response.json(
          {
            ok: false,
            code: 'REJECTED',
            message: String(payment.status_detail || 'Pagamento recusado pelo banco.'),
          },
          { status: 402 }
        );
      } catch (err: any) {
        console.error('[payments/card/charge] cartão teste MP', err?.message || err);
        if (isRecoverableTestBinError(err)) {
          return Response.json(
            {
              ok: false,
              code: 'TEST_CARD',
              message:
                'Cartão de teste não funciona com credencial de produção. Use o cartão fantasma do app (CVV 123) ou um cartão real.',
            },
            { status: 400 }
          );
        }
        throw err;
      }
    }

    // ——— Cartão REAL ———
    const saved = await createTokenFromSavedCard(mpCustomerId, mpCardId, securityCode);
    const cardToken = saved.token;
    if (saved.paymentMethodId) paymentMethodId = saved.paymentMethodId;

    const tokenId = String(cardToken?.id || '');
    if (!tokenId) {
      return Response.json(
        { ok: false, code: 'GATEWAY', message: 'Não foi possível tokenizar o cartão.' },
        { status: 502 }
      );
    }

    if (cardToken?.payment_method_id) {
      paymentMethodId = String(cardToken.payment_method_id);
    }
    if (!paymentMethodId) paymentMethodId = 'visa';

    const email =
      body.customerEmail && body.customerEmail.includes('@')
        ? body.customerEmail
        : 'cliente@pecaja.app';

    const payment = await mpFetch('/v1/payments', {
      method: 'POST',
      accessToken: isSubscription ? undefined : sellerToken,
      headers: {
        'X-Idempotency-Key': `card-${body.orderDraftId}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: Number(chargeAmount.toFixed(2)),
        token: tokenId,
        description: isSubscription
          ? `Peça Já · Assinatura ${body.businessName}`.slice(0, 230)
          : `Peça Já · ${body.businessName}`.slice(0, 230),
        installments: 1,
        capture: true,
        binary_mode: true,
        payment_method_id: paymentMethodId,
        payer: {
          type: 'customer',
          id: mpCustomerId,
          email,
        },
        external_reference: body.orderDraftId,
        ...(isSubscription ? {} : mpExtra),
        metadata: isSubscription
          ? {
              order_draft_id: body.orderDraftId,
              business_id: body.businessId,
              business_name: body.businessName,
              application_id: subscriptionApplicationId,
              plan: subscriptionPlan,
              purpose: 'subscription',
              source: 'peca-ja-card',
              last4,
              settlement_mode: 'platform_direct',
            }
          : {
              order_draft_id: body.orderDraftId,
              business_id: body.businessId,
              source: 'peca-ja-card',
              last4,
              settlement_mode: (settlementPublic as any).mode,
              settlement_application_fee: (settlementPublic as any).applicationFee,
              cash_fee_debt_recovery: (settlementPublic as any).cashFeeDebtRecovery ?? 0,
              merchant_paid_via_mp: (settlementPublic as any).merchantPaidViaMp,
              driver_via_ledger: (settlementPublic as any).driverViaLedger,
            },
      }),
    });

    const status = mapMpStatusToPix(payment.status);

    if (status === 'failed' || payment.status === 'rejected') {
      const detail = String(payment.status_detail || 'Pagamento recusado pelo banco.');
      return Response.json(
        {
          ok: false,
          code: 'REJECTED',
          message: detail,
        },
        { status: 402 }
      );
    }

    await persistSubscriptionIfPaid({
      mpPaymentId: String(payment.id),
      status,
      paidAt:
        status === 'paid'
          ? payment.date_approved || new Date().toISOString()
          : undefined,
    });

    return Response.json({
      ok: true,
      charge: {
        id: String(payment.id),
        status,
        amount: chargeAmount,
        split: { ...split, customerTotal: chargeAmount },
        settlement: settlementPublic,
        paidAt:
          status === 'paid'
            ? payment.date_approved || new Date().toISOString()
            : undefined,
        mpPaymentId: String(payment.id),
        provider: 'mercadopago' as const,
        mpStatus: payment.status,
        statusDetail: payment.status_detail || null,
        orderDraftId: body.orderDraftId,
        businessId: body.businessId,
        businessName: body.businessName,
        purpose: isSubscription ? 'subscription' : 'order',
      },
    });
  } catch (err: any) {
    console.error('[payments/card/charge]', err?.message || err, err?.body);
    const detail =
      err?.body?.cause?.[0]?.description ||
      err?.body?.message ||
      err?.message ||
      'Falha ao cobrar o cartão no Mercado Pago.';
    return Response.json(
      { ok: false, code: 'GATEWAY', message: String(detail) },
      { status: 502 }
    );
  }
}
