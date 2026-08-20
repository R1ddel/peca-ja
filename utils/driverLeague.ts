/**
 * Liga semanal dos entregadores — ranking por desempenho (não por clique).
 * Pontos: entregas + frete + bônus de agilidade.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '@/types';
import { DriverApplication } from '@/utils/partners';
import {
  driverEarningsOf,
  driverFleetId,
  listDriverHistory,
} from '@/utils/driverOps';
import {
  loadReviewsFromStorage,
  sumDriverRatingPenalties,
} from '@/utils/driverRatingPenalty';

const APPS_KEY = '@pecaja_partner_applications';

export const LEAGUE_MILESTONES = [
  { pts: 30, label: 'Bronze', reward: 'Selo Bronze da semana' },
  { pts: 80, label: 'Prata', reward: 'Selo Prata + destaque no painel' },
  { pts: 150, label: 'Ouro', reward: 'Selo Ouro · prioridade simbólica' },
  { pts: 250, label: 'Lenda', reward: 'Lenda da semana · topo do pódio' },
] as const;

export type LeagueEntry = {
  fleetId: string;
  applicationId: string;
  name: string;
  vehicle: string;
  deliveries: number;
  earnings: number;
  fastDeliveries: number;
  activeDays: number;
  /** Pontos brutos (antes de avaliações). */
  grossPoints: number;
  /** Desconto por avaliações ruins do cliente. */
  ratingPenalty: number;
  points: number;
  rank: number;
};

export type LeagueSnapshot = {
  weekLabel: string;
  weekStartIso: string;
  weekEndIso: string;
  daysLeft: number;
  entries: LeagueEntry[];
  me: LeagueEntry | null;
  nextMilestone: (typeof LEAGUE_MILESTONES)[number] | null;
  milestoneProgress: number; // 0..1 toward next
  motivational: string;
};

/** Segunda-feira 00:00 local da semana atual. */
export function getWeekBounds(now = new Date()): {
  start: Date;
  end: Date;
  label: string;
  daysLeft: number;
} {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay(); // 0=dom
  const diffToMon = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMon);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setMilliseconds(-1);

  const msLeft = Math.max(0, end.getTime() - now.getTime());
  const daysLeft = Math.max(1, Math.ceil(msLeft / 86_400_000));

  const label = `${start.getDate().toString().padStart(2, '0')}/${(start.getMonth() + 1)
    .toString()
    .padStart(2, '0')} – ${end.getDate().toString().padStart(2, '0')}/${(end.getMonth() + 1)
    .toString()
    .padStart(2, '0')}`;

  return { start, end, label, daysLeft };
}

function inWeek(iso: string, start: Date, end: Date): boolean {
  const t = +new Date(iso);
  return t >= +start && t <= +end;
}

function isFastDelivery(order: Order): boolean {
  const ready = order.kitchenReadyAt || order.pickupVerifiedAt;
  const done = order.deliveryVerifiedAt || order.updatedAt;
  if (!ready || !done) return false;
  const mins = (+new Date(done) - +new Date(ready)) / 60_000;
  return mins > 0 && mins <= 55;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function scoreDriverWeek(
  orders: Order[],
  fleetId: string,
  start: Date,
  end: Date,
  ratingPenalty = 0
): Omit<LeagueEntry, 'fleetId' | 'applicationId' | 'name' | 'vehicle' | 'rank'> {
  const delivered = listDriverHistory(orders, fleetId).filter(
    (o) =>
      o.status === 'entregue' &&
      inWeek(o.deliveryVerifiedAt || o.updatedAt, start, end)
  );

  const deliveries = delivered.length;
  const earnings = delivered.reduce((s, o) => s + driverEarningsOf(o), 0);
  const fastDeliveries = delivered.filter(isFastDelivery).length;
  const activeDays = new Set(
    delivered.map((o) => dayKey(o.deliveryVerifiedAt || o.updatedAt))
  ).size;

  const grossPoints =
    deliveries * 12 +
    Math.round(earnings) * 1 +
    fastDeliveries * 8 +
    activeDays * 5;

  const penalty = Math.max(0, Math.round(ratingPenalty));
  const points = Math.max(0, grossPoints - penalty);

  return {
    deliveries,
    earnings,
    fastDeliveries,
    activeDays,
    grossPoints,
    ratingPenalty: penalty,
    points,
  };
}

function firstName(full: string): string {
  return (full || 'Motoboy').trim().split(/\s+/)[0] || 'Motoboy';
}

async function loadApprovedDrivers(): Promise<DriverApplication[]> {
  try {
    const raw = await AsyncStorage.getItem(APPS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (a: DriverApplication) =>
        a?.role === 'driver' &&
        a.status === 'approved' &&
        a.termsStatus === 'accepted'
    );
  } catch {
    return [];
  }
}

function pickMotivational(me: LeagueEntry | null, daysLeft: number): string {
  if (!me || me.points === 0) {
    return 'Faça sua 1ª entrega da semana e entre no ranking.';
  }
  if (me.rank === 1) {
    return daysLeft <= 2
      ? 'Você lidera! Segura o 1º lugar até domingo.'
      : 'Manta de líder — continue no ritmo.';
  }
  if (me.rank <= 3) {
    return 'Pódio à vista. Mais algumas entregas e você sobe.';
  }
  return 'Cada entrega conta. Suba no ranking até o fim da semana.';
}

export function nextMilestoneFor(points: number): {
  next: (typeof LEAGUE_MILESTONES)[number] | null;
  progress: number;
} {
  const next = LEAGUE_MILESTONES.find((m) => points < m.pts) ?? null;
  if (!next) return { next: null, progress: 1 };
  const prevPts =
    [...LEAGUE_MILESTONES].reverse().find((m) => m.pts <= points)?.pts ?? 0;
  const span = next.pts - prevPts;
  const progress = span <= 0 ? 1 : Math.min(1, (points - prevPts) / span);
  return { next, progress };
}

/**
 * Monta o snapshot da liga semanal (ranking real dos aprovados no aparelho).
 */
export async function buildLeagueSnapshot(
  orders: Order[],
  myFleetId: string | null
): Promise<LeagueSnapshot> {
  const { start, end, label, daysLeft } = getWeekBounds();
  const drivers = await loadApprovedDrivers();
  const reviews = await loadReviewsFromStorage();

  const scored: LeagueEntry[] = drivers.map((app) => {
    const fleetId = driverFleetId(app);
    const penalty = sumDriverRatingPenalties(reviews, fleetId, start, end);
    const stats = scoreDriverWeek(orders, fleetId, start, end, penalty);
    return {
      fleetId,
      applicationId: app.id,
      name: firstName(app.name),
      vehicle: app.vehicle || 'moto',
      ...stats,
      rank: 0,
    };
  });

  if (myFleetId && !scored.some((e) => e.fleetId === myFleetId)) {
    const penalty = sumDriverRatingPenalties(reviews, myFleetId, start, end);
    const stats = scoreDriverWeek(orders, myFleetId, start, end, penalty);
    scored.push({
      fleetId: myFleetId,
      applicationId: myFleetId,
      name: 'Você',
      vehicle: 'moto',
      ...stats,
      rank: 0,
    });
  }

  scored.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.deliveries !== a.deliveries) return b.deliveries - a.deliveries;
    return b.earnings - a.earnings;
  });
  scored.forEach((e, i) => {
    e.rank = i + 1;
  });

  const me = myFleetId
    ? scored.find((e) => e.fleetId === myFleetId) ?? null
    : null;
  const { next, progress } = nextMilestoneFor(me?.points ?? 0);

  return {
    weekLabel: label,
    weekStartIso: start.toISOString(),
    weekEndIso: end.toISOString(),
    daysLeft,
    entries: scored,
    me,
    nextMilestone: next,
    milestoneProgress: progress,
    motivational: pickMotivational(me, daysLeft),
  };
}

/** Entregas da semana do motoboy (atalho). */
export function countMyWeekDeliveries(
  orders: Order[],
  fleetId: string
): number {
  const { start, end } = getWeekBounds();
  return scoreDriverWeek(orders, fleetId, start, end).deliveries;
}
