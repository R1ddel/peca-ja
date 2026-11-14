/**
 * Carteira do comerciante: crédito por pedido confirmado + saque Pix.
 * Sem depósito — o saldo nasce só das vendas.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '@/types';

const KEY = '@pecaja_merchant_wallet_v1';

import {
  MERCHANT_MAX_WITHDRAWS_PER_DAY,
  MERCHANT_MIN_WITHDRAW,
} from '@/constants/withdrawRules';

/** Mínimo por saque (R$). */
export const WALLET_MIN_WITHDRAW = MERCHANT_MIN_WITHDRAW;

/** No máximo 1 saque por dia (calendário local). */
export const WALLET_MAX_WITHDRAWS_PER_DAY = MERCHANT_MAX_WITHDRAWS_PER_DAY;

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export type WalletEntryType =
  | 'credit'
  | 'reversal'
  | 'withdrawal'
  | 'cash_fee'
  /** Abate dívida de taxa (dinheiro) após Pix/cartão — sobe o saldo. */
  | 'cash_fee_recovery';

export type WithdrawalStatus = 'pending' | 'paid' | 'failed';

/** Comprovante gerado quando o saque Pix é concluído. */
export type WithdrawReceipt = {
  /** ID público do comprovante (ex.: PJ-RCP-…). */
  receiptId: string;
  /** Código de autenticação. */
  authCode: string;
  /** Identificador estilo end-to-end Pix. */
  endToEndId: string;
  paidAt: string;
  amount: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  holderName: string;
  /** Origem fixa da plataforma. */
  payerName: string;
};

export type WalletEntry = {
  id: string;
  businessId: string;
  type: WalletEntryType;
  /** Sempre positivo; o sinal vem do tipo. */
  amount: number;
  description: string;
  createdAt: string;
  orderId?: string;
  shopOrderNumber?: number;
  /** Só em saques. */
  status?: WithdrawalStatus;
  pixKey?: string;
  pixKeyType?: PixKeyType;
  /** Nome do titular no momento do saque. */
  pixHolderName?: string | null;
  /** CPF/CNPJ do titular no momento do saque. */
  pixDocument?: string | null;
  /** ID do payout no Mercado Pago (quando saque real). */
  mpPayoutId?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  failReason?: string | null;
  /** Preenchido quando status === 'paid'. */
  receipt?: WithdrawReceipt | null;
};

export type MerchantWallet = {
  businessId: string;
  applicationId: string;
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  pixHolderName: string | null;
  /** CPF (11) ou CNPJ (14) do titular — exigido no Pix-out. */
  pixDocument: string | null;
  entries: WalletEntry[];
  updatedAt: string;
};

async function loadAll(): Promise<MerchantWallet[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeWallet) : [];
  } catch {
    return [];
  }
}

async function saveAll(list: MerchantWallet[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function emptyWallet(businessId: string, applicationId: string): MerchantWallet {
  return {
    businessId,
    applicationId,
    pixKey: null,
    pixKeyType: null,
    pixHolderName: null,
    pixDocument: null,
    entries: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeWallet(w: MerchantWallet): MerchantWallet {
  return {
    ...w,
    pixDocument: w.pixDocument ?? null,
  };
}

export async function getWallet(businessId: string): Promise<MerchantWallet | null> {
  const all = await loadAll();
  return all.find((w) => w.businessId === businessId) ?? null;
}

export async function ensureWallet(
  businessId: string,
  applicationId: string
): Promise<MerchantWallet> {
  const all = await loadAll();
  const found = all.find((w) => w.businessId === businessId);
  if (found) {
    if (found.applicationId !== applicationId) {
      const next = { ...found, applicationId, updatedAt: new Date().toISOString() };
      await saveAll(all.map((w) => (w.businessId === businessId ? next : w)));
      return next;
    }
    return found;
  }
  const created = emptyWallet(businessId, applicationId);
  await saveAll([created, ...all]);
  return created;
}

/** Saldo contábil (pode ficar negativo se só houve taxa em dinheiro). */
export function walletSignedBalance(wallet: MerchantWallet | null | undefined): number {
  if (!wallet) return 0;
  let bal = 0;
  for (const e of wallet.entries) {
    if (e.type === 'credit' || e.type === 'cash_fee_recovery') bal += e.amount;
    else if (e.type === 'reversal') bal -= e.amount;
    else if (e.type === 'cash_fee') bal -= e.amount;
    else if (e.type === 'withdrawal' && (e.status === 'pending' || e.status === 'paid')) {
      bal -= e.amount;
    }
  }
  return round2(bal);
}

/** Saldo disponível para saque imediato. */
export function availableBalance(wallet: MerchantWallet | null | undefined): number {
  return round2(Math.max(0, walletSignedBalance(wallet)));
}

/**
 * Valor que o saque pode enviar: carteira deste aparelho.
 * Se o ledger da nuvem for menor, o saque fica nesse teto.
 */
export function withdrawableBalance(
  wallet: MerchantWallet | null | undefined,
  ledgerBalance?: number | null
): number {
  const local = availableBalance(wallet);
  if (ledgerBalance == null || !Number.isFinite(ledgerBalance)) return local;
  return round2(Math.min(local, Math.max(0, ledgerBalance)));
}

/** Dívida de taxa em dinheiro ainda não coberta por créditos / recovery. */
export function pendingCashFeeDebt(wallet: MerchantWallet | null | undefined): number {
  return round2(Math.max(0, -walletSignedBalance(wallet)));
}

/** Total já creditado (bruto de pedidos, sem descontar saques). */
export function totalCredited(wallet: MerchantWallet | null | undefined): number {
  if (!wallet) return 0;
  let c = 0;
  let r = 0;
  for (const e of wallet.entries) {
    if (e.type === 'credit' && !e.id.startsWith('cfr_')) c += e.amount;
    if (e.type === 'reversal') r += e.amount;
  }
  return round2(Math.max(0, c - r));
}

export function totalWithdrawn(wallet: MerchantWallet | null | undefined): number {
  if (!wallet) return 0;
  let s = 0;
  for (const e of wallet.entries) {
    if (e.type === 'withdrawal' && e.status === 'paid') s += e.amount;
  }
  return round2(s);
}

function creditedOrderIds(wallet: MerchantWallet): Set<string> {
  const ids = new Set<string>();
  const reversed = new Set<string>();
  for (const e of wallet.entries) {
    if (e.type === 'reversal' && e.orderId) reversed.add(e.orderId);
  }
  for (const e of wallet.entries) {
    if (e.type === 'credit' && e.orderId && !reversed.has(e.orderId)) {
      ids.add(e.orderId);
    }
  }
  return ids;
}

function hasOpenCredit(wallet: MerchantWallet, orderId: string): boolean {
  return creditedOrderIds(wallet).has(orderId);
}

/** Pedido pago online e ainda não cancelado. Dinheiro vivo não entra no Pix. */
export function orderEligibleForCredit(order: Order): boolean {
  if (order.paymentProvider === 'offline') return false;
  if (order.status !== 'entregue') return false;
  if (order.paymentConfirmed !== true) return false;
  return (order.establishmentAmount ?? 0) > 0;
}

export function pixKeyTypeLabel(t: PixKeyType): string {
  const map: Record<PixKeyType, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    email: 'E-mail',
    phone: 'Telefone',
    random: 'Chave aleatória',
  };
  return map[t];
}

export function normalizePixKey(type: PixKeyType, raw: string): string {
  const v = raw.trim();
  if (type === 'email') return v.toLowerCase();
  if (type === 'phone') return v.replace(/\D/g, '');
  if (type === 'cpf' || type === 'cnpj') return v.replace(/\D/g, '');
  return v;
}

export function validatePixKey(type: PixKeyType, raw: string): string | null {
  const key = normalizePixKey(type, raw);
  if (!key) return 'Informe a chave Pix.';
  if (type === 'cpf' && key.length !== 11) return 'CPF deve ter 11 dígitos.';
  if (type === 'cnpj' && key.length !== 14) return 'CNPJ deve ter 14 dígitos.';
  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
    return 'E-mail inválido.';
  }
  if (type === 'phone' && (key.length < 10 || key.length > 13)) {
    return 'Telefone inválido (DDD + número).';
  }
  if (type === 'random' && key.length < 8) return 'Chave aleatória muito curta.';
  return null;
}

export function normalizePixDocument(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

export function validatePixDocument(raw: string): string | null {
  const d = normalizePixDocument(raw);
  if (d.length === 11 || d.length === 14) return null;
  return 'Informe CPF (11 dígitos) ou CNPJ (14 dígitos) do titular.';
}

/** Resolve documento para Pix-out: cadastro, ou a própria chave se for CPF/CNPJ. */
export function resolvePixDocument(wallet: MerchantWallet | null | undefined): string | null {
  if (!wallet) return null;
  const stored = normalizePixDocument(wallet.pixDocument || '');
  if (stored.length === 11 || stored.length === 14) return stored;
  if (wallet.pixKeyType === 'cpf' || wallet.pixKeyType === 'cnpj') {
    const fromKey = normalizePixDocument(wallet.pixKey || '');
    if (fromKey.length === 11 || fromKey.length === 14) return fromKey;
  }
  return null;
}

export async function savePixKey(params: {
  businessId: string;
  applicationId: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  pixHolderName: string;
  pixDocument?: string;
}): Promise<MerchantWallet> {
  const err = validatePixKey(params.pixKeyType, params.pixKey);
  if (err) throw new Error(err);
  const name = params.pixHolderName.trim();
  if (name.length < 2) throw new Error('Informe o nome do titular da chave.');

  let doc = normalizePixDocument(params.pixDocument || '');
  if (!doc && (params.pixKeyType === 'cpf' || params.pixKeyType === 'cnpj')) {
    doc = normalizePixKey(params.pixKeyType, params.pixKey);
  }
  const docErr = validatePixDocument(doc);
  if (docErr) throw new Error(docErr);

  const wallet = await ensureWallet(params.businessId, params.applicationId);
  const next: MerchantWallet = {
    ...wallet,
    pixKey: normalizePixKey(params.pixKeyType, params.pixKey),
    pixKeyType: params.pixKeyType,
    pixHolderName: name,
    pixDocument: doc,
    updatedAt: new Date().toISOString(),
  };
  const all = await loadAll();
  await saveAll(all.map((w) => (w.businessId === params.businessId ? next : w)));
  return next;
}

/**
 * Abate dívida de taxa (dinheiro) na carteira local após Pix/cartão no split MP.
 * Idempotente por orderId.
 */
export async function recoverCashFeeDebtInWallet(
  order: Order,
  amountOverride?: number
): Promise<MerchantWallet | null> {
  const amount = round2(
    amountOverride ?? order.cashFeeDebtRecovered ?? 0
  );
  if (amount < 0.01 || !order.businessId) return null;

  const all = await loadAll();
  let wallet = all.find((w) => w.businessId === order.businessId);
  if (!wallet) {
    wallet = emptyWallet(order.businessId, order.businessId);
    all.unshift(wallet);
  }
  if (wallet.entries.some((e) => e.id === `cfrcv_${order.id}`)) return wallet;

  const debt = pendingCashFeeDebt(wallet);
  const recover = round2(Math.min(amount, debt > 0 ? debt : amount));
  if (recover < 0.01) return wallet;

  const label =
    order.shopOrderNumber != null ? `#${order.shopOrderNumber}` : order.id.slice(-6);
  const entry: WalletEntry = {
    id: `cfrcv_${order.id}`,
    businessId: order.businessId,
    type: 'cash_fee_recovery',
    amount: recover,
    orderId: order.id,
    shopOrderNumber: order.shopOrderNumber,
    description: `Débito de taxa (dinheiro) abatido no pedido ${label}`,
    createdAt: new Date().toISOString(),
  };
  const next: MerchantWallet = {
    ...wallet,
    entries: [entry, ...wallet.entries],
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.businessId === order.businessId ? next : w)));
  return next;
}

/**
 * Credita establishmentAmount só depois da entrega confirmada.
 * Idempotente por orderId.
 * Com marketplace split (já pago no MP): não credita de novo — só abate dívida.
 */
export async function creditOrderToWallet(order: Order): Promise<MerchantWallet | null> {
  if (order.status !== 'entregue') return null;

  if (order.settlementMerchantPaidViaMp) {
    return recoverCashFeeDebtInWallet(order);
  }

  if (!orderEligibleForCredit(order)) return null;
  const amount = round2(order.establishmentAmount ?? 0);
  if (amount <= 0) return null;

  const all = await loadAll();
  let wallet = all.find((w) => w.businessId === order.businessId);
  if (!wallet) {
    wallet = emptyWallet(order.businessId, order.businessId);
    all.unshift(wallet);
  }
  if (hasOpenCredit(wallet, order.id)) {
    return wallet;
  }

  const label =
    order.shopOrderNumber != null ? `#${order.shopOrderNumber}` : order.id.slice(-6);
  const entry: WalletEntry = {
    id: `cr_${order.id}`,
    businessId: order.businessId,
    type: 'credit',
    amount,
    orderId: order.id,
    shopOrderNumber: order.shopOrderNumber,
    description: `Pedido ${label} entregue`,
    createdAt: new Date().toISOString(),
  };
  const next: MerchantWallet = {
    ...wallet,
    entries: [entry, ...wallet.entries],
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.businessId === order.businessId ? next : w)));
  return next;
}

/** Estorna crédito se o pedido for cancelado depois de confirmado. */
export async function reverseOrderCredit(order: Order): Promise<MerchantWallet | null> {
  const all = await loadAll();
  const wallet = all.find((w) => w.businessId === order.businessId);
  if (!wallet || !hasOpenCredit(wallet, order.id)) return wallet ?? null;

  const credit = wallet.entries.find(
    (e) => e.type === 'credit' && e.orderId === order.id
  );
  const amount = credit?.amount ?? round2(order.establishmentAmount ?? 0);
  if (amount <= 0) return wallet;

  const label =
    order.shopOrderNumber != null ? `#${order.shopOrderNumber}` : order.id.slice(-6);
  const entry: WalletEntry = {
    id: `rv_${order.id}_${Date.now()}`,
    businessId: order.businessId,
    type: 'reversal',
    amount,
    orderId: order.id,
    shopOrderNumber: order.shopOrderNumber,
    description: `Estorno pedido ${label} (cancelado)`,
    createdAt: new Date().toISOString(),
  };
  const next: MerchantWallet = {
    ...wallet,
    entries: [entry, ...wallet.entries],
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.businessId === order.businessId ? next : w)));
  return next;
}

function cashFeeAmount(order: Order): number {
  return round2(order.cashFeePixAmount ?? order.platformFee ?? 0);
}

function hasOpenCashFee(wallet: MerchantWallet, orderId: string): boolean {
  const returned = wallet.entries.some((e) => e.id === `cfr_${orderId}`);
  if (returned) return false;
  return wallet.entries.some((e) => e.type === 'cash_fee' && e.orderId === orderId);
}

/**
 * Pedido em dinheiro da própria loja: a taxa gravada no pedido sai do caixa Pix.
 * A loja fica com a cédula. Idempotente por pedido.
 */
export async function debitCashFeeFromWallet(order: Order): Promise<MerchantWallet | null> {
  if (order.paymentProvider !== 'offline' || order.deliveryBy !== 'store') return null;
  if (order.status === 'cancelado') return null;
  const amount = cashFeeAmount(order);
  if (amount < 0.01) return null;

  const all = await loadAll();
  let wallet = all.find((w) => w.businessId === order.businessId);
  if (!wallet) {
    wallet = emptyWallet(order.businessId, order.businessId);
    all.unshift(wallet);
  }
  if (hasOpenCashFee(wallet, order.id)) return wallet;

  const label =
    order.shopOrderNumber != null ? `#${order.shopOrderNumber}` : order.id.slice(-6);
  const entry: WalletEntry = {
    id: `cf_${order.id}`,
    businessId: order.businessId,
    type: 'cash_fee',
    amount,
    orderId: order.id,
    shopOrderNumber: order.shopOrderNumber,
    description: `Taxa Peça Já do pedido ${label} em dinheiro — saiu do caixa e cai no Pix`,
    createdAt: new Date().toISOString(),
  };
  const next: MerchantWallet = {
    ...wallet,
    entries: [entry, ...wallet.entries],
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.businessId === order.businessId ? next : w)));
  return next;
}

/** Devolve a taxa ao caixa se o pedido em dinheiro for cancelado. */
export async function returnCashFeeToWallet(order: Order): Promise<MerchantWallet | null> {
  const all = await loadAll();
  const wallet = all.find((w) => w.businessId === order.businessId);
  if (!wallet || !hasOpenCashFee(wallet, order.id)) return wallet ?? null;
  const fee = wallet.entries.find((e) => e.type === 'cash_fee' && e.orderId === order.id);
  const amount = fee?.amount ?? cashFeeAmount(order);
  if (amount <= 0) return wallet;
  const label =
    order.shopOrderNumber != null ? `#${order.shopOrderNumber}` : order.id.slice(-6);
  const entry: WalletEntry = {
    id: `cfr_${order.id}`,
    businessId: order.businessId,
    type: 'credit',
    amount,
    orderId: order.id,
    shopOrderNumber: order.shopOrderNumber,
    description: `Taxa do pedido ${label} devolvida ao caixa (cancelado)`,
    createdAt: new Date().toISOString(),
  };
  const next: MerchantWallet = {
    ...wallet,
    entries: [entry, ...wallet.entries],
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.businessId === order.businessId ? next : w)));
  return next;
}

/** Backfill: credita pedidos confirmados antigos ainda sem lançamento. */
export async function syncWalletFromOrders(
  businessId: string,
  applicationId: string,
  orders: Order[]
): Promise<MerchantWallet> {
  await ensureWallet(businessId, applicationId);
  for (const order of orders) {
    if (order.businessId !== businessId) continue;
    if (order.paymentProvider === 'offline' && order.deliveryBy === 'store') {
      if (order.status === 'cancelado') {
        await returnCashFeeToWallet(order);
      } else {
        await reverseOrderCredit(order);
        await debitCashFeeFromWallet(order);
      }
      continue;
    }
    if (orderEligibleForCredit(order)) {
      await creditOrderToWallet(order);
    }
  }
  return (await getWallet(businessId))!;
}

function sameLocalDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function withdrawalsToday(wallet: MerchantWallet | null | undefined): number {
  if (!wallet) return 0;
  return wallet.entries.filter(
    (e) =>
      e.type === 'withdrawal' &&
      (e.status === 'pending' || e.status === 'paid') &&
      sameLocalDay(e.createdAt)
  ).length;
}

export type WithdrawCheck =
  | { ok: true }
  | { ok: false; error: string };

export function canRequestWithdraw(
  wallet: MerchantWallet | null | undefined,
  amount: number
): WithdrawCheck {
  if (!wallet) return { ok: false, error: 'Carteira não encontrada.' };
  if (!wallet.pixKey || !wallet.pixKeyType) {
    return { ok: false, error: 'Cadastre uma chave Pix antes de sacar.' };
  }
  if (!resolvePixDocument(wallet)) {
    return {
      ok: false,
      error: 'Cadastre o CPF/CNPJ do titular da chave Pix para sacar.',
    };
  }
  const value = round2(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: 'Informe um valor válido.' };
  }
  if (value < WALLET_MIN_WITHDRAW) {
    return {
      ok: false,
      error: `Saque mínimo de R$ ${WALLET_MIN_WITHDRAW.toFixed(2).replace('.', ',')}.`,
    };
  }
  const bal = availableBalance(wallet);
  if (value > bal) {
    return { ok: false, error: 'Saldo insuficiente.' };
  }
  if (withdrawalsToday(wallet) >= WALLET_MAX_WITHDRAWS_PER_DAY) {
    return {
      ok: false,
      error: 'Você já fez o saque de hoje. Tente novamente amanhã.',
    };
  }
  return { ok: true };
}

export async function requestWithdraw(params: {
  businessId: string;
  applicationId: string;
  amount: number;
}): Promise<{ wallet: MerchantWallet; entry: WalletEntry }> {
  const wallet = await ensureWallet(params.businessId, params.applicationId);
  const check = canRequestWithdraw(wallet, params.amount);
  if (!check.ok) throw new Error(check.error);

  const amount = round2(params.amount);
  const entry: WalletEntry = {
    id: `wd_${Date.now()}`,
    businessId: params.businessId,
    type: 'withdrawal',
    amount,
    description: `Saque Pix · ${pixKeyTypeLabel(wallet.pixKeyType!)}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    pixKey: wallet.pixKey!,
    pixKeyType: wallet.pixKeyType!,
    pixHolderName: wallet.pixHolderName,
    pixDocument: resolvePixDocument(wallet),
    mpPayoutId: null,
    paidAt: null,
    failedAt: null,
    failReason: null,
    receipt: null,
  };
  const next: MerchantWallet = {
    ...wallet,
    entries: [entry, ...wallet.entries],
    updatedAt: new Date().toISOString(),
  };
  const all = await loadAll();
  await saveAll(all.map((w) => (w.businessId === params.businessId ? next : w)));
  return { wallet: next, entry };
}

function randomDigits(n: number) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function randomAlphaNum(n: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function buildWithdrawReceipt(
  entry: WalletEntry,
  wallet: MerchantWallet,
  paidAt: string,
  overrides?: {
    endToEndId?: string;
    authCode?: string;
    receiptId?: string;
    payerName?: string;
  }
): WithdrawReceipt {
  const stamp = paidAt.replace(/\D/g, '').slice(0, 14);
  return {
    receiptId:
      overrides?.receiptId || `PJ-RCP-${stamp.slice(-8)}-${randomAlphaNum(4)}`,
    authCode:
      overrides?.authCode ||
      `${randomAlphaNum(4)}-${randomDigits(6)}-${randomAlphaNum(4)}`,
    endToEndId:
      overrides?.endToEndId ||
      `E${randomDigits(8)}${stamp}${randomDigits(5)}`,
    paidAt,
    amount: entry.amount,
    pixKey: entry.pixKey ?? wallet.pixKey ?? '',
    pixKeyType: entry.pixKeyType ?? wallet.pixKeyType ?? 'random',
    holderName: entry.pixHolderName ?? wallet.pixHolderName ?? 'Titular Pix',
    payerName: overrides?.payerName || 'Peça Já Pagamentos · Mercado Pago',
  };
}

/** Anexa ID do payout MP ao saque pendente. */
export async function attachWithdrawPayout(
  businessId: string,
  entryId: string,
  meta: { payoutId: string; endToEndId?: string | null }
): Promise<MerchantWallet | null> {
  const all = await loadAll();
  const wallet = all.find((w) => w.businessId === businessId);
  if (!wallet) return null;
  const nextEntries = wallet.entries.map((e) => {
    if (e.id !== entryId || e.type !== 'withdrawal') return e;
    return {
      ...e,
      mpPayoutId: meta.payoutId,
      description: `Saque Pix processando · MP ${meta.payoutId}`,
    };
  });
  const next: MerchantWallet = {
    ...wallet,
    entries: nextEntries,
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.businessId === businessId ? next : w)));
  return next;
}

/** Conclui o Pix (pago/falhou) e gera comprovante quando pago. */
export async function completeWithdraw(
  businessId: string,
  entryId: string,
  outcome: 'paid' | 'failed' = 'paid',
  failReason?: string,
  receiptOverrides?: {
    endToEndId?: string;
    authCode?: string;
    receiptId?: string;
    payerName?: string;
  }
): Promise<MerchantWallet | null> {
  const all = await loadAll();
  const wallet = all.find((w) => w.businessId === businessId);
  if (!wallet) return null;

  const nextEntries = wallet.entries.map((e) => {
    if (e.id !== entryId || e.type !== 'withdrawal') return e;
    if (e.status === 'paid' || e.status === 'failed') return e;
    if (outcome === 'paid') {
      const paidAt = new Date().toISOString();
      const receipt = buildWithdrawReceipt(e, wallet, paidAt, receiptOverrides);
      return {
        ...e,
        status: 'paid' as const,
        paidAt,
        receipt,
        failReason: null,
        failedAt: null,
        description: `Saque Pix pago · ${e.pixKeyType ? pixKeyTypeLabel(e.pixKeyType) : 'Pix'}`,
      };
    }
    return {
      ...e,
      status: 'failed' as const,
      failedAt: new Date().toISOString(),
      failReason: failReason ?? 'Falha no envio Pix',
      description: `Saque Pix falhou · valor devolvido ao saldo`,
      receipt: null,
    };
  });

  const next: MerchantWallet = {
    ...wallet,
    entries: nextEntries,
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.businessId === businessId ? next : w)));
  return next;
}

export function findWalletEntry(
  wallet: MerchantWallet | null | undefined,
  entryId: string
): WalletEntry | null {
  if (!wallet) return null;
  return wallet.entries.find((e) => e.id === entryId) ?? null;
}

/** Texto plano do comprovante (compartilhar / copiar). */
export function formatReceiptText(receipt: WithdrawReceipt): string {
  const when = (() => {
    try {
      return new Date(receipt.paidAt).toLocaleString('pt-BR');
    } catch {
      return receipt.paidAt;
    }
  })();
  const amount = receipt.amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  return [
    'COMPROVANTE DE TRANSFERÊNCIA PIX',
    'Peça Já',
    '',
    `Comprovante: ${receipt.receiptId}`,
    `Autenticação: ${receipt.authCode}`,
    `ID da transação: ${receipt.endToEndId}`,
    `Data/hora: ${when}`,
    '',
    `Valor: ${amount}`,
    `Pagador: ${receipt.payerName}`,
    `Recebedor: ${receipt.holderName}`,
    `Chave Pix (${pixKeyTypeLabel(receipt.pixKeyType)}): ${receipt.pixKey}`,
    '',
    'Este comprovante confirma o saque da carteira do comércio no Peça Já.',
  ].join('\n');
}

export function entrySignedAmount(e: WalletEntry): number {
  if (e.type === 'credit' || e.type === 'cash_fee_recovery') return e.amount;
  if (e.type === 'cash_fee') return -e.amount;
  if (e.type === 'reversal') return -e.amount;
  if (e.type === 'withdrawal') {
    if (e.status === 'failed') return 0;
    return -e.amount;
  }
  return 0;
}

export function withdrawalStatusLabel(status?: WithdrawalStatus): string {
  if (status === 'paid') return 'Pago';
  if (status === 'failed') return 'Falhou';
  if (status === 'pending') return 'Processando';
  return '';
}

/** Garante comprovante em saques já pagos (extrato antigo). */
export async function ensureWithdrawalReceipts(
  businessId: string
): Promise<MerchantWallet | null> {
  const all = await loadAll();
  const wallet = all.find((w) => w.businessId === businessId);
  if (!wallet) return null;

  let changed = false;
  const nextEntries = wallet.entries.map((e) => {
    if (e.type !== 'withdrawal' || e.status !== 'paid' || e.receipt) return e;
    changed = true;
    const paidAt = e.paidAt ?? e.createdAt;
    return {
      ...e,
      pixHolderName: e.pixHolderName ?? wallet.pixHolderName,
      receipt: buildWithdrawReceipt(
        {
          ...e,
          pixHolderName: e.pixHolderName ?? wallet.pixHolderName,
          pixKey: e.pixKey ?? wallet.pixKey ?? undefined,
          pixKeyType: e.pixKeyType ?? wallet.pixKeyType ?? undefined,
        },
        wallet,
        paidAt
      ),
    };
  });

  if (!changed) return wallet;
  const next: MerchantWallet = {
    ...wallet,
    entries: nextEntries,
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.businessId === businessId ? next : w)));
  return next;
}
