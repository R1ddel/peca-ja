/**
 * Handlers HTTP do Command Center (ações admin_*).
 */
import { newId } from '@/services/platformCrypto';
import { mutatePlatformState, loadPlatformState, platformPersistenceMode } from '@/services/platformStore';
import { fleetPersistenceMode } from '@/services/fleetStore';
import type {
  FeatureFlag,
  PartnerApplicationRecord,
  PlatformAction,
  PlatformCity,
  PlatformCoupon,
  PlatformCampaign,
  PlatformIncident,
  PlatformResult,
  PlatformState,
  PlatformUser,
} from '@/services/platformTypes';
import {
  appendAuditLog,
  buildAdminOverview,
  buildAdminShopDetail,
  buildAdminShopRows,
  buildCustomerDetail,
  buildCustomerRows,
  buildDataQuality,
  buildFinanceOverview,
  buildGlobalSearch,
  buildOpsNow,
  buildOrderTimeline,
  buildProductRows,
  buildReports,
  filterAdminOrders,
  ledgerBalanceFor,
  requirePerm,
  requireStaffUser,
  staffDirectory,
} from '@/services/platformAdmin';
import { isStaffRole, normalizeRole, STAFF_ROLES, type PlatformRole } from '@/services/platformRoles';
import { filterStateForMode } from '@/services/hqMode';
import { ensureProjectionSeeded } from '@/services/hqProjectionSeed';
import { dualWriteCitySafe } from '@/services/relCatalogStore';
import { dualWriteLedgerSafe } from '@/services/relLedgerStore';
import { dualWriteApplicationSafe } from '@/services/relHqStore';

type Ctx = {
  requireUser: (state: PlatformState, token?: string) => PlatformUser | null;
  publicUser: (u: PlatformUser) => Omit<PlatformUser, 'passwordHash' | 'passwordSalt'>;
};

function auditActor(user: PlatformUser) {
  return { actorId: user.id, actorEmail: user.email };
}

/** Leitura do HQ: projeção semeia o cenário e filtra; operação real esconde proj2y_. */
async function loadAdminView(action: { hqMode?: unknown }): Promise<PlatformState> {
  const mode = action.hqMode === 'real' ? 'real' : 'projection';
  let state = await loadPlatformState();
  if (mode === 'projection') state = await ensureProjectionSeeded(state);
  return filterStateForMode(state, mode);
}

export async function handleAdminPlatformAction(
  action: PlatformAction,
  ctx: Ctx
): Promise<PlatformResult | null> {
  const a = action.action;
  if (!a.startsWith('admin_') && a !== 'sync_partner_application') return null;

  const { requireUser, publicUser } = ctx;

  if (action.action === 'admin_overview') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    const hqMode = (action as any).hqMode === 'projection' ? 'projection' : 'real';
    return { ok: true, overview: buildAdminOverview(state, hqMode) };
  }

  if (action.action === 'admin_ops_now') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    const hqMode = (action as any).hqMode === 'projection' ? 'projection' : 'real';
    return { ok: true, ops: buildOpsNow(state, hqMode) };
  }

  if (action.action === 'admin_health') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    return {
      ok: true,
      health: {
        platform: { status: 'online', persistence: platformPersistenceMode(), revision: state.revision },
        fleet: { status: 'online', persistence: fleetPersistenceMode() },
        payments: {
          status: process.env.MP_ACCESS_TOKEN ? 'online' : 'not_configured',
        },
        time: new Date().toISOString(),
      },
    };
  }

  if (action.action === 'admin_search') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    return { ok: true, results: buildGlobalSearch(state, action.q) };
  }

  if (action.action === 'admin_list_shops') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    return { ok: true, shops: buildAdminShopRows(state) };
  }

  if (action.action === 'admin_shop_detail') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    const detail = buildAdminShopDetail(state, String(action.businessId || '').trim());
    if (!detail) return { ok: false, code: 'NOT_FOUND', message: 'Loja não encontrada.' };
    return { ok: true, ...detail };
  }

  if (action.action === 'admin_list_orders') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    return {
      ok: true,
      orders: filterAdminOrders(state, {
        businessId: action.businessId,
        status: action.status,
        sinceDays: action.sinceDays,
        q: action.q,
        city: action.city,
      }),
    };
  }

  if (action.action === 'admin_order_detail') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    const order = (state.orders || []).find((o) => o.id === action.orderId);
    if (!order) return { ok: false, code: 'NOT_FOUND', message: 'Pedido não encontrado.' };
    const ledger = (state.ledger || []).filter((e) => e.orderId === order.id);
    return {
      ok: true,
      order,
      timeline: buildOrderTimeline(order, state),
      ledger,
    };
  }

  if (action.action === 'admin_set_shop_status') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'block');
    if (!gate.ok) return gate;
    const businessId = String(action.businessId || '').trim();
    if (!businessId) return { ok: false, code: 'VALIDATION', message: 'businessId obrigatório.' };
    const reason = String(action.reason || '').trim();
    if (action.status === 'suspended' && !reason) {
      return { ok: false, code: 'VALIDATION', message: 'Motivo obrigatório para suspender.' };
    }
    return mutatePlatformState((state) => {
      const idx = state.shops.findIndex((s) => s.businessId === businessId);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Loja não encontrada.' },
        };
      }
      const shop = state.shops[idx];
      const suspend = action.status === 'suspended';
      const next = {
        ...shop,
        suspended: suspend,
        suspendedAt: suspend ? new Date().toISOString() : undefined,
        suspendedReason: suspend ? reason || 'Suspensa pelo HQ' : undefined,
        updatedAt: new Date().toISOString(),
      };
      let nextState: PlatformState = {
        ...state,
        shops: state.shops.map((s, i) => (i === idx ? next : s)),
      };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: suspend ? 'shop.suspend' : 'shop.reactivate',
        entityType: 'shop',
        entityId: businessId,
        before: { suspended: !!shop.suspended },
        after: { suspended: suspend },
        reason,
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const, shop: next } };
    });
  }

  if (action.action === 'admin_list_staff') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'team');
    if (!gate.ok) return gate;
    return { ok: true, staff: staffDirectory(state) };
  }

  if (action.action === 'admin_set_staff_role') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'team');
    if (!gate.ok) return gate;
    const userId = String(action.userId || '').trim();
    const role = action.role === null ? null : normalizeRole(action.role);
    if (!userId) return { ok: false, code: 'VALIDATION', message: 'userId obrigatório.' };
    if (role !== null && !STAFF_ROLES.includes(role)) {
      return { ok: false, code: 'VALIDATION', message: 'Papel inválido.' };
    }
    return mutatePlatformState((state) => {
      let idx = state.users.findIndex((u) => u.id === userId);
      if (idx < 0 && userId.includes('@')) {
        idx = state.users.findIndex((u) => u.email === userId.toLowerCase());
      }
      if (idx < 0 && userId.startsWith('email:')) {
        idx = state.users.findIndex((u) => u.email === userId.slice(6).toLowerCase());
      }
      if (idx < 0) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'NOT_FOUND',
            message: 'Usuário não encontrado. Precisa criar conta antes.',
          },
        };
      }
      const target = state.users[idx];
      if (target.id === actor!.id && role !== 'ceo') {
        return {
          state,
          result: {
            ok: false as const,
            code: 'FORBIDDEN',
            message: 'Você não pode remover o próprio papel de Super Admin.',
          },
        };
      }
      const users = state.users.map((u, i) =>
        i === idx ? { ...u, platformRole: role as PlatformRole | null } : u
      );
      let nextState: PlatformState = { ...state, users };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'staff.set_role',
        entityType: 'user',
        entityId: users[idx].id,
        before: { platformRole: target.platformRole || null },
        after: { platformRole: role },
        result: 'success',
      });
      return {
        state: nextState,
        result: { ok: true as const, user: publicUser(users[idx]) },
      };
    });
  }

  if (action.action === 'admin_ticket_list') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    const tickets = [...(state.tickets || [])].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return { ok: true, tickets };
  }

  if (action.action === 'admin_ticket_update') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'edit');
    if (!gate.ok) return gate;
    const id = String(action.id || '').trim();
    if (!id) return { ok: false, code: 'VALIDATION', message: 'id obrigatório.' };
    return mutatePlatformState((state) => {
      const idx = state.tickets.findIndex((t) => t.id === id);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Ticket não encontrado.' },
        };
      }
      const prev = state.tickets[idx];
      const now = new Date().toISOString();
      const messages = [...(prev.messages || [])];
      const reply = String(action.reply || '').trim();
      if (reply) messages.push({ at: now, from: 'support' as const, text: reply });
      const next = {
        ...prev,
        status: action.status || prev.status,
        messages,
        updatedAt: now,
      };
      let nextState: PlatformState = {
        ...state,
        tickets: state.tickets.map((t, i) => (i === idx ? next : t)),
      };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'ticket.update',
        entityType: 'ticket',
        entityId: id,
        before: { status: prev.status },
        after: { status: next.status },
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const, ticket: next } };
    });
  }

  if (action.action === 'admin_claim_ceo') {
    const state0 = await loadPlatformState();
    const user = requireUser(state0, action.token);
    if (!user) return { ok: false, code: 'AUTH', message: 'Faça login na plataforma antes.' };
    const expected = process.env.SUPPORT_PIN?.trim();
    const pin = String(action.supportPin || '').trim();
    if (!expected || !pin || pin !== expected) {
      return { ok: false, code: 'AUTH', message: 'PIN de suporte inválido.' };
    }
    return mutatePlatformState((state) => {
      const idx = state.users.findIndex((u) => u.id === user!.id);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Usuário não encontrado.' },
        };
      }
      const users = state.users.map((u, i) =>
        i === idx ? { ...u, platformRole: 'ceo' as const } : u
      );
      let nextState: PlatformState = { ...state, users };
      nextState = appendAuditLog(nextState, {
        ...auditActor(user!),
        action: 'staff.claim_ceo',
        entityType: 'user',
        entityId: user!.id,
        after: { platformRole: 'ceo' },
        reason: 'SUPPORT_PIN',
        result: 'success',
      });
      return {
        state: nextState,
        result: { ok: true as const, user: publicUser(users[idx]) },
      };
    });
  }

  if (action.action === 'admin_list_customers') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    return {
      ok: true,
      customers: buildCustomerRows(state, {
        q: action.q,
        city: action.city,
        blocked: action.blocked,
        limit: action.limit,
      }),
    };
  }

  if (action.action === 'admin_customer_detail') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    const detail = buildCustomerDetail(state, action.userId);
    if (!detail) return { ok: false, code: 'NOT_FOUND', message: 'Cliente não encontrado.' };
    return { ok: true, ...detail };
  }

  if (action.action === 'admin_set_user_block') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'block');
    if (!gate.ok) return gate;
    const userId = String(action.userId || '').trim();
    const reason = String(action.reason || '').trim();
    if (!userId) return { ok: false, code: 'VALIDATION', message: 'userId obrigatório.' };
    if (action.blocked && !reason) {
      return { ok: false, code: 'VALIDATION', message: 'Motivo obrigatório para bloquear.' };
    }
    return mutatePlatformState((state) => {
      const idx = state.users.findIndex((u) => u.id === userId);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Usuário não encontrado.' },
        };
      }
      if (isStaffRole(state.users[idx].platformRole)) {
        return {
          state,
          result: {
            ok: false as const,
            code: 'FORBIDDEN',
            message: 'Não bloqueie contas staff por esta ação.',
          },
        };
      }
      const prev = state.users[idx];
      const next = {
        ...prev,
        blocked: action.blocked,
        blockedReason: action.blocked ? reason : undefined,
        blockedAt: action.blocked ? new Date().toISOString() : undefined,
      };
      let nextState: PlatformState = {
        ...state,
        users: state.users.map((u, i) => (i === idx ? next : u)),
      };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: action.blocked ? 'user.block' : 'user.unblock',
        entityType: 'user',
        entityId: userId,
        before: { blocked: !!prev.blocked },
        after: { blocked: action.blocked },
        reason,
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const, user: publicUser(next) } };
    });
  }

  if (action.action === 'admin_audit_list') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'audit');
    if (!gate.ok) return gate;
    const q = String(action.q || '')
      .trim()
      .toLowerCase();
    const limit = Math.min(Math.max(action.limit || 100, 1), 500);
    let logs = state.auditLogs || [];
    if (action.entityType) {
      logs = logs.filter((l) => l.entityType === action.entityType);
    }
    if (q) {
      logs = logs.filter((l) =>
        [l.action, l.actorEmail, l.entityId, l.reason, l.entityType].join(' ').toLowerCase().includes(q)
      );
    }
    return { ok: true, logs: logs.slice(0, limit) };
  }

  if (action.action === 'admin_finance_overview') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'financial');
    if (!gate.ok) return gate;
    return {
      ok: true,
      finance: buildFinanceOverview(
        state,
        action.sinceDays || 30,
        (action as any).hqMode === 'projection' ? 'projection' : 'real'
      ),
    };
  }

  if (action.action === 'admin_ledger_list') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'financial');
    if (!gate.ok) return gate;
    const limit = Math.min(Math.max(action.limit || 100, 1), 500);
    let ledger = [...(state.ledger || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (action.ownerType) ledger = ledger.filter((e) => e.ownerType === action.ownerType);
    if (action.ownerId) ledger = ledger.filter((e) => e.ownerId === action.ownerId);
    return {
      ok: true,
      ledger: ledger.slice(0, limit),
      balances: {
        platform: ledgerBalanceFor(state.ledger || [], 'platform', 'pecaja'),
      },
    };
  }

  if (action.action === 'admin_ledger_adjust') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'financial');
    if (!gate.ok) return gate;
    const reason = String(action.reason || '').trim();
    const note = String(action.note || '').trim();
    const amount = Number(action.amount);
    if (!reason || reason.length < 3) {
      return { ok: false, code: 'VALIDATION', message: 'Motivo obrigatório.' };
    }
    if (!Number.isFinite(amount) || amount === 0) {
      return { ok: false, code: 'VALIDATION', message: 'Valor inválido.' };
    }
    let mirrored: {
      id: string;
      ownerType: typeof action.ownerType;
      ownerId: string;
      kind: typeof action.kind;
      amount: number;
      note: string;
      createdAt: string;
      actorUserId: string;
    } | null = null;
    const out = await mutatePlatformState((state) => {
      const entry = {
        id: newId('led'),
        ownerType: action.ownerType,
        ownerId: action.ownerId,
        kind: action.kind,
        amount: Math.abs(amount),
        note: note || reason,
        createdAt: new Date().toISOString(),
        actorUserId: actor!.id,
      };
      mirrored = entry;
      let nextState: PlatformState = {
        ...state,
        ledger: [entry, ...(state.ledger || [])],
      };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'ledger.adjust',
        entityType: 'ledger',
        entityId: entry.id,
        after: {
          ownerType: entry.ownerType,
          ownerId: entry.ownerId,
          kind: entry.kind,
          amount: entry.amount,
        },
        reason,
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const, entry } };
    });
    if (out?.ok && mirrored) await dualWriteLedgerSafe(mirrored);
    return out;
  }

  if (action.action === 'admin_list_applications') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'crm');
    if (!gate.ok) return gate;
    let apps = [...(state.applications || [])];
    if (action.role) apps = apps.filter((a) => a.role === action.role);
    if (action.status) apps = apps.filter((a) => a.status === action.status);
    apps.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { ok: true, applications: apps.slice(0, 300) };
  }

  if (action.action === 'admin_upsert_application') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'crm');
    if (!gate.ok) return gate;
    const input = action.application;
    let mirrored: PartnerApplicationRecord | null = null;
    const out = await mutatePlatformState((state) => {
      const now = new Date().toISOString();
      const id = input.id || newId('app');
      const idx = (state.applications || []).findIndex((a) => a.id === id);
      const base: PartnerApplicationRecord = {
        id,
        role: input.role,
        status: input.status || 'pending',
        pipelineStage: input.pipelineStage,
        city: input.city,
        name: input.name,
        email: input.email,
        phone: input.phone,
        businessName: input.businessName,
        document: input.document,
        notes: input.notes,
        ownerUserId: input.ownerUserId,
        assigneeUserId: input.assigneeUserId,
        followUpAt: input.followUpAt,
        tags: input.tags,
        timeline: input.timeline || [],
        createdAt: idx >= 0 ? state.applications[idx].createdAt : now,
        updatedAt: now,
        raw: input.raw,
      };
      const applications =
        idx >= 0
          ? state.applications.map((a, i) => (i === idx ? { ...a, ...base } : a))
          : [base, ...(state.applications || [])];
      let nextState: PlatformState = { ...state, applications };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'application.upsert',
        entityType: 'application',
        entityId: id,
        after: { status: base.status, role: base.role },
        result: 'success',
      });
      mirrored = base;
      return { state: nextState, result: { ok: true as const, application: base } };
    });
    if (out?.ok && mirrored) await dualWriteApplicationSafe(mirrored);
    return out;
  }

  if (action.action === 'admin_set_application_status') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'crm');
    if (!gate.ok) return gate;
    let mirrored: PartnerApplicationRecord | null = null;
    const out = await mutatePlatformState((state) => {
      const idx = (state.applications || []).findIndex((a) => a.id === action.id);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Aplicação não encontrada.' },
        };
      }
      const prev = state.applications[idx];
      const now = new Date().toISOString();
      const next = {
        ...prev,
        status: action.status,
        pipelineStage: action.pipelineStage || prev.pipelineStage,
        updatedAt: now,
        timeline: [
          ...(prev.timeline || []),
          {
            at: now,
            text: `Status → ${action.status}${action.reason ? `: ${action.reason}` : ''}`,
            actorId: actor!.id,
          },
        ],
      };
      let nextState: PlatformState = {
        ...state,
        applications: state.applications.map((a, i) => (i === idx ? next : a)),
      };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'application.set_status',
        entityType: 'application',
        entityId: action.id,
        before: { status: prev.status },
        after: { status: next.status },
        reason: action.reason,
        result: 'success',
      });
      mirrored = next;
      return { state: nextState, result: { ok: true as const, application: next } };
    });
    if (out?.ok && mirrored) await dualWriteApplicationSafe(mirrored);
    return out;
  }

  if (action.action === 'sync_partner_application') {
    const app = action.application;
    if (!app?.id || !app.role || !app.email) {
      return { ok: false, code: 'VALIDATION', message: 'application inválida.' };
    }
    return mutatePlatformState((state) => {
      const idx = (state.applications || []).findIndex((a) => a.id === app.id);
      const now = new Date().toISOString();
      const next = {
        ...app,
        updatedAt: now,
        createdAt: idx >= 0 ? state.applications[idx].createdAt : app.createdAt || now,
      };
      const applications =
        idx >= 0
          ? state.applications.map((a, i) => (i === idx ? { ...a, ...next } : a))
          : [next, ...(state.applications || [])];
      return {
        state: { ...state, applications },
        result: { ok: true as const, application: next },
      };
    });
  }

  if (action.action === 'admin_list_cities') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    return { ok: true, cities: state.cities || [] };
  }

  if (action.action === 'admin_upsert_city') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'config');
    if (!gate.ok) return gate;
    const input = action.city;
    let mirrored: PlatformCity | null = null;
    const out = await mutatePlatformState((state) => {
      const now = new Date().toISOString();
      const id = input.id || newId('city');
      const idx = (state.cities || []).findIndex((c) => c.id === id);
      const city: PlatformCity = {
        id,
        name: input.name,
        state: input.state,
        status: input.status || 'implanting',
        latitude: input.latitude,
        longitude: input.longitude,
        serviceRadiusKm: input.serviceRadiusKm,
        createdAt: idx >= 0 ? state.cities[idx].createdAt : now,
        updatedAt: now,
      };
      const cities =
        idx >= 0 ? state.cities.map((c, i) => (i === idx ? city : c)) : [city, ...(state.cities || [])];
      let nextState: PlatformState = { ...state, cities };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'city.upsert',
        entityType: 'city',
        entityId: id,
        after: { name: city.name, status: city.status },
        result: 'success',
      });
      mirrored = city;
      return { state: nextState, result: { ok: true as const, city } };
    });
    if (out?.ok && mirrored) await dualWriteCitySafe(mirrored);
    return out;
  }

  if (action.action === 'admin_set_city_status') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'config');
    if (!gate.ok) return gate;
    const reason = String(action.reason || '').trim();
    if (action.status === 'inactive' && !reason) {
      return { ok: false, code: 'VALIDATION', message: 'Motivo obrigatório para desativar cidade.' };
    }
    let mirrored: PlatformCity | null = null;
    const out = await mutatePlatformState((state) => {
      const idx = (state.cities || []).findIndex((c) => c.id === action.id);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Cidade não encontrada.' },
        };
      }
      const prev = state.cities[idx];
      const next = { ...prev, status: action.status, updatedAt: new Date().toISOString() };
      let nextState: PlatformState = {
        ...state,
        cities: state.cities.map((c, i) => (i === idx ? next : c)),
      };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'city.set_status',
        entityType: 'city',
        entityId: action.id,
        before: { status: prev.status },
        after: { status: next.status },
        reason,
        result: 'success',
      });
      mirrored = next;
      return { state: nextState, result: { ok: true as const, city: next } };
    });
    if (out?.ok && mirrored) await dualWriteCitySafe(mirrored);
    return out;
  }

  if (action.action === 'admin_list_coupons') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'marketing_manage');
    if (!gate.ok) return gate;
    return { ok: true, coupons: state.coupons || [] };
  }

  if (action.action === 'admin_upsert_coupon') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'marketing_manage');
    if (!gate.ok) return gate;
    const input = action.coupon;
    return mutatePlatformState((state) => {
      const now = new Date().toISOString();
      const id = input.id || newId('cpn');
      const idx = (state.coupons || []).findIndex((c) => c.id === id || c.code === input.code);
      const coupon: PlatformCoupon = {
        id,
        code: String(input.code).toUpperCase().trim(),
        type: input.type,
        value: Number(input.value),
        cityId: input.cityId,
        active: input.active !== false,
        maxUses: input.maxUses,
        usedCount: idx >= 0 ? state.coupons[idx].usedCount : input.usedCount || 0,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdAt: idx >= 0 ? state.coupons[idx].createdAt : now,
        updatedAt: now,
        note: input.note,
      };
      const coupons =
        idx >= 0
          ? state.coupons.map((c, i) => (i === idx ? coupon : c))
          : [coupon, ...(state.coupons || [])];
      let nextState: PlatformState = { ...state, coupons };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'coupon.upsert',
        entityType: 'coupon',
        entityId: id,
        after: { code: coupon.code, active: coupon.active },
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const, coupon } };
    });
  }

  if (action.action === 'admin_list_campaigns') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'marketing_manage');
    if (!gate.ok) return gate;
    return { ok: true, campaigns: state.campaigns || [] };
  }

  if (action.action === 'admin_upsert_campaign') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'marketing_manage');
    if (!gate.ok) return gate;
    const input = action.campaign;
    return mutatePlatformState((state) => {
      const now = new Date().toISOString();
      const id = input.id || newId('cmp');
      const idx = (state.campaigns || []).findIndex((c) => c.id === id);
      const campaign: PlatformCampaign = {
        id,
        name: input.name,
        channel: input.channel,
        segment: input.segment,
        status: input.status || 'draft',
        body: input.body,
        cityId: input.cityId,
        scheduledAt: input.scheduledAt,
        sentAt: input.sentAt,
        createdAt: idx >= 0 ? state.campaigns[idx].createdAt : now,
        updatedAt: now,
      };
      const campaigns =
        idx >= 0
          ? state.campaigns.map((c, i) => (i === idx ? campaign : c))
          : [campaign, ...(state.campaigns || [])];
      let nextState: PlatformState = { ...state, campaigns };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'campaign.upsert',
        entityType: 'campaign',
        entityId: id,
        after: { name: campaign.name, status: campaign.status },
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const, campaign } };
    });
  }

  if (action.action === 'admin_list_flags') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'flags');
    if (!gate.ok) return gate;
    return { ok: true, flags: state.featureFlags || [] };
  }

  if (action.action === 'admin_set_flag') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'flags');
    if (!gate.ok) return gate;
    const reason = String(action.reason || '').trim();
    if (!reason) return { ok: false, code: 'VALIDATION', message: 'Motivo obrigatório.' };
    return mutatePlatformState((state) => {
      const key = String(action.flag.key || '').trim();
      const idx = (state.featureFlags || []).findIndex((f) => f.key === key);
      const flag: FeatureFlag = {
        key,
        enabled: !!action.flag.enabled,
        scope: action.flag.scope || 'global',
        cityId: action.flag.cityId,
        percent: action.flag.percent,
        note: action.flag.note,
        updatedAt: new Date().toISOString(),
        updatedBy: actor!.id,
      };
      const featureFlags =
        idx >= 0
          ? state.featureFlags.map((f, i) => (i === idx ? flag : f))
          : [flag, ...(state.featureFlags || [])];
      let nextState: PlatformState = { ...state, featureFlags };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'flag.set',
        entityType: 'flag',
        entityId: key,
        before: idx >= 0 ? { enabled: state.featureFlags[idx].enabled } : null,
        after: { enabled: flag.enabled, scope: flag.scope },
        reason,
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const, flag } };
    });
  }

  if (action.action === 'admin_list_system_logs') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'audit');
    if (!gate.ok) return gate;
    let logs = state.systemLogs || [];
    if (action.level) logs = logs.filter((l) => l.level === action.level);
    if (action.service) logs = logs.filter((l) => l.service === action.service);
    return { ok: true, logs: logs.slice(0, action.limit || 200) };
  }

  if (action.action === 'admin_append_system_log') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requireStaffUser(actor, 'ops');
    if (!gate.ok) return gate;
    return mutatePlatformState((state) => {
      const entry = {
        id: action.entry.id || newId('slog'),
        level: action.entry.level,
        service: action.entry.service,
        message: String(action.entry.message || '').slice(0, 2000),
        meta: action.entry.meta,
        requestId: action.entry.requestId,
        createdAt: new Date().toISOString(),
      };
      const systemLogs = [entry, ...(state.systemLogs || [])].slice(0, 2000);
      return {
        state: { ...state, systemLogs },
        result: { ok: true as const, entry },
      };
    });
  }

  if (action.action === 'admin_list_incidents') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    return { ok: true, incidents: state.incidents || [] };
  }

  if (action.action === 'admin_upsert_incident') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'edit');
    if (!gate.ok) return gate;
    const input = action.incident;
    return mutatePlatformState((state) => {
      const now = new Date().toISOString();
      const id = input.id || newId('inc');
      const idx = (state.incidents || []).findIndex((i) => i.id === id);
      const incident: PlatformIncident = {
        id,
        title: input.title,
        severity: input.severity,
        service: input.service,
        status: input.status || 'open',
        impact: input.impact,
        cause: input.cause,
        solution: input.solution,
        ownerUserId: input.ownerUserId || actor!.id,
        startedAt: idx >= 0 ? state.incidents[idx].startedAt : input.startedAt || now,
        resolvedAt: input.resolvedAt,
        updatedAt: now,
      };
      const incidents =
        idx >= 0
          ? state.incidents.map((i, n) => (n === idx ? incident : i))
          : [incident, ...(state.incidents || [])];
      let nextState: PlatformState = { ...state, incidents };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'incident.upsert',
        entityType: 'incident',
        entityId: id,
        after: { status: incident.status, severity: incident.severity },
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const, incident } };
    });
  }

  if (action.action === 'admin_data_quality') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'audit');
    if (!gate.ok) return gate;
    return { ok: true, quality: buildDataQuality(state) };
  }

  if (action.action === 'admin_list_reviews') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    let reviews = state.reviews || [];
    if (typeof action.hidden === 'boolean') {
      reviews = reviews.filter((r) => !!r.hidden === action.hidden);
    }
    return { ok: true, reviews: reviews.slice(0, 200) };
  }

  if (action.action === 'admin_moderate_review') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'edit');
    if (!gate.ok) return gate;
    const reason = String(action.reason || '').trim();
    if (action.hidden && !reason) {
      return { ok: false, code: 'VALIDATION', message: 'Motivo obrigatório para ocultar.' };
    }
    return mutatePlatformState((state) => {
      const idx = (state.reviews || []).findIndex((r) => r.id === action.id);
      if (idx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Avaliação não encontrada.' },
        };
      }
      const prev = state.reviews[idx];
      const next = {
        ...prev,
        hidden: action.hidden,
        hiddenReason: action.hidden ? reason : undefined,
      };
      let nextState: PlatformState = {
        ...state,
        reviews: state.reviews.map((r, i) => (i === idx ? next : r)),
      };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: action.hidden ? 'review.hide' : 'review.unhide',
        entityType: 'review',
        entityId: action.id,
        reason,
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const, review: next } };
    });
  }

  if (action.action === 'admin_list_products') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    return {
      ok: true,
      products: buildProductRows(state, {
        q: action.q,
        businessId: action.businessId,
        limit: action.limit,
      }),
    };
  }

  if (action.action === 'admin_set_product_available') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'edit');
    if (!gate.ok) return gate;
    const reason = String(action.reason || '').trim();
    if (!reason) return { ok: false, code: 'VALIDATION', message: 'Motivo obrigatório.' };
    return mutatePlatformState((state) => {
      const sIdx = state.shops.findIndex((s) => s.businessId === action.businessId);
      if (sIdx < 0) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Loja não encontrada.' },
        };
      }
      const shop = state.shops[sIdx];
      const menu = (shop.menu || []).map((item) =>
        item.id === action.productId ? { ...item, available: action.available } : item
      );
      if (!(shop.menu || []).some((i) => i.id === action.productId)) {
        return {
          state,
          result: { ok: false as const, code: 'NOT_FOUND', message: 'Produto não encontrado.' },
        };
      }
      const shops = state.shops.map((s, i) =>
        i === sIdx ? { ...s, menu, updatedAt: new Date().toISOString() } : s
      );
      let nextState: PlatformState = { ...state, shops };
      nextState = appendAuditLog(nextState, {
        ...auditActor(actor!),
        action: 'product.set_available',
        entityType: 'product',
        entityId: `${action.businessId}:${action.productId}`,
        after: { available: action.available },
        reason,
        result: 'success',
      });
      return { state: nextState, result: { ok: true as const } };
    });
  }

  if (action.action === 'admin_export_audit') {
    const state = await loadAdminView(action);
    const actor = requireUser(state, action.token);
    const gate = requirePerm(actor, 'export');
    if (!gate.ok) return gate;
    const sinceDays = action.sinceDays || 30;
    let rows: unknown[] = [];
    if (action.kind === 'customers') rows = buildCustomerRows(state, { limit: 500 });
    if (action.kind === 'orders') rows = filterAdminOrders(state, { sinceDays });
    if (action.kind === 'ledger') rows = (state.ledger || []).slice(0, 500);
    if (action.kind === 'audit') rows = (state.auditLogs || []).slice(0, 500);
    await mutatePlatformState((st) => ({
      state: appendAuditLog(st, {
        ...auditActor(actor!),
        action: 'export',
        entityType: 'export',
        entityId: action.kind,
        after: { count: Array.isArray(rows) ? rows.length : 0, sinceDays },
        result: 'success',
      }),
      result: { ok: true as const },
    }));
    return { ok: true, kind: action.kind, rows };
  }

  if (action.action === 'admin_reports') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    return { ok: true, reports: buildReports(state, action.sinceDays || 30) };
  }

  if (action.action === 'admin_problems_now') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    const hqMode = action.hqMode === 'projection' ? 'projection' : 'real';
    const { detectLiveProblems, buildAttentionQueue } = await import('@/services/hqProblems');
    let { summary, problems } = detectLiveProblems(state, hqMode);
    if (action.severity) {
      problems = problems.filter((p) => p.severity === action.severity);
    }
    if (action.sla === 'breached') {
      problems = problems.filter((p) => p.slaBreached);
    }
    const attention = buildAttentionQueue(state, hqMode);
    return { ok: true, summary, problems, attention };
  }

  if (action.action === 'admin_problem_detail') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    const hqMode = action.hqMode === 'projection' ? 'projection' : 'real';
    const { detectLiveProblems } = await import('@/services/hqProblems');
    const { problems } = detectLiveProblems(state, hqMode);
    const problem = problems.find((p) => p.orderId === action.orderId);
    if (!problem) {
      return { ok: false, code: 'NOT_FOUND', message: 'Problema/pedido atrasado não encontrado.' };
    }
    const order = (state.orders || []).find((o) => o.id === action.orderId);
    return { ok: true, problem, order, timeline: problem.timeline };
  }

  if (action.action === 'admin_problem_action') {
    const state0 = await loadAdminView(action);
    const actor = requireUser(state0, action.token);
    const gate = requirePerm(actor, 'view');
    if (!gate.ok) return gate;
    const orderId = String(action.orderId || '').trim();
    const problemAction = String(action.problemAction || '').trim();
    if (!orderId || !problemAction) {
      return { ok: false, code: 'VALIDATION', message: 'orderId e problemAction obrigatórios.' };
    }
    const order = (state0.orders || []).find((o) => o.id === orderId);
    if (!order) return { ok: false, code: 'NOT_FOUND', message: 'Pedido não encontrado.' };

    const now = new Date().toISOString();
    const {
      detectLiveProblems,
      DELAY_CLASS_LABEL,
    } = await import('@/services/hqProblems');
    const hqMode = action.hqMode === 'projection' ? 'projection' : 'real';
    const live = detectLiveProblems(state0, hqMode).problems.find((p) => p.orderId === orderId);

    const result = await mutatePlatformState((state) => {
      const cases = Array.isArray(state.problemCases) ? [...state.problemCases] : [];
      let c = cases.find(
        (x) => x.orderId === orderId && x.status !== 'resolvido' && x.status !== 'cancelado'
      );
      if (!c) {
        c = {
          id: newId('prob'),
          orderId,
          status: 'novo',
          severity: live?.severity || 'media',
          delayClass: live?.delayClass || 'atraso_sem_causa',
          category: 'pedido_atrasado',
          createdAt: now,
          updatedAt: now,
          slaMinutes: live?.slaMinutes || 15,
          history: [
            {
              at: now,
              actorId: actor!.id,
              actorEmail: actor!.email,
              text: 'Caso aberto pela Central de Problemas',
              action: 'open',
            },
          ],
        };
        cases.unshift(c);
      }

      const pushHist = (text: string, act?: string) => {
        c!.history = [
          {
            at: now,
            actorId: actor!.id,
            actorEmail: actor!.email,
            text,
            action: act,
          },
          ...(c!.history || []),
        ].slice(0, 200);
        c!.updatedAt = now;
        if (!c!.firstActionAt) c!.firstActionAt = now;
      };

      let chats = { ...(state.chats || {}) };
      const appendChat = (peer: 'merchant' | 'driver', text: string) => {
        const key = `${orderId}::${peer}`;
        const prev = Array.isArray(chats[key]) ? [...chats[key]] : [];
        const msg = {
          id: newId('msg'),
          orderId,
          peer,
          sender: 'system',
          text,
          createdAt: now,
        };
        chats[key] = [...prev, msg];
      };

      if (problemAction === 'msg_comercio') {
        const text =
          (action.message || '').trim() ||
          `Olá, ${order.businessName}. O pedido #${orderId.slice(0, 10)} está com atraso. Confirme o status e a previsão, por favor.`;
        appendChat('merchant', text);
        c.status = 'aguardando_comercio';
        pushHist('Mensagem enviada ao comércio (chat do pedido)', 'msg_comercio');
      } else if (problemAction === 'msg_entregador') {
        const text =
          (action.message || '').trim() ||
          `Olá, ${order.driverName || 'entregador'}. O pedido #${orderId.slice(0, 10)} está com atraso. Confirme se está a caminho.`;
        appendChat('driver', text);
        c.status = 'aguardando_entregador';
        pushHist('Mensagem enviada ao entregador (chat do pedido)', 'msg_entregador');
      } else if (problemAction === 'msg_cliente') {
        const text =
          (action.message || '').trim() ||
          `Olá, ${order.customerName || 'cliente'}. Estamos acompanhando o atraso do pedido #${orderId.slice(0, 10)}.`;
        appendChat('merchant', text);
        appendChat('driver', text);
        c.status = 'aguardando_cliente';
        pushHist('Atualização registrada para o cliente (chat)', 'msg_cliente');
      } else if (problemAction === 'escalar') {
        c.status = 'escalado';
        c.severity = 'critica';
        pushHist(action.reason?.trim() || 'Problema escalado para operação', 'escalar');
      } else if (problemAction === 'registrar_ocorrencia') {
        const incidents = [...(state.incidents || [])];
        incidents.unshift({
          id: newId('inc'),
          title: `Problema pedido ${orderId.slice(0, 10)}`,
          severity: c.severity === 'critica' ? 'critical' : c.severity === 'alta' ? 'high' : 'medium',
          service: 'ops',
          status: 'open',
          impact: live?.probableCause || 'Atraso operacional',
          cause: DELAY_CLASS_LABEL[c.delayClass] || c.delayClass,
          ownerUserId: actor!.id,
          startedAt: now,
          updatedAt: now,
        });
        c.status = 'em_resolucao';
        pushHist('Ocorrência/incidente registrado', 'registrar_ocorrencia');
        const nextCases = cases.map((x) => (x.id === c!.id ? c! : x));
        let st: PlatformState = {
          ...state,
          chats,
          incidents,
          problemCases: nextCases,
        };
        st = appendAuditLog(st, {
          ...auditActor(actor!),
          action: 'problem.action',
          entityType: 'problem',
          entityId: c.id,
          after: { problemAction, orderId },
          reason: action.reason,
          result: 'success',
        });
        return { state: st, result: { ok: true as const, case: c, problemAction } };
      } else if (problemAction === 'resolver') {
        c.status = 'resolvido';
        c.resolvedAt = now;
        c.rootCause = action.rootCause || null;
        c.rootCauseNote = action.rootCauseNote || null;
        pushHist(
          `Problema encerrado${action.rootCause ? ` · causa: ${action.rootCause}` : ''}`,
          'resolver'
        );
      } else if (problemAction === 'silenciar') {
        const until = new Date(Date.now() + 30 * 60_000).toISOString();
        c.silencedUntil = until;
        pushHist('Problema silenciado por 30 min', 'silenciar');
      } else if (problemAction === 'ver_pedido' || problemAction === 'ver_localizacao') {
        c.status = c.status === 'novo' ? 'em_analise' : c.status;
        pushHist(
          problemAction === 'ver_localizacao' ? 'Operador abriu localização' : 'Operador abriu pedido',
          problemAction
        );
      } else {
        return {
          state,
          result: {
            ok: false as const,
            code: 'VALIDATION',
            message: `Ação não suportada: ${problemAction}`,
          },
        };
      }

      const nextCases = cases.map((x) => (x.id === c!.id ? c! : x));
      let st: PlatformState = { ...state, chats, problemCases: nextCases };
      st = appendAuditLog(st, {
        ...auditActor(actor!),
        action: 'problem.action',
        entityType: 'problem',
        entityId: c.id,
        after: { problemAction, orderId, status: c.status },
        reason: action.reason || action.rootCause,
        result: 'success',
      });
      return {
        state: st,
        result: {
          ok: true as const,
          case: c,
          problemAction,
          location:
            problemAction === 'ver_localizacao'
              ? {
                  deliveryLatitude: order.deliveryLatitude,
                  deliveryLongitude: order.deliveryLongitude,
                  businessLatitude: order.businessLatitude,
                  businessLongitude: order.businessLongitude,
                }
              : undefined,
        },
      };
    });

    return result;
  }

  if (action.action === 'admin_intelligence') {
    const state = await loadAdminView(action);
    const user = requireUser(state, action.token);
    const gate = requirePerm(user, 'view');
    if (!gate.ok) return gate;
    const hqMode = action.hqMode === 'projection' ? 'projection' : 'real';
    const days = Math.min(365, Math.max(1, Number(action.sinceDays) || 30));
    const { buildIntelligence } = await import('@/services/hqIntelligence');
    const intelligence = buildIntelligence(state, hqMode, days);
    return { ok: true, intelligence };
  }

  return { ok: false, code: 'UNKNOWN', message: `Ação admin não reconhecida: ${a}` };
}
