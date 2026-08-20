import { Order } from '@/types';

export type LoyaltyTier = 'bronze' | 'prata' | 'ouro' | 'diamante';

export const LOYALTY_TIERS: Record<
  LoyaltyTier,
  { label: string; minPoints: number; color: string; icon: string; perk: string }
> = {
  bronze: {
    label: 'Bronze',
    minPoints: 0,
    color: '#CD7F32',
    icon: 'medal-outline',
    perk: 'Acesso ao clube Peça Já',
  },
  prata: {
    label: 'Prata',
    minPoints: 100,
    color: '#94A3B8',
    icon: 'ribbon-outline',
    perk: '5% de cashback em pontos',
  },
  ouro: {
    label: 'Ouro',
    minPoints: 300,
    color: '#F59E0B',
    icon: 'trophy-outline',
    perk: 'Frete com desconto especial',
  },
  diamante: {
    label: 'Diamante',
    minPoints: 600,
    color: '#38BDF8',
    icon: 'diamond-outline',
    perk: 'Prioridade + recompensas exclusivas',
  },
};

export type RewardDef = {
  id: string;
  title: string;
  description: string;
  cost: number;
  icon: string;
};

export const REWARDS: RewardDef[] = [
  {
    id: 'frete',
    title: 'Frete grátis',
    description: 'Válido no próximo pedido acima de R$ 25',
    cost: 50,
    icon: 'bicycle-outline',
  },
  {
    id: 'desconto10',
    title: '10% de desconto',
    description: 'Cupom no subtotal (máx. R$ 15)',
    cost: 120,
    icon: 'pricetag-outline',
  },
  {
    id: 'combo',
    title: 'Combo surpresa',
    description: 'Um mimo da casa no próximo pedido',
    cost: 200,
    icon: 'gift-outline',
  },
  {
    id: 'upgrade',
    title: 'Dia VIP',
    description: 'Prioridade na fila por 24h',
    cost: 280,
    icon: 'sparkles-outline',
  },
];

export function getDeliveredOrders(orders: Order[]) {
  return orders.filter((o) => o.status === 'entregue');
}

export function calcPointsFromOrders(orders: Order[]) {
  return Math.floor(
    getDeliveredOrders(orders).reduce((sum, o) => sum + o.total, 0)
  );
}

export function getTierForPoints(points: number): LoyaltyTier {
  if (points >= 600) return 'diamante';
  if (points >= 300) return 'ouro';
  if (points >= 100) return 'prata';
  return 'bronze';
}

export function getNextTier(points: number): { tier: LoyaltyTier; needed: number } | null {
  if (points < 100) return { tier: 'prata', needed: 100 - points };
  if (points < 300) return { tier: 'ouro', needed: 300 - points };
  if (points < 600) return { tier: 'diamante', needed: 600 - points };
  return null;
}

export function getProgressToNext(points: number): number {
  const next = getNextTier(points);
  if (!next) return 1;
  const currentMin = LOYALTY_TIERS[getTierForPoints(points)].minPoints;
  const nextMin = LOYALTY_TIERS[next.tier].minPoints;
  return Math.min(1, (points - currentMin) / (nextMin - currentMin));
}

export function getFavoriteBusiness(orders: Order[]) {
  const delivered = getDeliveredOrders(orders);
  if (delivered.length === 0) return null;

  const map = new Map<
    string,
    { id: string; name: string; image: string; count: number; spent: number }
  >();
  for (const o of delivered) {
    const prev = map.get(o.businessId) ?? {
      id: o.businessId,
      name: o.businessName,
      image: o.businessImage,
      count: 0,
      spent: 0,
    };
    prev.count += 1;
    prev.spent += o.total;
    map.set(o.businessId, prev);
  }

  return [...map.values()].sort((a, b) => b.count - a.count || b.spent - a.spent)[0] ?? null;
}

export function buildLoyalLeaderboard(userName: string, userPoints: number) {
  const peers = [
    { id: 'c-ana', name: 'Ana Souza', points: 820 },
    { id: 'c-carlos', name: 'Carlos Lima', points: 640 },
    { id: 'c-marina', name: 'Marina Costa', points: 410 },
    { id: 'c-joao', name: 'João Pedro', points: 275 },
    { id: 'c-livia', name: 'Lívia Rocha', points: 150 },
  ];

  const withUser = [
    ...peers.map((p) => ({ ...p, isYou: false as const })),
    { id: 'me', name: userName || 'Você', points: userPoints, isYou: true as const },
  ].sort((a, b) => b.points - a.points);

  return withUser.slice(0, 5).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}
