/**
 * Carteira do entregador: crédito do frete + saque Pix (local / futuro PSP).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '@/types';
import { driverEarningsOf } from '@/utils/driverOps';
import {
  PixKeyType,
  normalizePixKey,
  validatePixKey,
  normalizePixDocument,
  validatePixDocument,
} from '@/utils/merchantWallet';

const KEY = '@pecaja_driver_wallet_v1';

import {
  DRIVER_MAX_WITHDRAWS_PER_DAY as DRIVER_MAX_DAY,
  DRIVER_MIN_WITHDRAW as DRIVER_MIN,
} from '@/constants/withdrawRules';

export const DRIVER_MIN_WITHDRAW = DRIVER_MIN;
export const DRIVER_MAX_WITHDRAWS_PER_DAY = DRIVER_MAX_DAY;

export type DriverWalletEntryType = 'credit' | 'reversal' | 'withdrawal';
export type DriverWithdrawalStatus = 'pending' | 'paid' | 'failed';

export type DriverWalletEntry = {
  id: string;
  driverId: string;
  type: DriverWalletEntryType;
  amount: number;
  description: string;
  createdAt: string;
  orderId?: string;
  status?: DriverWithdrawalStatus;
  pixKey?: string;
  pixKeyType?: PixKeyType;
  paidAt?: string | null;
  failedAt?: string | null;
  failReason?: string | null;
};

export type DriverWallet = {
  driverId: string;
  applicationId: string;
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  pixHolderName: string | null;
  pixDocument: string | null;
  entries: DriverWalletEntry[];
  updatedAt: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function loadAll(): Promise<DriverWallet[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(list: DriverWallet[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

function emptyWallet(driverId: string, applicationId: string): DriverWallet {
  return {
    driverId,
    applicationId,
    pixKey: null,
    pixKeyType: null,
    pixHolderName: null,
    pixDocument: null,
    entries: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function getDriverWallet(driverId: string): Promise<DriverWallet | null> {
  const all = await loadAll();
  return all.find((w) => w.driverId === driverId) ?? null;
}

export async function ensureDriverWallet(
  driverId: string,
  applicationId: string
): Promise<DriverWallet> {
  const all = await loadAll();
  const found = all.find((w) => w.driverId === driverId);
  if (found) {
    if (found.applicationId !== applicationId) {
      const next = { ...found, applicationId, updatedAt: new Date().toISOString() };
      await saveAll(all.map((w) => (w.driverId === driverId ? next : w)));
      return next;
    }
    return found;
  }
  const created = emptyWallet(driverId, applicationId);
  await saveAll([created, ...all]);
  return created;
}

export function driverAvailableBalance(wallet: DriverWallet | null | undefined): number {
  if (!wallet) return 0;
  let bal = 0;
  for (const e of wallet.entries) {
    if (e.type === 'credit') bal += e.amount;
    else if (e.type === 'reversal') bal -= e.amount;
    else if (e.type === 'withdrawal' && (e.status === 'pending' || e.status === 'paid')) {
      bal -= e.amount;
    }
  }
  return round2(Math.max(0, bal));
}

export function driverTotalEarned(wallet: DriverWallet | null | undefined): number {
  if (!wallet) return 0;
  let c = 0;
  let r = 0;
  for (const e of wallet.entries) {
    if (e.type === 'credit') c += e.amount;
    if (e.type === 'reversal') r += e.amount;
  }
  return round2(Math.max(0, c - r));
}

export function driverTotalWithdrawn(wallet: DriverWallet | null | undefined): number {
  if (!wallet) return 0;
  let s = 0;
  for (const e of wallet.entries) {
    if (e.type === 'withdrawal' && e.status === 'paid') s += e.amount;
  }
  return round2(s);
}

function hasCredit(wallet: DriverWallet, orderId: string): boolean {
  const reversed = new Set(
    wallet.entries.filter((e) => e.type === 'reversal' && e.orderId).map((e) => e.orderId!)
  );
  return wallet.entries.some(
    (e) => e.type === 'credit' && e.orderId === orderId && !reversed.has(orderId)
  );
}

export async function creditDeliveryToDriverWallet(order: Order): Promise<DriverWallet | null> {
  if (!order.driverId || !order.driverId.startsWith('da_')) return null;
  if (order.status !== 'entregue') return null;
  const amount = driverEarningsOf(order);
  if (amount <= 0) return null;

  const applicationId = order.driverId.replace(/^da_/, '');
  const all = await loadAll();
  let wallet = all.find((w) => w.driverId === order.driverId);
  if (!wallet) {
    wallet = emptyWallet(order.driverId, applicationId);
    all.unshift(wallet);
  }
  if (hasCredit(wallet, order.id)) return wallet;

  const entry: DriverWalletEntry = {
    id: `dcr_${order.id}`,
    driverId: order.driverId,
    type: 'credit',
    amount,
    orderId: order.id,
    description: `Entrega ${order.businessName} · #${order.id.slice(-6).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };
  const next: DriverWallet = {
    ...wallet,
    entries: [entry, ...wallet.entries],
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.driverId === order.driverId ? next : w)));
  return next;
}

export async function saveDriverPixKey(params: {
  driverId: string;
  applicationId: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  pixHolderName: string;
  pixDocument?: string;
}): Promise<DriverWallet> {
  const err = validatePixKey(params.pixKeyType, params.pixKey);
  if (err) throw new Error(err);
  const name = params.pixHolderName.trim();
  if (name.length < 2) throw new Error('Informe o nome do titular.');
  let doc = normalizePixDocument(params.pixDocument || '');
  if (!doc && (params.pixKeyType === 'cpf' || params.pixKeyType === 'cnpj')) {
    doc = normalizePixKey(params.pixKeyType, params.pixKey);
  }
  const docErr = validatePixDocument(doc);
  if (docErr) throw new Error(docErr);

  const wallet = await ensureDriverWallet(params.driverId, params.applicationId);
  const next: DriverWallet = {
    ...wallet,
    pixKey: normalizePixKey(params.pixKeyType, params.pixKey),
    pixKeyType: params.pixKeyType,
    pixHolderName: name,
    pixDocument: doc,
    updatedAt: new Date().toISOString(),
  };
  const all = await loadAll();
  await saveAll(all.map((w) => (w.driverId === params.driverId ? next : w)));
  return next;
}

function sameLocalDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function driverWithdrawalsToday(wallet: DriverWallet | null | undefined): number {
  if (!wallet) return 0;
  return wallet.entries.filter(
    (e) =>
      e.type === 'withdrawal' &&
      (e.status === 'pending' || e.status === 'paid') &&
      sameLocalDay(e.createdAt)
  ).length;
}

export async function requestDriverWithdraw(params: {
  driverId: string;
  applicationId: string;
  amount: number;
}): Promise<{ wallet: DriverWallet; entry: DriverWalletEntry }> {
  const wallet = await ensureDriverWallet(params.driverId, params.applicationId);
  if (!wallet.pixKey || !wallet.pixKeyType) {
    throw new Error('Cadastre uma chave Pix antes de sacar.');
  }
  const amount = round2(params.amount);
  if (amount < DRIVER_MIN_WITHDRAW) {
    throw new Error(`Saque mínimo de R$ ${DRIVER_MIN_WITHDRAW.toFixed(2).replace('.', ',')}.`);
  }
  if (amount > driverAvailableBalance(wallet)) {
    throw new Error('Saldo insuficiente.');
  }
  if (driverWithdrawalsToday(wallet) >= DRIVER_MAX_WITHDRAWS_PER_DAY) {
    throw new Error('Limite de saques de hoje atingido.');
  }

  const entry: DriverWalletEntry = {
    id: `dwd_${Date.now()}`,
    driverId: params.driverId,
    type: 'withdrawal',
    amount,
    description: `Saque Pix · ${wallet.pixKeyType}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    pixKey: wallet.pixKey,
    pixKeyType: wallet.pixKeyType,
  };
  const next: DriverWallet = {
    ...wallet,
    entries: [entry, ...wallet.entries],
    updatedAt: new Date().toISOString(),
  };
  const all = await loadAll();
  await saveAll(all.map((w) => (w.driverId === params.driverId ? next : w)));
  return { wallet: next, entry };
}

/** Liquida saque (MVP: local; produção pode ligar no mesmo withdraw MP). */
export async function completeDriverWithdraw(
  driverId: string,
  entryId: string,
  outcome: 'paid' | 'failed' = 'paid',
  failReason?: string
): Promise<DriverWallet | null> {
  const all = await loadAll();
  const wallet = all.find((w) => w.driverId === driverId);
  if (!wallet) return null;
  const nextEntries = wallet.entries.map((e) => {
    if (e.id !== entryId || e.type !== 'withdrawal') return e;
    if (e.status === 'paid' || e.status === 'failed') return e;
    if (outcome === 'paid') {
      return {
        ...e,
        status: 'paid' as const,
        paidAt: new Date().toISOString(),
        description: 'Saque Pix pago',
      };
    }
    return {
      ...e,
      status: 'failed' as const,
      failedAt: new Date().toISOString(),
      failReason: failReason ?? 'Falha no Pix',
      description: 'Saque falhou · valor devolvido',
    };
  });
  const next: DriverWallet = {
    ...wallet,
    entries: nextEntries,
    updatedAt: new Date().toISOString(),
  };
  await saveAll(all.map((w) => (w.driverId === driverId ? next : w)));
  return next;
}

/** Backfill créditos de entregas já concluídas. */
export async function syncDriverWalletFromOrders(
  driverId: string,
  applicationId: string,
  orders: Order[]
): Promise<DriverWallet> {
  await ensureDriverWallet(driverId, applicationId);
  for (const o of orders) {
    if (o.driverId === driverId && o.status === 'entregue') {
      await creditDeliveryToDriverWallet(o);
    }
  }
  return (await getDriverWallet(driverId))!;
}
