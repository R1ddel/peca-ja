/**
 * Modo de dados do Peça Já HQ: REAL vs PROJEÇÃO (nunca misturar).
 */
import type { PlatformState } from '@/services/platformTypes';
import {
  HQ_PROJ_FLAG,
  HQ_PROJ_PREFIX,
  stripProjectionEntities,
  stripProjectionShops,
  stripProjectionUsers,
} from '@/services/hqProjection';

export type HqDataMode = 'real' | 'projection';

export function normalizeHqMode(raw: unknown): HqDataMode {
  return raw === 'projection' ? 'projection' : 'real';
}

/** Há payload/flag de planejamento disponível (não implica usar no dashboard). */
export function isProjectionAvailable(state: PlatformState): boolean {
  if (
    process.env.PLATFORM_HQ_PROJECTION === '1' ||
    process.env.PLATFORM_HQ_PROJECTION === 'true'
  ) {
    return true;
  }
  const flag = (state.featureFlags || []).find((f) => f.key === HQ_PROJ_FLAG);
  if (flag?.enabled) return true;
  return (state.orders || []).some((o) => String(o.id || '').startsWith(HQ_PROJ_PREFIX));
}

/** Estado filtrado para agregações do modo REAL (remove entidades proj2y_*). */
export function filterStateForMode(state: PlatformState, mode: HqDataMode): PlatformState {
  if (mode === 'projection') return state;
  return {
    ...state,
    orders: stripProjectionEntities(state.orders as { id?: string }[]) as PlatformState['orders'],
    shops: stripProjectionShops(state.shops),
    users: stripProjectionUsers(state.users),
    ledger: stripProjectionEntities(state.ledger),
    tickets: stripProjectionEntities(state.tickets),
    applications: stripProjectionEntities(state.applications),
    cities: stripProjectionEntities(state.cities),
    coupons: stripProjectionEntities(state.coupons),
    campaigns: stripProjectionEntities(state.campaigns),
    reviews: stripProjectionEntities(state.reviews),
    incidents: stripProjectionEntities(state.incidents),
    systemLogs: stripProjectionEntities(state.systemLogs),
    auditLogs: stripProjectionEntities(state.auditLogs),
  };
}

export function hqEnvironmentLabel(mode: HqDataMode): string {
  return mode === 'projection'
    ? 'AMBIENTE DE PLANEJAMENTO — DADOS PROJETADOS'
    : 'OPERAÇÃO EM TEMPO REAL';
}
