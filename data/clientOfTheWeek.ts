import { CommunityMember } from '@/data/community';
import { Order } from '@/types';

export type WeeklyReward = {
  id: string;
  title: string;
  tagline: string;
  perks: string[];
  bonusPoints: number;
};

/** Prêmio do Cliente da Semana — quem mais pediu na semana. */
export const WEEKLY_REWARD: WeeklyReward = {
  id: 'cliente-semana',
  title: 'Coroa da Semana',
  tagline: 'Quem mais pediu esta semana leva o trono',
  perks: ['1 frete grátis', '+80 pts no clube', 'Selo dourado no perfil por 7 dias'],
  bonusPoints: 80,
};

export type WeeklyContender = {
  memberId: string;
  name: string;
  photoUrl: string;
  city: string;
  /** Uso interno para ranking — não exibir na UI pública. */
  weeklyOrders: number;
  rank: number;
  isCurrentUser?: boolean;
};

export type ClientOfTheWeekState = {
  weekLabel: string;
  weekKey: string;
  endsAt: Date;
  champion: WeeklyContender | null;
  podium: WeeklyContender[];
  yourRank: number | null;
  reward: WeeklyReward;
};

/** Segunda-feira 00:00 da semana atual (local). */
export function getWeekStart(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekEnd(date = new Date()): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

export function getWeekKey(date = new Date()): string {
  const start = getWeekStart(date);
  const y = start.getFullYear();
  const oneJan = new Date(y, 0, 1);
  const week = Math.ceil(((start.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

export function formatWeekLabel(date = new Date()): string {
  const start = getWeekStart(date);
  const end = new Date(getWeekEnd(date));
  end.setDate(end.getDate() - 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Contagem estável por membro/semana (mock da comunidade). */
function mockWeeklyOrders(memberId: string, weekKey: string, baseOrders: number): number {
  let hash = 0;
  const seed = `${memberId}:${weekKey}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const wave = (hash % 7) + 1;
  const loyaltyBoost = Math.min(6, Math.floor(baseOrders / 12));
  return wave + loyaltyBoost;
}

export function countUserOrdersThisWeek(orders: Order[], userId?: string): number {
  const start = getWeekStart().getTime();
  const end = getWeekEnd().getTime();
  return orders.filter((o) => {
    if (userId && o.userId !== userId) return false;
    if (o.status === 'cancelado') return false;
    const t = new Date(o.createdAt).getTime();
    return t >= start && t < end;
  }).length;
}

/**
 * Monta o ranking semanal (pedidos da semana).
 * A UI pública deve mostrar só posição/nomes — nunca a contagem.
 */
export function buildClientOfTheWeek(
  members: CommunityMember[],
  userWeeklyOrders: number
): ClientOfTheWeekState {
  const weekKey = getWeekKey();
  const weekLabel = formatWeekLabel();
  const endsAt = getWeekEnd();

  const scored: WeeklyContender[] = members.map((m) => {
    const weeklyOrders = m.isCurrentUser
      ? userWeeklyOrders
      : mockWeeklyOrders(m.id, weekKey, m.ordersCount);

    return {
      memberId: m.id,
      name: m.name,
      photoUrl: m.photoUrl,
      city: m.city,
      weeklyOrders,
      rank: 0,
      isCurrentUser: m.isCurrentUser,
    };
  });

  scored.sort((a, b) => {
    if (b.weeklyOrders !== a.weeklyOrders) return b.weeklyOrders - a.weeklyOrders;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  scored.forEach((c, i) => {
    c.rank = i + 1;
  });

  const podium = scored.slice(0, 3);
  const champion = podium[0] ?? null;
  const you = scored.find((c) => c.isCurrentUser);

  return {
    weekLabel,
    weekKey,
    endsAt,
    champion,
    podium,
    yourRank: you?.rank ?? null,
    reward: WEEKLY_REWARD,
  };
}

export function getCountdownParts(endsAt: Date, now = new Date()) {
  const ms = Math.max(0, endsAt.getTime() - now.getTime());
  const totalHours = Math.floor(ms / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((ms % 3600000) / 60000);
  return { days, hours, minutes, ms };
}

export function rankHint(rank: number | null, isChampion: boolean): string {
  if (isChampion) return 'Você reina esta semana. Coroa colocada.';
  if (rank == null) return 'Faça um pedido e entre na disputa.';
  if (rank === 2) return 'Você é o vice — um pedido a mais pode virar o jogo.';
  if (rank === 3) return 'No pódio! Continua pedindo pra subir.';
  if (rank <= 5) return 'Quase no top 3. A comunidade tá de olho.';
  return 'A disputa tá aberta. Cada pedido conta.';
}
