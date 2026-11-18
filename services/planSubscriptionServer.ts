/**
 * Assinatura mensal do comerciante — cobrança direta na conta Mercado Pago
 * da plataforma (MP_ACCESS_TOKEN), sem marketplace/split de pedido.
 *
 * Pedidos continuam no fluxo de gateway/split. Planos NÃO.
 */
import type { MerchantPlan } from '@/constants/plans';
import { MERCHANT_PLANS } from '@/constants/plans';
import { loadPlatformState, mutatePlatformState } from '@/services/platformStore';
import type { PlanPaymentRecord, PlatformState } from '@/services/platformTypes';
import { dualWritePlanPaymentSafe } from '@/services/relLedgerStore';

/** Mesmo prazo do onboarding local (utils/partners). */
const PLAN_BILLING_DAYS = 30;

export type PlanPaymentMethod = 'pix' | 'card';
export type PlanPaymentStatus = PlanPaymentRecord['status'];
export type { PlanPaymentRecord };

const MAX_PLAN_PAYMENTS = 400;

export function isMerchantPlan(value: unknown): value is MerchantPlan {
  return value === 'essencial' || value === 'crescimento' || value === 'destaque';
}

/** Extrai applicationId de external_reference `plan_<appId>_<ts>`. */
export function parsePlanApplicationId(externalRef: unknown): string | null {
  const ref = String(externalRef || '').trim();
  if (!ref.startsWith('plan_')) return null;
  const rest = ref.slice('plan_'.length);
  const lastUnderscore = rest.lastIndexOf('_');
  if (lastUnderscore <= 0) return null;
  const maybeTs = rest.slice(lastUnderscore + 1);
  if (!/^\d{10,}$/.test(maybeTs)) return null;
  const appId = rest.slice(0, lastUnderscore).trim();
  return appId || null;
}

function withPlanPayments(
  state: PlatformState,
  list: PlanPaymentRecord[]
): PlatformState {
  const trimmed =
    list.length > MAX_PLAN_PAYMENTS ? list.slice(list.length - MAX_PLAN_PAYMENTS) : list;
  return { ...state, planPayments: trimmed };
}

function extendPlanPaidUntil(fromIso?: string | null): string {
  const now = new Date();
  const current = fromIso ? new Date(fromIso) : null;
  const base =
    current && !Number.isNaN(current.getTime()) && current.getTime() > now.getTime()
      ? current
      : now;
  const until = new Date(base);
  until.setDate(until.getDate() + PLAN_BILLING_DAYS);
  return until.toISOString();
}

export async function registerPlanPayment(input: {
  mpPaymentId: string;
  applicationId: string;
  plan: MerchantPlan;
  amount: number;
  method: PlanPaymentMethod;
  externalReference: string;
  ownerUserId?: string;
  businessName?: string;
  status?: PlanPaymentStatus;
  paidAt?: string;
}): Promise<PlanPaymentRecord> {
  const id = String(input.mpPaymentId).trim();
  const applicationId = String(input.applicationId).trim();
  if (!id || !applicationId) {
    throw new Error('registerPlanPayment: id/applicationId obrigatórios');
  }

  const next = await mutatePlatformState((state) => {
    const list = [...(state.planPayments || [])];
    const idx = list.findIndex((p) => p.id === id);
    const now = new Date().toISOString();
    const row: PlanPaymentRecord = {
      id,
      applicationId,
      plan: input.plan,
      amount: Number(input.amount) || MERCHANT_PLANS[input.plan].monthlyPrice,
      method: input.method,
      status: input.status || 'pending',
      externalReference: input.externalReference,
      createdAt: idx >= 0 ? list[idx].createdAt : now,
      paidAt: input.paidAt || (input.status === 'paid' ? now : list[idx]?.paidAt),
      ownerUserId: input.ownerUserId || list[idx]?.ownerUserId,
      businessName: input.businessName || list[idx]?.businessName,
    };
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.push(row);
    return {
      state: withPlanPayments(state, list),
      result: row,
    };
  });
  await dualWritePlanPaymentSafe(next);
  return next;
}

/**
 * Marca cobrança de plano como paga e espelha vigência no cadastro/loja da plataforma.
 */
export async function confirmPlanPaymentFromMp(input: {
  mpPaymentId: string;
  applicationId?: string | null;
  plan?: MerchantPlan | null;
  amount?: number;
  method?: PlanPaymentMethod;
  externalReference?: string | null;
  businessName?: string;
  paidAt?: string;
}): Promise<{ ok: boolean; payment?: PlanPaymentRecord; alreadyPaid?: boolean }> {
  const id = String(input.mpPaymentId).trim();
  if (!id) return { ok: false };

  return mutatePlatformState((state) => {
    const list = [...(state.planPayments || [])];
    const idx = list.findIndex((p) => p.id === id);
    const appId =
      String(input.applicationId || '').trim() ||
      (idx >= 0 ? list[idx].applicationId : '') ||
      parsePlanApplicationId(input.externalReference) ||
      '';
    if (!appId) {
      return { state, result: { ok: false as const } };
    }

    const plan: MerchantPlan =
      input.plan && isMerchantPlan(input.plan)
        ? input.plan
        : idx >= 0 && isMerchantPlan(list[idx].plan)
          ? list[idx].plan
          : 'essencial';

    const now = input.paidAt || new Date().toISOString();
    if (idx >= 0 && list[idx].status === 'paid') {
      return {
        state,
        result: { ok: true as const, payment: list[idx], alreadyPaid: true as const },
      };
    }

    const next: PlanPaymentRecord = {
      id,
      applicationId: appId,
      plan,
      amount:
        Number(input.amount) ||
        (idx >= 0 ? list[idx].amount : 0) ||
        MERCHANT_PLANS[plan].monthlyPrice,
      method: input.method || (idx >= 0 ? list[idx].method : 'pix'),
      status: 'paid',
      externalReference:
        String(input.externalReference || '').trim() ||
        (idx >= 0 ? list[idx].externalReference : `plan_${appId}`),
      createdAt: idx >= 0 ? list[idx].createdAt : now,
      paidAt: now,
      ownerUserId: idx >= 0 ? list[idx].ownerUserId : undefined,
      businessName:
        input.businessName || (idx >= 0 ? list[idx].businessName : undefined),
    };

    if (idx >= 0) list[idx] = next;
    else list.push(next);

    let applications = state.applications || [];
    const appIdx = applications.findIndex((a) => a.id === appId && a.role === 'merchant');
    if (appIdx >= 0) {
      const raw = { ...(applications[appIdx].raw || {}) };
      const prevUntil = typeof raw.planPaidUntil === 'string' ? raw.planPaidUntil : null;
      raw.paymentStatus = 'paid';
      raw.paymentId = id;
      raw.paymentPaidAt = now;
      raw.paymentAmount = next.amount;
      raw.paymentMethod = next.method;
      raw.plan = plan;
      raw.planPaidUntil = extendPlanPaidUntil(prevUntil);
      applications = applications.map((a, i) =>
        i === appIdx
          ? {
              ...a,
              status: a.status === 'rejected' ? a.status : 'registered',
              updatedAt: now,
              raw,
            }
          : a
      );
    }

    let shops = state.shops || [];
    const shopIdx = shops.findIndex(
      (s: any) =>
        s?.applicationId === appId ||
        s?.ownerApplicationId === appId ||
        s?.id === appId
    );
    if (shopIdx >= 0) {
      const shop: any = shops[shopIdx];
      const prevUntil = typeof shop.planPaidUntil === 'string' ? shop.planPaidUntil : null;
      shops = shops.map((s, i) =>
        i === shopIdx
          ? {
              ...shop,
              plan,
              planPaidUntil: extendPlanPaidUntil(prevUntil),
              updatedAt: now,
            }
          : s
      );
    }

    return {
      state: {
        ...withPlanPayments(state, list),
        applications,
        shops,
      },
      result: { ok: true as const, payment: next },
    };
  });
}

export async function findLatestPaidPlanPayment(
  applicationId: string
): Promise<PlanPaymentRecord | null> {
  const id = String(applicationId || '').trim();
  if (!id) return null;
  const state = await loadPlatformState();
  const list = (state.planPayments || [])
    .filter((p) => p.applicationId === id && p.status === 'paid')
    .sort((a, b) =>
      String(b.paidAt || b.createdAt).localeCompare(String(a.paidAt || a.createdAt))
    );
  return list[0] || null;
}

export async function findPlanPaymentByMpId(
  mpPaymentId: string
): Promise<PlanPaymentRecord | null> {
  const id = String(mpPaymentId || '').trim();
  if (!id) return null;
  const state = await loadPlatformState();
  return (state.planPayments || []).find((p) => p.id === id) || null;
}
