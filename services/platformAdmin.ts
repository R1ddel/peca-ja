/**
 * Agregações e handlers do painel HQ (/admin).
 */
import type { Order } from '@/types';
import type {
  LedgerEntry,
  PlatformState,
  PlatformUser,
  SupportTicket,
} from '@/services/platformTypes';
import type { MerchantShop } from '@/utils/merchantShop';
import { hasMinRole, type PlatformRole } from '@/services/platformRoles';

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  const x = startOfLocalDay();
  x.setDate(x.getDate() - n);
  return x;
}

function orderPaid(o: Order): boolean {
  return !!o.paymentConfirmed && o.status !== 'cancelado';
}

function shopMetrics(orders: Order[], businessId: string) {
  const mine = orders.filter((o) => o.businessId === businessId);
  const paid = mine.filter(orderPaid);
  const canceled = mine.filter((o) => o.status === 'cancelado');
  const gmv = paid.reduce((s, o) => s + Number(o.total || 0), 0);
  const platformFee = paid.reduce((s, o) => s + Number(o.platformFee || 0), 0);
  const merchantNet = paid.reduce(
    (s, o) => s + Number(o.establishmentAmount ?? o.subtotal ?? 0),
    0
  );
  return {
    ordersTotal: mine.length,
    ordersPaid: paid.length,
    ordersCanceled: canceled.length,
    gmv: Math.round(gmv * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    merchantNet: Math.round(merchantNet * 100) / 100,
  };
}

function ledgerBalanceFor(
  ledger: LedgerEntry[],
  ownerType: LedgerEntry['ownerType'],
  ownerId: string
): number {
  return ledger
    .filter((e) => e.ownerType === ownerType && e.ownerId === ownerId)
    .reduce(
      (sum, e) => sum + (e.kind === 'debit' || e.kind === 'withdraw' ? -e.amount : e.amount),
      0
    );
}

export function buildAdminOverview(state: PlatformState) {
  const today = startOfLocalDay().getTime();
  const week = daysAgo(7).getTime();
  const orders = state.orders || [];
  const todayOrders = orders.filter((o) => new Date(o.createdAt).getTime() >= today);
  const weekOrders = orders.filter((o) => new Date(o.createdAt).getTime() >= week);
  const sumPaid = (list: Order[]) => {
    const paid = list.filter(orderPaid);
    return {
      count: paid.length,
      gmv: Math.round(paid.reduce((s, o) => s + Number(o.total || 0), 0) * 100) / 100,
      platformFee:
        Math.round(paid.reduce((s, o) => s + Number(o.platformFee || 0), 0) * 100) / 100,
      delivered: paid.filter((o) => o.status === 'entregue').length,
    };
  };
  const t = sumPaid(todayOrders);
  const w = sumPaid(weekOrders);
  const openTickets = (state.tickets || []).filter(
    (x) => x.status === 'open' || x.status === 'in_progress'
  ).length;
  const shopsActive = (state.shops || []).filter((s) => !s.suspended).length;
  const shopsSuspended = (state.shops || []).filter((s) => s.suspended).length;
  return {
    today: t,
    week7d: w,
    shopsActive,
    shopsSuspended,
    shopsTotal: (state.shops || []).length,
    openTickets,
    usersTotal: (state.users || []).length,
    revision: state.revision,
  };
}

export function buildAdminShopRows(state: PlatformState) {
  return (state.shops || []).map((shop) => ({
    businessId: shop.businessId,
    applicationId: shop.applicationId,
    name: shop.name,
    category: shop.category,
    city: shop.city || '',
    isOpen: shop.isOpen,
    suspended: !!shop.suspended,
    suspendedAt: shop.suspendedAt || null,
    suspendedReason: shop.suspendedReason || null,
    ownerUserId: shop.ownerUserId || null,
    plan: shop.plan,
    updatedAt: shop.updatedAt,
    metrics: shopMetrics(state.orders || [], shop.businessId),
    ledgerBalance: Math.round(
      ledgerBalanceFor(state.ledger || [], 'merchant', shop.businessId) * 100
    ) / 100,
  }));
}

export function buildAdminShopDetail(state: PlatformState, businessId: string) {
  const shop = (state.shops || []).find((s) => s.businessId === businessId);
  if (!shop) return null;
  const orders = (state.orders || [])
    .filter((o) => o.businessId === businessId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40);
  const ledger = (state.ledger || [])
    .filter((e) => e.ownerType === 'merchant' && e.ownerId === businessId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40);
  return {
    shop: (() => {
      const { mpSellerAccessToken, ...safe } = shop;
      return {
        ...safe,
        mpMarketplaceLinked: !!mpSellerAccessToken,
      };
    })(),
    metrics: shopMetrics(state.orders || [], businessId),
    ledgerBalance:
      Math.round(ledgerBalanceFor(state.ledger || [], 'merchant', businessId) * 100) / 100,
    recentOrders: orders,
    recentLedger: ledger,
  };
}

export function filterAdminOrders(
  state: PlatformState,
  opts: { businessId?: string; status?: string; sinceDays?: number }
): Order[] {
  const since =
    typeof opts.sinceDays === 'number' && opts.sinceDays > 0
      ? daysAgo(opts.sinceDays).getTime()
      : 0;
  return (state.orders || [])
    .filter((o) => {
      if (opts.businessId && o.businessId !== opts.businessId) return false;
      if (opts.status && o.status !== opts.status) return false;
      if (since && new Date(o.createdAt).getTime() < since) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200);
}

export function staffDirectory(state: PlatformState): Array<{
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
  createdAt: string;
}> {
  return (state.users || [])
    .filter((u) => u.platformRole === 'ceo' || u.platformRole === 'ops')
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      platformRole: (u.platformRole as PlatformRole) || null,
      createdAt: u.createdAt,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function requireStaffUser(
  user: PlatformUser | null,
  min: PlatformRole
): { ok: true; user: PlatformUser } | { ok: false; code: string; message: string } {
  if (!user) {
    return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
  }
  if (!hasMinRole(user.platformRole, min)) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Sem permissão para o painel HQ.',
    };
  }
  return { ok: true, user };
}

export type { MerchantShop, SupportTicket };
