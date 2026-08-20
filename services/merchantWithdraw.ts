/**
 * Cliente do saque Pix real (API → Mercado Pago Payouts).
 * Ledger server-side é a fonte da verdade; envia Bearer da sessão.
 */
import { fetchPaymentsJson } from '@/services/paymentsFetch';
import { getPlatformToken } from '@/services/platformSession';
import {
  MerchantWallet,
  PixKeyType,
  completeWithdraw,
  requestWithdraw,
  attachWithdrawPayout,
} from '@/utils/merchantWallet';

export type WithdrawApiResult = {
  ok: boolean;
  payoutId?: string;
  status?: 'pending' | 'processing' | 'paid' | 'failed';
  endToEndId?: string | null;
  simulated?: boolean;
  message?: string;
  code?: string;
};

async function postWithdraw(body: Record<string, unknown>): Promise<WithdrawApiResult> {
  const token = await getPlatformToken();
  if (!token) {
    return {
      ok: false,
      code: 'AUTH',
      message: 'Faça login na conta da plataforma para sacar.',
    };
  }
  const hit = await fetchPaymentsJson('/api/payments/withdraw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, token }),
  });
  if (!hit) {
    return { ok: false, code: 'NETWORK', message: 'Sem conexão com a API de saque.' };
  }
  const json = hit.json;
  if (!hit.okHttp || !json?.ok) {
    return {
      ok: false,
      code: json?.code || `HTTP_${hit.status}`,
      message: json?.message || `Falha no saque (HTTP ${hit.status}).`,
    };
  }
  return {
    ok: true,
    payoutId: json.payoutId ? String(json.payoutId) : undefined,
    status: json.status,
    endToEndId: json.endToEndId ?? null,
    simulated: !!json.simulated,
  };
}

export async function executeMerchantWithdraw(params: {
  businessId: string;
  applicationId: string;
  amount: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  holderName: string;
  document: string;
}): Promise<{
  wallet: MerchantWallet;
  entryId: string;
  api: WithdrawApiResult;
}> {
  const { wallet, entry } = await requestWithdraw({
    businessId: params.businessId,
    applicationId: params.applicationId,
    amount: params.amount,
  });

  const api = await postWithdraw({
    entryId: entry.id,
    businessId: params.businessId,
    applicationId: params.applicationId,
    amount: params.amount,
    pixKey: params.pixKey,
    pixKeyType: params.pixKeyType,
    holderName: params.holderName,
    document: params.document,
  });

  if (!api.ok) {
    const failed = await completeWithdraw(
      params.businessId,
      entry.id,
      'failed',
      api.message || 'Falha no envio Pix'
    );
    return {
      wallet: failed ?? wallet,
      entryId: entry.id,
      api,
    };
  }

  let next = await attachWithdrawPayout(params.businessId, entry.id, {
    payoutId: api.payoutId || entry.id,
    endToEndId: api.endToEndId,
  });

  if (api.status === 'paid') {
    next =
      (await completeWithdraw(params.businessId, entry.id, 'paid', undefined, {
        endToEndId: api.endToEndId || undefined,
        authCode: api.payoutId,
        payerName: api.simulated
          ? 'Peça Já Pagamentos (simulado)'
          : 'Peça Já Pagamentos · Mercado Pago',
      })) ?? next;
  } else if (api.status === 'failed') {
    next =
      (await completeWithdraw(
        params.businessId,
        entry.id,
        'failed',
        'Mercado Pago recusou o Pix-out'
      )) ?? next;
  }

  return {
    wallet: next ?? wallet,
    entryId: entry.id,
    api,
  };
}

export async function pollWithdrawStatus(params: {
  businessId: string;
  entryId: string;
  payoutId: string;
}): Promise<{ wallet: MerchantWallet | null; api: WithdrawApiResult }> {
  const api = await postWithdraw({ payoutId: params.payoutId });
  if (!api.ok) {
    return { wallet: null, api };
  }
  if (api.status === 'paid') {
    const wallet = await completeWithdraw(params.businessId, params.entryId, 'paid', undefined, {
      endToEndId: api.endToEndId || undefined,
      authCode: api.payoutId,
      payerName: 'Peça Já Pagamentos · Mercado Pago',
    });
    return { wallet, api };
  }
  if (api.status === 'failed') {
    const wallet = await completeWithdraw(
      params.businessId,
      params.entryId,
      'failed',
      'Mercado Pago recusou o Pix-out'
    );
    return { wallet, api };
  }
  return { wallet: null, api };
}
