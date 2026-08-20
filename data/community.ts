import { LoyaltyTier, getTierForPoints } from '@/constants/loyalty';

export type CommunityMember = {
  id: string;
  name: string;
  city: string;
  bio: string;
  photoUrl: string;
  points: number;
  ordersCount: number;
  memberSince: string;
  favoriteCategory: string;
  badges: string[];
  isCurrentUser?: boolean;
};

const u = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&h=400&q=80`;

/** Membros da comunidade (mock local + espaço para o usuário logado). */
export const COMMUNITY_MEMBERS: CommunityMember[] = [
  {
    id: 'c-ana',
    name: 'Ana Souza',
    city: 'São Paulo, SP',
    bio: 'Amo pedir comida caseira depois do trampo. Peça Já virou rotina.',
    photoUrl: u('photo-1494790108377-be9c29b29330'),
    points: 820,
    ordersCount: 64,
    memberSince: '2024-03',
    favoriteCategory: 'Restaurantes',
    badges: ['Top Fiel', 'Exploradora', 'Noite Owl'],
  },
  {
    id: 'c-carlos',
    name: 'Carlos Lima',
    city: 'Campinas, SP',
    bio: 'Churrasco, cerveja gelada e mercado no fim de semana.',
    photoUrl: u('photo-1507003211169-0a1dd7228f2d'),
    points: 640,
    ordersCount: 51,
    memberSince: '2024-05',
    favoriteCategory: 'Distribuidoras',
    badges: ['Rei do Frete', 'Top Fiel'],
  },
  {
    id: 'c-marina',
    name: 'Marina Costa',
    city: 'Santos, SP',
    bio: 'Sempre de olho nas farmácias 24h e nos combos saudáveis.',
    photoUrl: u('photo-1438761681033-6461ffad8d80'),
    points: 410,
    ordersCount: 33,
    memberSince: '2024-08',
    favoriteCategory: 'Farmácias',
    badges: ['Cuidadora', 'Early Bird'],
  },
  {
    id: 'c-joao',
    name: 'João Pedro',
    city: 'Guarulhos, SP',
    bio: 'Pizza sexta, padaria domingo. Simples assim.',
    photoUrl: u('photo-1500648767791-00dcc994a43e'),
    points: 275,
    ordersCount: 22,
    memberSince: '2024-11',
    favoriteCategory: 'Padarias',
    badges: ['Pizzaiolo Amador'],
  },
  {
    id: 'c-livia',
    name: 'Lívia Rocha',
    city: 'Osasco, SP',
    bio: 'Descobrindo novos mercados perto de casa.',
    photoUrl: u('photo-1544005313-94ddf0286df2'),
    points: 150,
    ordersCount: 12,
    memberSince: '2025-01',
    favoriteCategory: 'Mercados',
    badges: ['Novata Promissora'],
  },
  {
    id: 'c-rafa',
    name: 'Rafael Nunes',
    city: 'São Bernardo, SP',
    bio: 'Delivery pra quando a preguiça vence. Sem julgamento.',
    photoUrl: u('photo-1472099645785-5658abf4ff4e'),
    points: 520,
    ordersCount: 41,
    memberSince: '2024-06',
    favoriteCategory: 'Restaurantes',
    badges: ['Fã de Burger', 'Top Fiel'],
  },
  {
    id: 'c-bia',
    name: 'Beatriz Mendes',
    city: 'Santo André, SP',
    bio: 'Sucos, bowls e tudo que for verde. Quase.',
    photoUrl: u('photo-1534528741775-53994a69daeb'),
    points: 360,
    ordersCount: 28,
    memberSince: '2024-09',
    favoriteCategory: 'Restaurantes',
    badges: ['Fit Mode', 'Avaliação 5★'],
  },
  {
    id: 'c-diego',
    name: 'Diego Alves',
    city: 'Barueri, SP',
    bio: 'Conveniência 24h salvou minha madrugada mais de uma vez.',
    photoUrl: u('photo-1519345182560-3f2917c472ef'),
    points: 190,
    ordersCount: 17,
    memberSince: '2025-02',
    favoriteCategory: 'Conveniência',
    badges: ['Madrugador'],
  },
];

export function getMemberTier(member: CommunityMember): LoyaltyTier {
  return getTierForPoints(member.points);
}

export function getCommunityMemberById(id: string): CommunityMember | undefined {
  return COMMUNITY_MEMBERS.find((m) => m.id === id);
}

export function buildCommunityFeed(currentUser?: {
  id: string;
  name: string;
  photoUrl?: string | null;
  points: number;
  ordersCount: number;
  city?: string;
  bio?: string | null;
}): CommunityMember[] {
  const others = [...COMMUNITY_MEMBERS].sort((a, b) => b.points - a.points);

  if (!currentUser) return others;

  const me: CommunityMember = {
    id: `me-${currentUser.id}`,
    name: currentUser.name,
    city: currentUser.city ?? 'Sua cidade',
    bio:
      currentUser.bio?.trim() ||
      'Esse é o seu perfil público na comunidade Peça Já. Conte um pouco sobre você!',
    photoUrl: currentUser.photoUrl || '',
    points: currentUser.points,
    ordersCount: currentUser.ordersCount,
    memberSince: new Date().toISOString().slice(0, 7),
    favoriteCategory: 'Variado',
    badges: ['Você'],
    isCurrentUser: true,
  };

  return [me, ...others].sort((a, b) => b.points - a.points);
}
