/**
 * Repasse pelo gateway (Mercado Pago Payouts) depois dos dois códigos.
 * O cliente já pagou na conta da Peça Já. A taxa fica. A parte da loja e o
 * frete saem para as chaves Pix cadastradas. Sem OAuth de loja.
 */
import type { Order } from '@/types';
import { newId } from '@/services/platformCrypto';
import { createPixPayout } from '@/services/mercadopagoServer';
import { loadPlatformState, mutatePlatformState } from '@/services/platformStore';
import type { LedgerEntry, PayoutProfile } from '@/services/platformTypes';
import {
  creditDriverForDeliveredOrder,
  creditMerchantForPaidOrder,
  driverCreditAmount,
  merchantCashFeeDebt,
  merchantCreditAmount,
} from '@/services/orderLedgerServer';

export type SplitPartyStatus = 'paid' | 'pending' | 'failed' | 'skipped' | 'missing_key';

export type GatewaySplitResult = {
  ok: boolean;
  skipped?: boolean;
  simulated?: boolean;
  merchantStatus: SplitPartyStatus;
  driverStatus: SplitPartyStatus;
  merchantAmount: number;
  driverAmount: number;
  platformAmount: number;
  message: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function partyNote(orderId: string, role: 'merchant' | 'driver') {
  return `repasse ${role} ${orderId}`;
}

function alreadyReleased(ledger: LedgerEntry[], orderId: string, role: 'merchant' | 'driver') {
  return ledger.some(
    (e) => e.kind === 'withdraw' && e.orderId === orderId && (e.note || '') === partyNote(orderId, role)
  );
}

function findProfile(
  profiles: PayoutProfile[] | undefined,
  ownerType: 'merchant' | 'driver',
  ids: Array<string | null | undefined>
): PayoutProfile | null {
  const list = profiles || [];
  for (const id of ids) {
    const needle = String(id || '').trim();
    if (!needle) continue;
    const found = list.find((p) => p.ownerType === ownerType && p.ownerId === needle);
    if (found?.pixKey && found.document) return found;
  }
  return null;
}

async function rememberWithdraw(params: {
  ownerType: 'merchant' | 'driver';
  ownerId: string;
  orderId: string;
  amount: number;
  role: 'merchant' | 'driver';
  payoutId: string;
}) {
  if (params.amount < 0.01 || !params.ownerId) return;
  await mutatePlatformState((state) => {
    if (alreadyReleased(state.ledger, params.orderId, params.role)) {
      return { state, result: true };
    }
    const entry: LedgerEntry = {
      id: newId('led'),
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      orderId: params.orderId,
      kind: 'withdraw',
      amount: round2(params.amount),
      note: partyNote(params.orderId, params.role),
      createdAt: new Date().toISOString(),
    };
    return { state: { ...state, ledger: [...state.ledger, entry] }, result: true };
  });
}

async function payParty(params: {
  profile: PayoutProfile;
  amount: number;
  orderId: string;
  role: 'merchant' | 'driver';
  ownerId: string;
}): Promise<{ status: SplitPartyStatus; simulated?: boolean; message?: string }> {
  if (params.amount < 0.01) return { status: 'skipped' };
  const state = await loadPlatformState();
  if (alreadyReleased(state.ledger, params.orderId, params.role)) {
    return { status: 'paid', message: 'Repasse já enviado.' };
  }
  try {
    const payout = await createPixPayout({
      amount: params.amount,
      pixKey: params.profile.pixKey,
      pixKeyType: params.profile.pixKeyType,
      holderName: params.profile.holderName || 'Titular Pix',
      document: params.profile.document,
      externalReference: `split_${params.orderId}_${params.role}`,
      description:
        params.role === 'merchant'
          ? `Peca Ja loja ${params.orderId}`
          : `Peca Ja frete ${params.orderId}`,
      idempotencyKey: `split_${params.orderId}_${params.role}`,
    });
    if (payout.status === 'failed') {
      return { status: 'failed', simulated: payout.simulated, message: 'O Mercado Pago recusou o Pix.' };
    }
    await rememberWithdraw({
      ownerType: params.role,
      ownerId: params.ownerId,
      orderId: params.orderId,
      amount: params.amount,
      role: params.role,
      payoutId: payout.payoutId,
    });
    const status: SplitPartyStatus = payout.status === 'paid' ? 'paid' : 'pending';
    return {
      status,
      simulated: payout.simulated,
      message: payout.simulated
        ? 'Modo simulado: o Pix não saiu de verdade.'
        : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'O gateway não enviou o Pix.';
    return { status: 'failed', message };
  }
}

/**
 * Só roda com o pedido entregue (código do cliente) e, no motoboy do app,
 * com a retirada já confirmada pela loja.
 */
export async function releaseGatewaySplit(incoming: Order): Promise<GatewaySplitResult> {
  const state = await loadPlatformState();
  const stored = state.orders.find((o) => o.id === incoming.id);
  const order: Order = stored
    ? {
        ...incoming,
        ...stored,
        status: incoming.status === 'entregue' ? 'entregue' : stored.status,
        pickupVerifiedAt: stored.pickupVerifiedAt || incoming.pickupVerifiedAt,
        deliveryVerifiedAt: stored.deliveryVerifiedAt || incoming.deliveryVerifiedAt,
        establishmentAmount: stored.establishmentAmount ?? incoming.establishmentAmount,
        driverAmount: stored.driverAmount ?? incoming.driverAmount,
        platformFee: stored.platformFee ?? incoming.platformFee,
      }
    : incoming;

  const platformAmount = round2(Number(order.platformFee ?? 0));
  const base = {
    merchantAmount: 0,
    driverAmount: 0,
    platformAmount,
    merchantStatus: 'skipped' as SplitPartyStatus,
    driverStatus: 'skipped' as SplitPartyStatus,
  };

  if (order.paymentProvider === 'offline') {
    return {
      ok: true,
      skipped: true,
      ...base,
      message: 'Dinheiro fica na loja. Não há Pix para repartir.',
    };
  }
  if (order.status !== 'entregue' || !order.deliveryVerifiedAt) {
    return {
      ok: false,
      ...base,
      merchantStatus: 'failed',
      message: 'O repasse só sai depois que o cliente e o entregador confirmam a entrega.',
    };
  }
  const storeDelivers = order.deliveryBy === 'store';
  if (!storeDelivers && !order.pickupVerifiedAt) {
    return {
      ok: false,
      ...base,
      merchantStatus: 'failed',
      message: 'Falta o código de retirada da loja. O Pix ainda não sai.',
    };
  }
  if (!order.paymentConfirmed) {
    return {
      ok: false,
      ...base,
      merchantStatus: 'failed',
      message: 'O pagamento do cliente ainda não está confirmado.',
    };
  }

  const food = merchantCreditAmount(order);
  const freight = driverCreditAmount(order);
  const debt = merchantCashFeeDebt(state, order.businessId);
  const debtTake = round2(Math.min(debt, food));
  const foodNet = round2(Math.max(0, food - debtTake));
  let merchantPay = round2(storeDelivers ? foodNet + freight : foodNet);
  let driverPay = storeDelivers ? 0 : freight;

  await creditMerchantForPaidOrder(order);
  if (storeDelivers && freight >= 0.01) {
    await mutatePlatformState((current) => {
      const note = `frete loja ${order.id}`;
      if (current.ledger.some((e) => e.orderId === order.id && (e.note || '') === note)) {
        return { state: current, result: true };
      }
      const entry: LedgerEntry = {
        id: newId('led'),
        ownerType: 'merchant',
        ownerId: order.businessId,
        orderId: order.id,
        kind: 'credit',
        amount: freight,
        note,
        createdAt: new Date().toISOString(),
      };
      return { state: { ...current, ledger: [...current.ledger, entry] }, result: true };
    });
  }
  const driverUserId = String(order.driverPlatformUserId || '').trim();
  if (!storeDelivers && driverPay >= 0.01 && driverUserId) {
    await creditDriverForDeliveredOrder(order, driverUserId);
  }

  const afterCredit = await loadPlatformState();
  const merchantBal = round2(
    afterCredit.ledger
      .filter((e) => e.ownerType === 'merchant' && e.ownerId === order.businessId)
      .reduce((sum, e) => sum + (e.kind === 'debit' || e.kind === 'withdraw' ? -e.amount : e.amount), 0)
  );
  merchantPay = round2(Math.min(merchantPay, Math.max(0, merchantBal)));
  if (driverUserId) {
    const driverBal = round2(
      afterCredit.ledger
        .filter((e) => e.ownerType === 'driver' && e.ownerId === driverUserId)
        .reduce((sum, e) => sum + (e.kind === 'debit' || e.kind === 'withdraw' ? -e.amount : e.amount), 0)
    );
    driverPay = round2(Math.min(driverPay, Math.max(0, driverBal)));
  }

  const profiles = afterCredit.payoutProfiles;
  let merchantStatus: SplitPartyStatus = merchantPay < 0.01 ? 'skipped' : 'missing_key';
  let driverStatus: SplitPartyStatus = driverPay < 0.01 ? 'skipped' : 'missing_key';
  let simulated = false;
  const notes: string[] = [];

  if (merchantPay >= 0.01) {
    const profile = findProfile(profiles, 'merchant', [order.businessId]);
    if (!profile) {
      merchantStatus = 'missing_key';
      notes.push('A loja ainda não tem chave Pix no servidor.');
    } else {
      const paid = await payParty({
        profile,
        amount: merchantPay,
        orderId: order.id,
        role: 'merchant',
        ownerId: order.businessId,
      });
      merchantStatus = paid.status;
      if (paid.simulated) simulated = true;
      if (paid.message) notes.push(paid.message);
    }
  }

  if (driverPay >= 0.01) {
    const profile = findProfile(profiles, 'driver', [order.driverPlatformUserId, order.driverId]);
    if (!profile) {
      driverStatus = 'missing_key';
      notes.push('O entregador ainda não tem chave Pix no servidor.');
    } else {
      const ownerId = String(order.driverPlatformUserId || order.driverId || '');
      const paid = await payParty({
        profile,
        amount: driverPay,
        orderId: order.id,
        role: 'driver',
        ownerId,
      });
      driverStatus = paid.status;
      if (paid.simulated) simulated = true;
      if (paid.message) notes.push(paid.message);
    }
  }

  if (platformAmount >= 0.01) {
    notes.push('A taxa Peça Já permanece na conta da plataforma.');
  }
  if (debtTake >= 0.01) {
    notes.push('A taxa de pedidos em dinheiro saiu da parte da loja.');
  }

  const failed =
    merchantStatus === 'failed' ||
    driverStatus === 'failed' ||
    merchantStatus === 'missing_key' ||
    driverStatus === 'missing_key';

  return {
    ok: !failed,
    simulated,
    merchantStatus,
    driverStatus,
    merchantAmount: merchantPay,
    driverAmount: driverPay,
    platformAmount,
    message:
      notes.filter(Boolean).join(' ') ||
      'Gateway repartiu a parte da loja e o frete. A taxa ficou na Peça Já.',
  };
}
