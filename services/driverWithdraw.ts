/**
 * Cliente do saque Pix do entregador (API → Mercado Pago Payouts).
 * Poll até liquidar; se falhar, o servidor já estorna o ledger.
 */
import { fetchPaymentsJson } from '@/services/paymentsFetch';
import { getPlatformToken } from '@/services/platformSession';
import {
  DriverWallet,
  requestDriverWithdraw,
  completeDriverWithdraw,
} from '@/utils/driverWallet';
import type { PixKeyType } from '@/utils/merchantWallet';

export type DriverWithdrawApiResult = {
  ok: boolean;
  payoutId?: string;
  status?: 'pending' | 'processing' | 'paid' | 'failed';
  endToEndId?: string | null;
  simulated?: boolean;
  message?: string;
  code?: string;
  amount?: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postWithdraw(body: Record<string, unknown>): Promise<DriverWithdrawApiResult> {
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
    amount: typeof json.amount === 'number' ? json.amount : undefined,
  };
}

export async function pollDriverWithdrawStatus(params: {
  driverId: string;
  entryId: string;
  payoutId: string;
}): Promise<{ wallet: DriverWallet | null; api: DriverWithdrawApiResult }> {
  const api = await postWithdraw({ payoutId: params.payoutId });
  if (!api.ok) {
    return { wallet: null, api };
  }
  if (api.status === 'paid') {
    const wallet = await completeDriverWithdraw(params.driverId, params.entryId, 'paid');
    return { wallet, api };
  }
  if (api.status === 'failed') {
    const wallet = await completeDriverWithdraw(
      params.driverId,
      params.entryId,
      'failed',
      'Mercado Pago recusou o Pix-out'
    );
    return { wallet, api };
  }
  return { wallet: null, api };
}

export async function executeDriverWithdraw(params: {
  driverId: string;
  applicationId: string;
  amount: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  holderName: string;
  document: string;
}): Promise<{
  wallet: DriverWallet;
  entryId: string;
  api: DriverWithdrawApiResult;
}> {
  const { wallet, entry } = await requestDriverWithdraw({
    driverId: params.driverId,
    applicationId: params.applicationId,
    amount: params.amount,
  });

  const api = await postWithdraw({
    entryId: entry.id,
    driverId: params.driverId,
    applicationId: params.applicationId,
    amount: params.amount,
    pixKey: params.pixKey,
    pixKeyType: params.pixKeyType,
    holderName: params.holderName,
    document: params.document,
  });

  if (!api.ok) {
    const failed = await completeDriverWithdraw(
      params.driverId,
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

  let current = wallet;
  let status = api.status;
  const payoutId = api.payoutId || entry.id;

  if (status === 'paid' || api.simulated) {
    const paid = await completeDriverWithdraw(params.driverId, entry.id, 'paid');
    return {
      wallet: paid ?? wallet,
      entryId: entry.id,
      api: { ...api, status: 'paid' },
    };
  }

  if (status === 'failed') {
    const failed = await completeDriverWithdraw(
      params.driverId,
      entry.id,
      'failed',
      'Mercado Pago recusou o Pix-out'
    );
    return {
      wallet: failed ?? wallet,
      entryId: entry.id,
      api,
    };
  }

  // pending/processing — poll automático (mesmo padrão do comerciante)
  for (let i = 0; i < 8; i++) {
    await sleep(1500);
    const polled = await pollDriverWithdrawStatus({
      driverId: params.driverId,
      entryId: entry.id,
      payoutId,
    });
    if (polled.wallet) current = polled.wallet;
    status = polled.api.status || status;
    if (status === 'paid' || status === 'failed') {
      return {
        wallet: current,
        entryId: entry.id,
        api: { ...api, ...polled.api, status },
      };
    }
  }

  return {
    wallet: current,
    entryId: entry.id,
    api: { ...api, status: status || 'pending' },
  };
}
