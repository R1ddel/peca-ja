/**
 * Crédito/estorno de ledger no servidor — idempotente por orderId.
 * Usado pelas rotas /api/payments/order-credit e withdraw.
 */
import type { Order } from '@/types';
import { newId } from '@/services/platformCrypto';
import { loadPlatformState, mutatePlatformState } from '@/services/platformStore';
import type { LedgerEntry, PlatformState } from '@/services/platformTypes';
import { sameLocalCalendarDay } from '@/constants/withdrawRules';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function ledgerBalance(
  state: PlatformState,
  ownerType: LedgerEntry['ownerType'],
  ownerId: string
): number {
  return state.ledger
    .filter((e) => e.ownerType === ownerType && e.ownerId === ownerId)
    .reduce(
      (sum, e) => sum + (e.kind === 'debit' || e.kind === 'withdraw' ? -e.amount : e.amount),
      0
    );
}

/** Dívida sacável negativa (ex.: taxas de dinheiro sem crédito Pix ainda). */
export function merchantCashFeeDebt(state: PlatformState, businessId: string): number {
  if (!businessId) return 0;
  return round2(Math.max(0, -ledgerBalance(state, 'merchant', businessId)));
}

const CASH_FEE_RECOVERY_NOTE = (orderId: string) => `rec taxa dinheiro ${orderId}`;

function hasCashFeeRecovery(
  ledger: LedgerEntry[],
  businessId: string,
  orderId: string
): boolean {
  return ledger.some(
    (e) =>
      e.kind === 'credit' &&
      e.ownerType === 'merchant' &&
      e.ownerId === businessId &&
      e.orderId === orderId &&
      (e.note || '') === CASH_FEE_RECOVERY_NOTE(orderId)
  );
}

/**
 * Após Pix/cartão com application_fee que já abateu a dívida:
 * zera o saldo negativo no ledger (sem creditar o valor do prato de novo).
 */
export async function creditMerchantCashFeeRecovery(
  order: Order,
  amountOverride?: number
): Promise<{
  ok: boolean;
  skipped?: boolean;
  entry?: LedgerEntry;
  message?: string;
}> {
  const amount = round2(
    Number(
      amountOverride ??
        order.cashFeeDebtRecovered ??
        0
    )
  );
  if (amount < 0.01) return { ok: true, skipped: true };
  if (!order.businessId) return { ok: false, message: 'Pedido sem loja.' };

  const state0 = await loadPlatformState();
  if (hasCashFeeRecovery(state0.ledger, order.businessId, order.id)) {
    return { ok: true, skipped: true };
  }

  return mutatePlatformState((state) => {
    if (hasCashFeeRecovery(state.ledger, order.businessId, order.id)) {
      return {
        state,
        result: {
          ok: true as const,
          skipped: true as const,
          entry: undefined as LedgerEntry | undefined,
        },
      };
    }
    const debt = merchantCashFeeDebt(state, order.businessId);
    const recover = round2(Math.min(amount, debt > 0 ? debt : amount));
    if (recover < 0.01) {
      return {
        state,
        result: {
          ok: true as const,
          skipped: true as const,
          entry: undefined as LedgerEntry | undefined,
        },
      };
    }
    const entry: LedgerEntry = {
      id: newId('led'),
      ownerType: 'merchant',
      ownerId: order.businessId,
      orderId: order.id,
      kind: 'credit',
      amount: recover,
      note: CASH_FEE_RECOVERY_NOTE(order.id),
      createdAt: new Date().toISOString(),
    };
    return {
      state: { ...state, ledger: [...state.ledger, entry] },
      result: { ok: true as const, skipped: false as const, entry },
    };
  });
}

/** Já existe crédito aberto (sem debit de estorno) para este orderId + owner. */
export function hasOpenOrderCredit(
  ledger: LedgerEntry[],
  ownerType: LedgerEntry['ownerType'],
  ownerId: string,
  orderId: string
): boolean {
  const credits = ledger.filter(
    (e) =>
      e.kind === 'credit' &&
      e.orderId === orderId &&
      e.ownerType === ownerType &&
      e.ownerId === ownerId &&
      // Recovery de taxa em dinheiro não conta como crédito do pedido
      !(e.note || '').startsWith('rec taxa dinheiro')
  );
  if (credits.length === 0) return false;
  const debited = ledger.some(
    (e) =>
      (e.kind === 'debit' || e.kind === 'adjust') &&
      e.orderId === orderId &&
      e.ownerType === ownerType &&
      e.ownerId === ownerId &&
      (e.note || '').includes('estorno')
  );
  return !debited;
}

export function merchantCreditAmount(order: Order): number {
  return round2(Number(order.establishmentAmount ?? order.subtotal ?? 0));
}

export function driverCreditAmount(order: Order): number {
  return round2(Number(order.driverAmount ?? order.deliveryFee ?? 0));
}

/**
 * Credita a loja só depois da entrega confirmada.
 * Idempotente: não duplica se já houver crédito para o orderId.
 */
export async function creditMerchantForPaidOrder(order: Order): Promise<{
  ok: boolean;
  skipped?: boolean;
  entry?: LedgerEntry;
  message?: string;
}> {
  if (order.status !== 'entregue') {
    return { ok: false, message: 'A loja só recebe depois da entrega confirmada.' };
  }
  const amount = merchantCreditAmount(order);
  if (amount < 0.01) {
    return { ok: false, message: 'Valor da loja inválido.' };
  }
  if (!order.businessId) {
    return { ok: false, message: 'Pedido sem loja.' };
  }

  const state0 = await loadPlatformState();
  if (hasOpenOrderCredit(state0.ledger, 'merchant', order.businessId, order.id)) {
    return { ok: true, skipped: true };
  }

  return mutatePlatformState((state) => {
    if (hasOpenOrderCredit(state.ledger, 'merchant', order.businessId, order.id)) {
      return {
        state,
        result: { ok: true as const, skipped: true as const, entry: undefined as LedgerEntry | undefined },
      };
    }
    const entry: LedgerEntry = {
      id: newId('led'),
      ownerType: 'merchant',
      ownerId: order.businessId,
      orderId: order.id,
      kind: 'credit',
      amount,
      note: `Pedido ${order.id} entregue`,
      createdAt: new Date().toISOString(),
    };
    return {
      state: { ...state, ledger: [...state.ledger, entry] },
      result: { ok: true as const, skipped: false as const, entry },
    };
  });
}

const CASH_FEE_NOTE = (orderId: string) => `taxa dinheiro ${orderId}`;

function hasCashFeeDebit(ledger: LedgerEntry[], businessId: string, orderId: string): boolean {
  return ledger.some(
    (e) =>
      e.kind === 'debit' &&
      e.ownerType === 'merchant' &&
      e.ownerId === businessId &&
      e.orderId === orderId &&
      (e.note || '') === CASH_FEE_NOTE(orderId)
  );
}

/**
 * Loja que entrega com a própria equipe e recebe em dinheiro.
 * A taxa Peça Já sai do saldo (próximo saque), sem ficar na mão de ninguém.
 * Idempotente por pedido.
 */
export async function debitMerchantCashPlatformFee(order: Order): Promise<{
  ok: boolean;
  skipped?: boolean;
  entry?: LedgerEntry;
  message?: string;
}> {
  if (order.deliveryBy !== 'store' || order.paymentProvider !== 'offline') {
    return { ok: true, skipped: true };
  }
  const amount = round2(Number(order.cashFeePixAmount ?? order.platformFee ?? 0));
  if (amount < 0.01) return { ok: true, skipped: true };
  if (!order.businessId) return { ok: false, message: 'Pedido sem loja.' };

  const state0 = await loadPlatformState();
  if (hasCashFeeDebit(state0.ledger, order.businessId, order.id)) {
    return { ok: true, skipped: true };
  }

  return mutatePlatformState((state) => {
    if (hasCashFeeDebit(state.ledger, order.businessId, order.id)) {
      return {
        state,
        result: { ok: true as const, skipped: true as const, entry: undefined as LedgerEntry | undefined },
      };
    }
    const entry: LedgerEntry = {
      id: newId('led'),
      ownerType: 'merchant',
      ownerId: order.businessId,
      orderId: order.id,
      kind: 'debit',
      amount,
      note: CASH_FEE_NOTE(order.id),
      createdAt: new Date().toISOString(),
    };
    return {
      state: { ...state, ledger: [...state.ledger, entry] },
      result: { ok: true as const, skipped: false as const, entry },
    };
  });
}

/**
 * Credita o entregador após entrega confirmada.
 * ownerId = userId da plataforma (sessão do entregador), não o fleet id.
 */
export async function creditDriverForDeliveredOrder(
  order: Order,
  platformDriverUserId: string
): Promise<{
  ok: boolean;
  skipped?: boolean;
  entry?: LedgerEntry;
  message?: string;
}> {
  const amount = driverCreditAmount(order);
  if (amount < 0.01) {
    return { ok: false, message: 'Valor do frete inválido.' };
  }
  if (!platformDriverUserId) {
    return { ok: false, message: 'Entregador sem conta na plataforma.' };
  }

  const state0 = await loadPlatformState();
  if (hasOpenOrderCredit(state0.ledger, 'driver', platformDriverUserId, order.id)) {
    return { ok: true, skipped: true };
  }

  return mutatePlatformState((state) => {
    if (hasOpenOrderCredit(state.ledger, 'driver', platformDriverUserId, order.id)) {
      return {
        state,
        result: { ok: true as const, skipped: true as const, entry: undefined as LedgerEntry | undefined },
      };
    }
    const entry: LedgerEntry = {
      id: newId('led'),
      ownerType: 'driver',
      ownerId: platformDriverUserId,
      orderId: order.id,
      kind: 'credit',
      amount,
      note: `Entrega ${order.id}${order.driverId ? ` · frota ${order.driverId}` : ''}`,
      createdAt: new Date().toISOString(),
    };
    return {
      state: { ...state, ledger: [...state.ledger, entry] },
      result: { ok: true as const, skipped: false as const, entry },
    };
  });
}

/**
 * Estorna créditos abertos do pedido (cancelamento após refund).
 * Idempotente via nota "estorno pedido".
 */
export async function reverseLedgerCreditsForOrder(orderId: string): Promise<{
  ok: boolean;
  reversed: number;
  entries: LedgerEntry[];
}> {
  const state0 = await loadPlatformState();
  const toReverse = state0.ledger.filter((e) => {
    if (e.kind !== 'credit' || e.orderId !== orderId) return false;
    return !state0.ledger.some(
      (d) =>
        (d.kind === 'debit' || d.kind === 'adjust') &&
        d.orderId === orderId &&
        d.ownerType === e.ownerType &&
        d.ownerId === e.ownerId &&
        (d.note || '').includes('estorno')
    );
  });

  const feeStillOpen = state0.ledger.some(
    (e) =>
      e.kind === 'debit' &&
      e.orderId === orderId &&
      (e.note || '') === `taxa dinheiro ${orderId}` &&
      !state0.ledger.some(
        (r) => r.kind === 'credit' && (r.note || '') === `estorno taxa dinheiro ${orderId}`
      )
  );

  if (toReverse.length === 0 && !feeStillOpen) {
    return { ok: true, reversed: 0, entries: [] };
  }

  return mutatePlatformState((state) => {
    const still = toReverse.filter((e) => {
      if (e.kind !== 'credit' || e.orderId !== orderId) return false;
      return !state.ledger.some(
        (d) =>
          (d.kind === 'debit' || d.kind === 'adjust') &&
          d.orderId === orderId &&
          d.ownerType === e.ownerType &&
          d.ownerId === e.ownerId &&
          (d.note || '').includes('estorno')
      );
    });
    const now = new Date().toISOString();
    const debits: LedgerEntry[] = still.map((c) => ({
      id: newId('led'),
      ownerType: c.ownerType,
      ownerId: c.ownerId,
      orderId,
      kind: 'debit' as const,
      amount: c.amount,
      note: `estorno pedido ${orderId}`,
      createdAt: now,
    }));
    const feeDebit = state.ledger.find(
      (e) =>
        e.kind === 'debit' &&
        e.ownerType === 'merchant' &&
        e.orderId === orderId &&
        (e.note || '') === `taxa dinheiro ${orderId}`
    );
    const feeAlreadyReversed = state.ledger.some(
      (e) =>
        e.kind === 'credit' &&
        e.orderId === orderId &&
        (e.note || '') === `estorno taxa dinheiro ${orderId}`
    );
    const feeReversal: LedgerEntry[] =
      feeDebit && !feeAlreadyReversed
        ? [
            {
              id: newId('led'),
              ownerType: 'merchant' as const,
              ownerId: feeDebit.ownerId,
              orderId,
              kind: 'credit' as const,
              amount: feeDebit.amount,
              note: `estorno taxa dinheiro ${orderId}`,
              createdAt: now,
            },
          ]
        : [];
    const entries = [...debits, ...feeReversal];
    return {
      state: { ...state, ledger: [...state.ledger, ...entries] },
      result: { ok: true as const, reversed: entries.length, entries },
    };
  });
}

/** Conta saques do dia (sem estorno) — normas de limite diário. */
export function countWithdrawalsToday(
  state: PlatformState,
  ownerType: LedgerEntry['ownerType'],
  ownerId: string,
  now = new Date()
): number {
  return state.ledger.filter((e) => {
    if (e.kind !== 'withdraw' || e.ownerType !== ownerType || e.ownerId !== ownerId) {
      return false;
    }
    if (!sameLocalCalendarDay(e.createdAt, now)) return false;
    const reversed = state.ledger.some(
      (r) =>
        (r.kind === 'adjust' || r.kind === 'credit') &&
        r.ownerType === ownerType &&
        r.ownerId === ownerId &&
        (r.note || '').includes(`estorno saque ${e.id}`)
    );
    return !reversed;
  }).length;
}

/** Já existe lançamento de saque com este id (idempotência). */
export function findWithdrawByEntryId(
  state: PlatformState,
  entryId: string
): LedgerEntry | undefined {
  return state.ledger.find((e) => e.id === entryId && e.kind === 'withdraw');
}

/**
 * Estorna saque no ledger quando o Pix-out falha no MP.
 * Idempotente via nota `estorno saque {entryId}`.
 */
export async function reverseFailedWithdraw(entryId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  entry?: LedgerEntry;
  message?: string;
}> {
  const id = String(entryId || '').trim();
  if (!id) return { ok: false, message: 'entryId obrigatório.' };

  return mutatePlatformState((state) => {
    const wd = state.ledger.find((e) => e.id === id && e.kind === 'withdraw');
    if (!wd) {
      return {
        state,
        result: {
          ok: false as const,
          message: 'Saque não encontrado no ledger.',
        },
      };
    }
    const already = state.ledger.some(
      (r) =>
        (r.kind === 'adjust' || r.kind === 'credit') &&
        r.ownerType === wd.ownerType &&
        r.ownerId === wd.ownerId &&
        (r.note || '').includes(`estorno saque ${id}`)
    );
    if (already) {
      return {
        state,
        result: { ok: true as const, skipped: true as const },
      };
    }
    const entry: LedgerEntry = {
      id: newId('led'),
      ownerType: wd.ownerType,
      ownerId: wd.ownerId,
      kind: 'adjust',
      amount: wd.amount,
      note: `estorno saque ${id}`,
      createdAt: new Date().toISOString(),
    };
    return {
      state: { ...state, ledger: [...state.ledger, entry] },
      result: { ok: true as const, skipped: false as const, entry },
    };
  });
}

export { ledgerBalance };
