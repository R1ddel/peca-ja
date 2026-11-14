/**
 * Agregações e helpers do Peça Já Command Center (/admin).
 */
import type { Order } from '@/types';
import type {
  AuditLogEntry,
  LedgerEntry,
  PlatformState,
  PlatformUser,
  SupportTicket,
  PartnerApplicationRecord,
} from '@/services/platformTypes';
import type { MerchantShop } from '@/utils/merchantShop';
import {
  hasMinRole,
  hasPermission,
  isStaffRole,
  normalizeRole,
  type PlatformPermission,
  type PlatformRole,
} from '@/services/platformRoles';
import { newId } from '@/services/platformCrypto';
import { HQ_YEAR2 } from '@/services/hqProjection';
import {
  filterStateForMode,
  hqEnvironmentLabel,
  isProjectionAvailable,
  normalizeHqMode,
  type HqDataMode,
} from '@/services/hqMode';

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

export function shopMetrics(orders: Order[], businessId: string) {
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

export function ledgerBalanceFor(
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

export function appendAuditLog(
  state: PlatformState,
  input: Omit<AuditLogEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): PlatformState {
  const entry: AuditLogEntry = {
    id: input.id || newId('aud'),
    actorId: input.actorId,
    actorEmail: String(input.actorEmail || '').slice(0, 200),
    action: input.action,
    entityType: input.entityType,
    entityId: String(input.entityId || ''),
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ? String(input.reason).slice(0, 500) : undefined,
    ip: input.ip ? String(input.ip).slice(0, 64) : undefined,
    result: input.result,
    createdAt: input.createdAt || new Date().toISOString(),
  };
  const prev = Array.isArray(state.auditLogs) ? state.auditLogs : [];
  const auditLogs = [entry, ...prev].slice(0, 5000);
  return { ...state, auditLogs };
}

export function buildAdminOverview(state: PlatformState, modeRaw: HqDataMode | string = 'real') {
  const mode = normalizeHqMode(modeRaw);
  const scoped = filterStateForMode(state, mode);
  const todayMs = startOfLocalDay().getTime();
  const yesterdayMs = daysAgo(1).getTime();
  const weekMs = daysAgo(7).getTime();
  const monthMs = daysAgo(30).getTime();
  const orders = scoped.orders || [];
  const users = scoped.users || [];
  const shops = scoped.shops || [];

  const sumPaid = (list: Order[]) => {
    const paid = list.filter(orderPaid);
    return {
      count: list.length,
      paidCount: paid.length,
      gmv: Math.round(paid.reduce((s, o) => s + Number(o.total || 0), 0) * 100) / 100,
      platformFee:
        Math.round(paid.reduce((s, o) => s + Number(o.platformFee || 0), 0) * 100) / 100,
      delivered: list.filter((o) => o.status === 'entregue').length,
      canceled: list.filter((o) => o.status === 'cancelado').length,
      inProgress: list.filter(
        (o) => o.status !== 'entregue' && o.status !== 'cancelado'
      ).length,
    };
  };

  const todayOrders = orders.filter((o) => new Date(o.createdAt).getTime() >= todayMs);
  const yOrders = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= yesterdayMs && t < todayMs;
  });
  const weekOrders = orders.filter((o) => new Date(o.createdAt).getTime() >= weekMs);
  const monthOrders = orders.filter((o) => new Date(o.createdAt).getTime() >= monthMs);

  const openTickets = (scoped.tickets || []).filter(
    (x) => x.status === 'open' || x.status === 'in_progress'
  ).length;
  const shopsActive = shops.filter((s) => !s.suspended).length;
  const shopsSuspended = shops.filter((s) => !!s.suspended).length;
  const customers = users.filter((u) => !isStaffRole(u.platformRole));
  const blockedUsers = customers.filter((u) => !!u.blocked).length;
  const newToday = customers.filter((u) => new Date(u.createdAt).getTime() >= todayMs).length;
  const new7d = customers.filter((u) => new Date(u.createdAt).getTime() >= weekMs).length;
  const new30d = customers.filter((u) => new Date(u.createdAt).getTime() >= monthMs).length;
  const apps = scoped.applications || [];
  const pendingMerchants = apps.filter(
    (a) =>
      a.role === 'merchant' &&
      (a.status === 'pending' || a.status === 'lead' || a.status === 'contact')
  ).length;
  const pendingDrivers = apps.filter(
    (a) => a.role === 'driver' && (a.status === 'pending' || a.status === 'lead')
  ).length;
  const citiesActive = (scoped.cities || []).filter((c) => c.status === 'active').length;
  const citiesImplanting = (scoped.cities || []).filter((c) => c.status === 'implanting').length;
  const openIncidents = (scoped.incidents || []).filter(
    (i) => i.status === 'open' || i.status === 'investigating'
  ).length;

  const ledger = scoped.ledger || [];
  const refunds = ledger
    .filter((e) => e.kind === 'debit' && /refund|estorno|reembolso/i.test(e.note || ''))
    .reduce((s, e) => s + e.amount, 0);
  const withdrawals = ledger.filter((e) => e.kind === 'withdraw').reduce((s, e) => s + e.amount, 0);
  const platformBalance = Math.round(ledgerBalanceFor(ledger, 'platform', 'pecaja') * 100) / 100;

  const seriesOrders: number[] = [];
  const seriesGmv: number[] = [];
  const seriesLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfLocalDay();
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const t0 = dayStart.getTime();
    const t1 = dayEnd.getTime();
    const dayOrders = orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= t0 && t < t1;
    });
    const paid = dayOrders.filter(orderPaid);
    seriesOrders.push(dayOrders.length);
    seriesGmv.push(Math.round(paid.reduce((s, o) => s + Number(o.total || 0), 0) * 100) / 100);
    seriesLabels.push(dayStart.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }));
  }

  const today = sumPaid(todayOrders);
  const yesterday = sumPaid(yOrders);
  const week7d = sumPaid(weekOrders);
  const month30d = sumPaid(monthOrders);

  const base: Record<string, unknown> = {
    mode,
    environmentLabel: hqEnvironmentLabel(mode),
    projectionAvailable: isProjectionAvailable(state),
    today,
    yesterday,
    week7d,
    month30d,
    shopsActive,
    shopsSuspended,
    shopsTotal: shops.length,
    openTickets,
    usersTotal: customers.length,
    usersBlocked: blockedUsers,
    usersNewToday: newToday,
    usersNew7d: new7d,
    usersNew30d: new30d,
    pendingMerchants,
    pendingDrivers,
    citiesActive,
    citiesImplanting,
    citiesTotal: (scoped.cities || []).length,
    openIncidents,
    finance: {
      refunds: Math.round(refunds * 100) / 100,
      withdrawals: Math.round(withdrawals * 100) / 100,
      platformBalance,
    },
    series7d: { labels: seriesLabels, orders: seriesOrders, gmv: seriesGmv },
    revision: state.revision,
    targets: null,
    insights: buildHqInsights({ today, yesterday, openTickets, pendingMerchants }, scoped),
    alerts: buildHqAlerts({ openIncidents }, scoped),
  };

  if (mode !== 'projection' || !isProjectionAvailable(state)) {
    return base;
  }

  const y = HQ_YEAR2;
  return {
    ...base,
    mode: 'projection',
    environmentLabel: hqEnvironmentLabel('projection'),
    projection: y.label,
    today: { ...y.today },
    yesterday: { ...y.yesterday },
    week7d: { ...y.week7d },
    month30d: { ...y.month30d },
    shopsActive: y.shopsActive,
    shopsSuspended: y.shopsSuspended,
    shopsTotal: y.shopsTotal,
    openTickets: y.openTickets,
    usersTotal: y.usersTotal,
    usersBlocked: y.usersBlocked,
    usersNewToday: y.usersNewToday,
    usersNew7d: y.usersNew7d,
    usersNew30d: y.usersNew30d,
    pendingMerchants: y.pendingMerchants,
    pendingDrivers: y.pendingDrivers,
    citiesActive: y.citiesActive,
    citiesImplanting: y.citiesImplanting,
    citiesTotal: y.citiesTotal,
    openIncidents: y.openIncidents,
    finance: { ...y.finance },
    series7d: {
      labels: [...y.series7d.labels],
      orders: [...y.series7d.orders],
      gmv: [...y.series7d.gmv],
    },
    targets: { ...y.targets },
    insights: [
      {
        id: 'proj-scale',
        severity: 'info',
        title: 'Cenário Ano 2 (planejamento)',
        detail:
          'Pedidos/dia ' +
          y.today.count.toLocaleString('pt-BR') +
          ' · GMV/mês ' +
          y.month30d.gmv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        href: '/admin/overview',
      },
      {
        id: 'proj-target',
        severity: 'info',
        title: 'Meta diária de pedidos',
        detail:
          'Meta ' +
          y.targets.todayOrders.toLocaleString('pt-BR') +
          ' · projetado ' +
          y.today.count.toLocaleString('pt-BR') +
          ' (' +
          Math.round((y.today.count / y.targets.todayOrders) * 1000) / 10 +
          '% da meta)',
      },
    ],
    alerts: [
      {
        id: 'proj-banner',
        level: 'info',
        title: 'Ambiente de planejamento — números não são operação real',
        href: '/admin/overview',
      },
    ],
  };
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous && !current) return 0;
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function buildHqInsights(
  overview: {
    today: { count: number; gmv: number; canceled: number };
    yesterday: { count: number; gmv: number };
    openTickets: number;
    pendingMerchants: number;
  },
  state: PlatformState
) {
  const out: Array<{ id: string; severity: string; title: string; detail: string; href?: string }> =
    [];
  const dOrders = pctDelta(overview.today.count, overview.yesterday.count);
  if (dOrders != null) {
    out.push({
      id: 'orders-vs-yesterday',
      severity: dOrders >= 0 ? 'info' : 'medium',
      title:
        dOrders >= 0
          ? 'Pedidos cresceram ' + dOrders + '% vs ontem'
          : 'Pedidos caíram ' + Math.abs(dOrders) + '% vs ontem',
      detail: 'Hoje ' + overview.today.count + ' · ontem ' + overview.yesterday.count,
      href: '/admin/orders?sinceDays=1',
    });
  }
  const dGmv = pctDelta(overview.today.gmv, overview.yesterday.gmv);
  if (dGmv != null && (overview.today.gmv > 0 || overview.yesterday.gmv > 0)) {
    out.push({
      id: 'gmv-vs-yesterday',
      severity: 'info',
      title: dGmv >= 0 ? 'GMV +' + dGmv + '% vs ontem' : 'GMV ' + dGmv + '% vs ontem',
      detail: overview.today.gmv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' hoje',
      href: '/admin/finance',
    });
  }
  if (overview.today.canceled > 0 && overview.today.count > 0) {
    const rate = Math.round((overview.today.canceled / overview.today.count) * 1000) / 10;
    out.push({
      id: 'cancel-rate',
      severity: rate >= 8 ? 'high' : 'medium',
      title: 'Taxa de cancelamento hoje: ' + rate + '%',
      detail: overview.today.canceled + ' cancelados de ' + overview.today.count + ' pedidos',
      href: '/admin/orders?sinceDays=1&status=cancelado',
    });
  }
  if (overview.openTickets > 0) {
    out.push({
      id: 'tickets',
      severity: overview.openTickets > 20 ? 'high' : 'medium',
      title: overview.openTickets + ' tickets abertos',
      detail: 'Fila de suporte ativa',
      href: '/admin/tickets',
    });
  }
  if (overview.pendingMerchants > 0) {
    out.push({
      id: 'crm-merchants',
      severity: 'info',
      title: overview.pendingMerchants + ' leads/comércios pendentes no CRM',
      detail: 'Pipeline comercial aguardando avanço',
      href: '/admin/crm',
    });
  }
  const byCity: Record<string, number> = {};
  const todayStart = startOfLocalDay().getTime();
  for (const o of state.orders || []) {
    if (new Date(o.createdAt).getTime() < todayStart) continue;
    const city = String((o as any).city || '—');
    byCity[city] = (byCity[city] || 0) + 1;
  }
  const top = Object.entries(byCity).sort((a, b) => b[1] - a[1])[0];
  if (top && overview.today.count > 0) {
    const share = Math.round((top[1] / overview.today.count) * 1000) / 10;
    out.push({
      id: 'top-city',
      severity: 'info',
      title: top[0] + ' concentra ' + share + '% dos pedidos de hoje',
      detail: top[1] + ' pedidos nesta cidade',
      href: '/admin/orders?sinceDays=1&q=' + encodeURIComponent(top[0]),
    });
  }
  if (!out.length) {
    out.push({
      id: 'empty-ops',
      severity: 'info',
      title: 'Sem volume suficiente para insights hoje',
      detail: 'Insights aparecem quando há pedidos, tickets ou leads no período.',
    });
  }
  return out.slice(0, 8);
}

function buildHqAlerts(overview: { openIncidents: number }, state: PlatformState) {
  const alerts: Array<{
    id: string;
    level: 'critical' | 'high' | 'medium' | 'info';
    title: string;
    href?: string;
  }> = [];
  const active = (state.orders || []).filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  );
  const delayed = active.filter((o) => {
    const ageMin = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    return ageMin > 90 && o.status !== 'saiu_entrega';
  });
  if (delayed.length) {
    alerts.push({
      id: 'delayed',
      level: delayed.length >= 10 ? 'critical' : 'high',
      title: delayed.length + ' pedidos atrasados (>90 min)',
      href: '/admin/ops',
    });
  }
  const awaiting = active.filter(
    (o) => o.status === 'confirmado' || (o.status === 'preparando' && !o.driverId)
  );
  if (awaiting.length) {
    alerts.push({
      id: 'awaiting-driver',
      level: awaiting.length >= 20 ? 'high' : 'medium',
      title: awaiting.length + ' pedidos sem entregador',
      href: '/admin/ops',
    });
  }
  if (overview.openIncidents > 0) {
    alerts.push({
      id: 'incidents',
      level: 'high',
      title: overview.openIncidents + ' incidentes abertos',
      href: '/admin/incidents',
    });
  }
  if (!process.env.MP_ACCESS_TOKEN) {
    alerts.push({
      id: 'payments',
      level: 'medium',
      title: 'Pagamentos não configurados (MP_ACCESS_TOKEN ausente)',
      href: '/admin/health',
    });
  }
  return alerts;
}

export function buildOpsNow(state: PlatformState, modeRaw: HqDataMode | string = 'real') {
  const mode = normalizeHqMode(modeRaw);
  const scoped = filterStateForMode(state, mode);
  const orders = scoped.orders || [];
  const active = orders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado');
  const byStatus: Record<string, number> = {};
  for (const o of active) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  }
  const delayed = active.filter((o) => {
    const ageMin = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    return ageMin > 90 && o.status !== 'saiu_entrega';
  });
  const awaitingDriver = active.filter(
    (o) => o.status === 'confirmado' || (o.status === 'preparando' && !o.driverId)
  );
  const base = {
    mode,
    environmentLabel: hqEnvironmentLabel(mode),
    activeCount: active.length,
    byStatus,
    delayed: delayed.slice(0, 50),
    delayedCount: delayed.length,
    awaitingDriverCount: awaitingDriver.length,
    newOrders: active.filter((o) => o.status === 'pendente').slice(0, 30),
    preparing: active.filter((o) => o.status === 'preparando').slice(0, 30),
    recentFailures: (scoped.systemLogs || [])
      .filter((l) => l.level === 'error' || l.level === 'critical')
      .slice(0, 20),
    openIncidents: (scoped.incidents || [])
      .filter((i) => i.status === 'open' || i.status === 'investigating')
      .slice(0, 10),
  };

  if (mode !== 'projection' || !isProjectionAvailable(state)) return base;

  return {
    ...base,
    projection: HQ_YEAR2.label,
    activeCount: HQ_YEAR2.ops.activeCount,
    byStatus: { ...HQ_YEAR2.ops.byStatus },
    delayedCount: HQ_YEAR2.ops.delayedCount,
    awaitingDriverCount: HQ_YEAR2.ops.awaitingDriverCount,
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
    planPaidUntil: shop.planPaidUntil || null,
    updatedAt: shop.updatedAt,
    latitude: shop.latitude ?? null,
    longitude: shop.longitude ?? null,
    metrics: shopMetrics(state.orders || [], shop.businessId),
    ledgerBalance:
      Math.round(ledgerBalanceFor(state.ledger || [], 'merchant', shop.businessId) * 100) / 100,
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
  const audits = (state.auditLogs || [])
    .filter((a) => a.entityType === 'shop' && a.entityId === businessId)
    .slice(0, 30);
  return {
    shop: (() => {
      const { mpSellerAccessToken, ...safe } = shop as MerchantShop & {
        mpSellerAccessToken?: string;
      };
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
    timeline: audits,
  };
}

export function filterAdminOrders(
  state: PlatformState,
  opts: {
    businessId?: string;
    status?: string;
    sinceDays?: number;
    q?: string;
    city?: string;
  }
): Order[] {
  const since =
    typeof opts.sinceDays === 'number' && opts.sinceDays > 0
      ? daysAgo(opts.sinceDays).getTime()
      : 0;
  const q = String(opts.q || '')
    .trim()
    .toLowerCase();
  return (state.orders || [])
    .filter((o) => {
      if (opts.businessId && o.businessId !== opts.businessId) return false;
      if (opts.status && o.status !== opts.status) return false;
      if (since && new Date(o.createdAt).getTime() < since) return false;
      if (opts.city) {
        const city = String((o as any).city || '').toLowerCase();
        if (city && city !== opts.city.toLowerCase()) return false;
      }
      if (q) {
        const hay = [
          o.id,
          o.businessId,
          o.businessName,
          o.userId,
          o.customerName,
          o.customerPhone,
          o.driverId,
          o.driverName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200);
}

export function buildOrderTimeline(order: Order, state: PlatformState) {
  const events: { at: string; label: string; meta?: string }[] = [];
  events.push({ at: order.createdAt, label: 'Pedido criado' });
  if (order.paymentConfirmed) {
    events.push({
      at: (order as any).paymentConfirmedAt || order.createdAt,
      label: 'Pagamento confirmado',
      meta: order.paymentMethod || undefined,
    });
  }
  const statusAt = (order as any).statusHistory as
    | { status: string; at: string; by?: string }[]
    | undefined;
  if (Array.isArray(statusAt)) {
    for (const s of statusAt) {
      events.push({ at: s.at, label: `Status: ${s.status}`, meta: s.by });
    }
  } else {
    events.push({ at: order.updatedAt || order.createdAt, label: `Status atual: ${order.status}` });
  }
  if (order.driverId) {
    events.push({
      at: (order as any).driverAssignedAt || order.updatedAt || order.createdAt,
      label: 'Entregador designado',
      meta: order.driverName || order.driverId,
    });
  }
  const audits = (state.auditLogs || []).filter(
    (a) => a.entityType === 'order' && a.entityId === order.id
  );
  for (const a of audits) {
    events.push({ at: a.createdAt, label: `Admin: ${a.action}`, meta: a.actorEmail });
  }
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function buildCustomerRows(
  state: PlatformState,
  opts?: { q?: string; city?: string; blocked?: boolean; limit?: number }
) {
  const q = String(opts?.q || '')
    .trim()
    .toLowerCase();
  const limit = Math.min(Math.max(opts?.limit || 100, 1), 300);
  const orders = state.orders || [];
  return (state.users || [])
    .filter((u) => !isStaffRole(u.platformRole))
    .filter((u) => {
      if (typeof opts?.blocked === 'boolean' && !!u.blocked !== opts.blocked) return false;
      if (opts?.city) {
        const city = String(u.address || '').toLowerCase();
        if (!city.includes(opts.city.toLowerCase())) return false;
      }
      if (q) {
        const hay = [u.id, u.name, u.email, u.phone, u.address].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((u) => {
      const mine = orders.filter((o) => o.userId === u.id);
      const paid = mine.filter(orderPaid);
      const gmv = paid.reduce((s, o) => s + Number(o.total || 0), 0);
      const last = mine.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        address: u.address,
        blocked: !!u.blocked,
        blockedReason: u.blockedReason || null,
        createdAt: u.createdAt,
        ordersCount: mine.length,
        gmv: Math.round(gmv * 100) / 100,
        ticketAvg: paid.length ? Math.round((gmv / paid.length) * 100) / 100 : 0,
        lastOrderAt: last?.createdAt || null,
      };
    })
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, limit);
}

export function buildCustomerDetail(state: PlatformState, userId: string) {
  const user = (state.users || []).find((u) => u.id === userId);
  if (!user || isStaffRole(user.platformRole)) return null;
  const orders = (state.orders || [])
    .filter((o) => o.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const paid = orders.filter(orderPaid);
  const gmv = paid.reduce((s, o) => s + Number(o.total || 0), 0);
  const tickets = (state.tickets || []).filter((t) => t.userId === userId || t.email === user.email);
  const audits = (state.auditLogs || []).filter(
    (a) => a.entityType === 'user' && a.entityId === userId
  );
  const { passwordHash: _h, passwordSalt: _s, ...safe } = user;
  return {
    user: safe,
    metrics: {
      ordersCount: orders.length,
      gmv: Math.round(gmv * 100) / 100,
      ticketAvg: paid.length ? Math.round((gmv / paid.length) * 100) / 100 : 0,
      canceled: orders.filter((o) => o.status === 'cancelado').length,
    },
    recentOrders: orders.slice(0, 40),
    tickets: tickets.slice(0, 20),
    timeline: [
      { at: user.createdAt, label: 'Cliente cadastrado' },
      ...(orders[0] ? [{ at: orders[orders.length - 1].createdAt, label: 'Primeiro pedido' }] : []),
      ...audits.map((a) => ({ at: a.createdAt, label: a.action, meta: a.reason })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
  };
}

export function staffDirectory(state: PlatformState): Array<{
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
  createdAt: string;
}> {
  return (state.users || [])
    .filter((u) => isStaffRole(u.platformRole))
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      platformRole: normalizeRole(u.platformRole),
      createdAt: u.createdAt,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function buildFinanceOverview(
  state: PlatformState,
  sinceDays = 30,
  modeRaw: HqDataMode | string = 'real'
) {
  const mode = normalizeHqMode(modeRaw);
  const scoped = filterStateForMode(state, mode);
  const since = daysAgo(sinceDays).getTime();
  const allOrders = scoped.orders || [];
  const orders = allOrders.filter((o) => new Date(o.createdAt).getTime() >= since);
  const paid = orders.filter(orderPaid);
  const gmv = paid.reduce((s, o) => s + Number(o.total || 0), 0);
  const platformFee = paid.reduce((s, o) => s + Number(o.platformFee || 0), 0);
  const merchantNet = paid.reduce(
    (s, o) => s + Number(o.establishmentAmount ?? o.subtotal ?? 0),
    0
  );
  const ledger = (scoped.ledger || []).filter((e) => new Date(e.createdAt).getTime() >= since);
  const credits = ledger.filter((e) => e.kind === 'credit').reduce((s, e) => s + e.amount, 0);
  const debits = ledger
    .filter((e) => e.kind === 'debit' || e.kind === 'withdraw')
    .reduce((s, e) => s + e.amount, 0);
  const withdraws = ledger.filter((e) => e.kind === 'withdraw').reduce((s, e) => s + e.amount, 0);
  const adjusts = ledger.filter((e) => e.kind === 'adjust');

  const chartDays = Math.min(Math.max(sinceDays, 1), 14);
  const seriesGmv: number[] = [];
  const seriesFee: number[] = [];
  const seriesLabels: string[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const dayStart = startOfLocalDay();
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const t0 = dayStart.getTime();
    const t1 = dayEnd.getTime();
    const dayPaid = allOrders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= t0 && t < t1 && orderPaid(o);
    });
    seriesGmv.push(Math.round(dayPaid.reduce((s, o) => s + Number(o.total || 0), 0) * 100) / 100);
    seriesFee.push(
      Math.round(dayPaid.reduce((s, o) => s + Number(o.platformFee || 0), 0) * 100) / 100
    );
    seriesLabels.push(
      dayStart.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })
    );
  }

  const base = {
    mode,
    environmentLabel: hqEnvironmentLabel(mode),
    sinceDays,
    ordersCount: orders.length,
    paidCount: paid.length,
    canceledCount: orders.filter((o) => o.status === 'cancelado').length,
    gmv: Math.round(gmv * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    merchantNet: Math.round(merchantNet * 100) / 100,
    ledgerCredits: Math.round(credits * 100) / 100,
    ledgerDebits: Math.round(debits * 100) / 100,
    withdrawals: Math.round(withdraws * 100) / 100,
    adjustsCount: adjusts.length,
    platformBalance:
      Math.round(ledgerBalanceFor(scoped.ledger || [], 'platform', 'pecaja') * 100) / 100,
    series: { labels: seriesLabels, gmv: seriesGmv, platformFee: seriesFee },
  };

  if (mode !== 'projection' || !isProjectionAvailable(state)) return base;

  const bucket =
    sinceDays <= 7
      ? HQ_YEAR2.financePeriod[7]
      : sinceDays <= 30
        ? HQ_YEAR2.financePeriod[30]
        : HQ_YEAR2.financePeriod[90];

  return {
    ...base,
    projection: HQ_YEAR2.label,
    ordersCount: bucket.ordersCount,
    paidCount: bucket.paidCount,
    canceledCount: bucket.canceledCount,
    gmv: bucket.gmv,
    platformFee: bucket.platformFee,
    merchantNet: bucket.merchantNet,
    ledgerCredits: bucket.ledgerCredits,
    ledgerDebits: bucket.ledgerDebits,
    withdrawals: bucket.withdrawals,
    platformBalance: HQ_YEAR2.finance.platformBalance,
    series: {
      labels: [...HQ_YEAR2.seriesFinance14d.labels],
      gmv: [...HQ_YEAR2.seriesFinance14d.gmv],
      platformFee: [...HQ_YEAR2.seriesFinance14d.platformFee],
    },
  };
}

export function buildGlobalSearch(state: PlatformState, qRaw: string) {
  const q = String(qRaw || '')
    .trim()
    .toLowerCase();
  if (!q || q.length < 2) {
    return { customers: [], shops: [], orders: [], tickets: [], applications: [] };
  }
  const customers = buildCustomerRows(state, { q, limit: 8 });
  const shops = buildAdminShopRows(state)
    .filter((s) =>
      [s.businessId, s.name, s.city, s.category].join(' ').toLowerCase().includes(q)
    )
    .slice(0, 8);
  const orders = filterAdminOrders(state, { q, sinceDays: 90 }).slice(0, 8);
  const tickets = (state.tickets || [])
    .filter((t) => [t.id, t.email, t.subject, t.body].join(' ').toLowerCase().includes(q))
    .slice(0, 8);
  const applications = (state.applications || [])
    .filter((a) =>
      [a.id, a.name, a.email, a.phone, a.businessName, a.city].join(' ').toLowerCase().includes(q)
    )
    .slice(0, 8);
  return { customers, shops, orders, tickets, applications };
}

export function buildDataQuality(state: PlatformState) {
  const issues: { code: string; severity: 'yellow' | 'red'; message: string; count: number }[] = [];
  const orders = state.orders || [];
  const shops = state.shops || [];
  const users = state.users || [];
  const orphanOrders = orders.filter((o) => !shops.some((s) => s.businessId === o.businessId));
  const noCustomer = orders.filter((o) => o.userId && !users.some((u) => u.id === o.userId));
  const shopsNoGeo = shops.filter((s) => s.latitude == null || s.longitude == null);
  const dupEmails = new Map<string, number>();
  for (const u of users) {
    const k = u.email.toLowerCase();
    dupEmails.set(k, (dupEmails.get(k) || 0) + 1);
  }
  const dups = [...dupEmails.values()].filter((n) => n > 1).length;
  if (orphanOrders.length) {
    issues.push({
      code: 'ORDER_ORPHAN_SHOP',
      severity: 'red',
      message: 'Pedidos sem comércio correspondente',
      count: orphanOrders.length,
    });
  }
  if (noCustomer.length) {
    issues.push({
      code: 'ORDER_ORPHAN_USER',
      severity: 'yellow',
      message: 'Pedidos com userId sem usuário',
      count: noCustomer.length,
    });
  }
  if (shopsNoGeo.length) {
    issues.push({
      code: 'SHOP_NO_GEO',
      severity: 'yellow',
      message: 'Comércios sem coordenadas',
      count: shopsNoGeo.length,
    });
  }
  if (dups) {
    issues.push({
      code: 'DUP_EMAIL',
      severity: 'red',
      message: 'E-mails de usuário duplicados',
      count: dups,
    });
  }
  return { issues, checkedAt: new Date().toISOString() };
}

export function buildProductRows(
  state: PlatformState,
  opts?: { q?: string; businessId?: string; limit?: number }
) {
  const q = String(opts?.q || '')
    .trim()
    .toLowerCase();
  const limit = Math.min(Math.max(opts?.limit || 100, 1), 300);
  const rows: Array<{
    businessId: string;
    businessName: string;
    productId: string;
    name: string;
    price: number;
    category: string;
    available: boolean;
  }> = [];
  for (const shop of state.shops || []) {
    if (opts?.businessId && shop.businessId !== opts.businessId) continue;
    for (const item of shop.menu || []) {
      if (q) {
        const hay = [item.id, item.name, item.category, shop.name].join(' ').toLowerCase();
        if (!hay.includes(q)) continue;
      }
      rows.push({
        businessId: shop.businessId,
        businessName: shop.name,
        productId: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        available: item.available !== false,
      });
    }
  }
  return rows.slice(0, limit);
}

export function buildReports(state: PlatformState, sinceDays = 30) {
  const fin = buildFinanceOverview(state, sinceDays);
  const overview = buildAdminOverview(state);
  const byCity: Record<string, { orders: number; gmv: number }> = {};
  const since = daysAgo(sinceDays).getTime();
  for (const o of state.orders || []) {
    if (new Date(o.createdAt).getTime() < since) continue;
    if (!orderPaid(o)) continue;
    const city = String((o as any).city || '—');
    if (!byCity[city]) byCity[city] = { orders: 0, gmv: 0 };
    byCity[city].orders += 1;
    byCity[city].gmv += Number(o.total || 0);
  }
  return {
    finance: fin,
    overview,
    byCity: Object.entries(byCity).map(([city, v]) => ({
      city,
      orders: v.orders,
      gmv: Math.round(v.gmv * 100) / 100,
    })),
  };
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

export function requirePerm(
  user: PlatformUser | null,
  perm: PlatformPermission
): { ok: true; user: PlatformUser } | { ok: false; code: string; message: string } {
  if (!user) {
    return { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' };
  }
  if (!hasPermission(user.platformRole, perm)) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: `Sem permissão: ${perm}.`,
    };
  }
  return { ok: true, user };
}

export type { MerchantShop, SupportTicket, PartnerApplicationRecord };
