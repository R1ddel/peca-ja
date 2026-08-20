/**
 * Impacto da avaliação do cliente na Liga do entregador.
 * Desconto justo: nota baixa come pontos ganhos naquela entrega.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BusinessReview } from '@/types';

const REVIEWS_KEY = '@pecaja_reviews';

/** Pontos descontados por estrela do entregador (por avaliação). */
export function leaguePenaltyForDriverRating(rating: number): number {
  switch (rating) {
    case 5:
      return 0;
    case 4:
      return 3; // leve — quase neutro
    case 3:
      return 8; // mediano — ~⅔ de uma entrega
    case 2:
      return 15; // ruim — mais que 1 entrega
    case 1:
      return 22; // péssimo — ~2 entregas
    default:
      return 0;
  }
}

export function penaltyLabel(rating: number): string {
  const p = leaguePenaltyForDriverRating(rating);
  if (p <= 0) return 'Sem desconto na Liga';
  return `−${p} pts na Liga do entregador`;
}

/** Soma de descontos da semana para um fleetId. */
export function sumDriverRatingPenalties(
  reviews: BusinessReview[],
  fleetId: string,
  weekStart: Date,
  weekEnd: Date
): number {
  let total = 0;
  for (const r of reviews) {
    if (!r.driverId || r.driverId !== fleetId) continue;
    if (typeof r.driverRating !== 'number') continue;
    const t = +new Date(r.createdAt);
    if (t < +weekStart || t > +weekEnd) continue;
    total += leaguePenaltyForDriverRating(r.driverRating);
  }
  return total;
}

export async function loadReviewsFromStorage(): Promise<BusinessReview[]> {
  try {
    const raw = await AsyncStorage.getItem(REVIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
