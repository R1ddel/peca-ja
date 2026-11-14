/**
 * Projeção Peça Já — Ano 2 (escala empresa nacional).
 * Overlay de KPIs + seed de entidades para o Command Center.
 */
import type { PlatformState } from '@/services/platformTypes';

export const HQ_PROJ_PREFIX = 'proj2y_';
export const HQ_PROJ_FLAG = 'hq_projection_2y';

/** Metas operacionais / financeiras da projeção (como se já estivesse rodando). */
export const HQ_YEAR2 = {
  label: 'Projeção Ano 2 · escala nacional',
  today: {
    count: 34820,
    paidCount: 33210,
    gmv: 2_847_620,
    platformFee: 341_714,
    delivered: 28940,
    canceled: 412,
    inProgress: 1840,
  },
  yesterday: {
    count: 33105,
    paidCount: 31680,
    gmv: 2_691_440,
    platformFee: 322_973,
    delivered: 27410,
    canceled: 388,
    inProgress: 0,
  },
  week7d: {
    count: 228_450,
    paidCount: 218_900,
    gmv: 18_654_800,
    platformFee: 2_238_576,
    delivered: 201_200,
    canceled: 2_640,
    inProgress: 1840,
  },
  month30d: {
    count: 982_400,
    paidCount: 941_100,
    gmv: 79_420_500,
    platformFee: 9_530_460,
    delivered: 868_200,
    canceled: 11_080,
    inProgress: 1840,
  },
  shopsActive: 8420,
  shopsSuspended: 186,
  shopsTotal: 9180,
  openTickets: 186,
  usersTotal: 2_840_000,
  usersBlocked: 1240,
  usersNewToday: 4820,
  usersNew7d: 31_600,
  usersNew30d: 128_400,
  pendingMerchants: 340,
  pendingDrivers: 890,
  citiesActive: 186,
  citiesImplanting: 24,
  citiesTotal: 220,
  openIncidents: 3,
  finance: {
    refunds: 412_800,
    withdrawals: 4_280_500,
    platformBalance: 18_420_600,
  },
  /** Série 7d (GMV diário e pedidos) — curva de alta temporada. */
  series7d: {
    labels: ['seg 10', 'ter 11', 'qua 12', 'qui 13', 'sex 14', 'sáb 15', 'dom 16'],
    orders: [29800, 31240, 32110, 33450, 36200, 38900, 34820],
    gmv: [2_410_200, 2_528_800, 2_601_400, 2_712_100, 2_980_500, 3_214_800, 2_847_620],
  },
  ops: {
    activeCount: 1840,
    delayedCount: 47,
    awaitingDriverCount: 128,
    byStatus: {
      pendente: 312,
      confirmado: 268,
      preparando: 540,
      pronto: 186,
      saiu_entrega: 534,
    },
  },
  financePeriod: {
    7: {
      ordersCount: 228_450,
      paidCount: 218_900,
      canceledCount: 2_640,
      gmv: 18_654_800,
      platformFee: 2_238_576,
      merchantNet: 14_820_100,
      withdrawals: 980_400,
      ledgerCredits: 16_210_000,
      ledgerDebits: 5_120_000,
    },
    30: {
      ordersCount: 982_400,
      paidCount: 941_100,
      canceledCount: 11_080,
      gmv: 79_420_500,
      platformFee: 9_530_460,
      merchantNet: 62_840_200,
      withdrawals: 4_280_500,
      ledgerCredits: 68_400_000,
      ledgerDebits: 22_100_000,
    },
    90: {
      ordersCount: 2_680_000,
      paidCount: 2_560_000,
      canceledCount: 31_200,
      gmv: 214_800_000,
      platformFee: 25_776_000,
      merchantNet: 169_200_000,
      withdrawals: 11_420_000,
      ledgerCredits: 182_000_000,
      ledgerDebits: 58_400_000,
    },
  },
  seriesFinance14d: {
    labels: [
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
    ],
    gmv: [
      2_180_000, 2_240_500, 2_310_200, 2_285_000, 2_410_200, 2_528_800, 2_601_400, 2_712_100,
      2_890_000, 2_980_500, 3_050_200, 3_214_800, 2_980_100, 2_847_620,
    ],
    platformFee: [
      261_600, 268_860, 277_224, 274_200, 289_224, 303_456, 312_168, 325_452, 346_800, 357_660,
      366_024, 385_776, 357_612, 341_714,
    ],
  },
  fleetOnline: 12840,
  fleetTotal: 18620,
  /** Metas do cenário de planejamento (só no modo PROJEÇÃO). */
  targets: {
    todayOrders: 32_000,
    todayGmv: 2_600_000,
    todayPlatformFee: 310_000,
    weekOrders: 210_000,
    weekGmv: 17_000_000,
    monthOrders: 900_000,
    monthGmv: 72_000_000,
  },
} as const;

/** @deprecated Preferir modo explícito via hqMode no client. Mantido p/ seed/boot. */
export function isHqProjectionActive(state: PlatformState): boolean {
  return (
    process.env.PLATFORM_HQ_PROJECTION === '1' ||
    process.env.PLATFORM_HQ_PROJECTION === 'true' ||
    !!(state.featureFlags || []).find((f) => f.key === HQ_PROJ_FLAG && f.enabled) ||
    (state.orders || []).some((o) => String(o.id || '').startsWith(HQ_PROJ_PREFIX))
  );
}

export function stripProjectionEntities<T extends { id?: string }>(rows: T[]): T[] {
  return (rows || []).filter((r) => !String(r.id || '').startsWith(HQ_PROJ_PREFIX));
}

export function stripProjectionShops(shops: PlatformState['shops']): PlatformState['shops'] {
  return (shops || []).filter((s) => !String(s.businessId || '').startsWith(HQ_PROJ_PREFIX));
}

export function stripProjectionUsers(users: PlatformState['users']): PlatformState['users'] {
  return (users || []).filter((u) => !String(u.id || '').startsWith(HQ_PROJ_PREFIX));
}
