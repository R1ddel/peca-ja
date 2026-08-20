/**
 * Benefícios resgatados no clube (aplicados no carrinho/checkout).
 * Persistidos localmente — trocar por API quando houver backend.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const REWARDS_STORAGE_KEY = '@pecaja_claimed_rewards';
export const BONUS_POINTS_KEY = '@pecaja_bonus_points';
export const ACTIVE_BENEFITS_KEY = '@pecaja_active_benefits';

export type ActiveBenefits = {
  /** Frete grátis no próximo pedido (subtotal >= 25). */
  freeDelivery?: boolean;
  /** 10% no subtotal, máx. R$ 15. */
  discount10?: boolean;
  /** Origem para UI (ex.: "reward:frete", "cotw"). */
  sources?: string[];
};

export type RewardsStore = {
  claimed: string[];
  spentPoints: number;
};

export async function loadRewardsStore(): Promise<RewardsStore> {
  try {
    const raw = await AsyncStorage.getItem(REWARDS_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return {
      claimed: Array.isArray(data.claimed) ? data.claimed : [],
      spentPoints: typeof data.spentPoints === 'number' ? data.spentPoints : 0,
    };
  } catch {
    return { claimed: [], spentPoints: 0 };
  }
}

export async function saveRewardsStore(store: RewardsStore): Promise<void> {
  await AsyncStorage.setItem(REWARDS_STORAGE_KEY, JSON.stringify(store));
}

export async function loadBonusPoints(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BONUS_POINTS_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

export async function addBonusPoints(amount: number): Promise<number> {
  const current = await loadBonusPoints();
  const next = current + Math.max(0, amount);
  await AsyncStorage.setItem(BONUS_POINTS_KEY, String(next));
  return next;
}

export async function loadActiveBenefits(): Promise<ActiveBenefits> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_BENEFITS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveActiveBenefits(benefits: ActiveBenefits): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_BENEFITS_KEY, JSON.stringify(benefits));
}

/** Ativa benefício ao resgatar recompensa do clube. */
export async function activateRewardBenefit(rewardId: string): Promise<ActiveBenefits> {
  const current = await loadActiveBenefits();
  const sources = [...(current.sources ?? [])];
  const next: ActiveBenefits = { ...current, sources };

  if (rewardId === 'frete') {
    next.freeDelivery = true;
    if (!sources.includes('reward:frete')) sources.push('reward:frete');
  }
  if (rewardId === 'desconto10') {
    next.discount10 = true;
    if (!sources.includes('reward:desconto10')) sources.push('reward:desconto10');
  }
  // combo / upgrade: cosméticos por enquanto (sem efeito financeiro local)
  next.sources = sources;
  await saveActiveBenefits(next);
  return next;
}

/** Frete grátis + pts do Cliente da Semana. */
export async function activateClientOfTheWeekPerks(bonusPoints: number): Promise<void> {
  await addBonusPoints(bonusPoints);
  const current = await loadActiveBenefits();
  const sources = [...(current.sources ?? [])];
  if (!sources.includes('cotw')) sources.push('cotw');
  await saveActiveBenefits({
    ...current,
    freeDelivery: true,
    sources,
  });
}

export type PricedCheckout = {
  deliveryFee: number;
  discount: number;
  total: number;
  freeDeliveryApplied: boolean;
  discountApplied: boolean;
  /** Taxa Peça Já somada no total do cliente (não descontada da loja). */
  platformFee?: number;
};

/** Aplica benefícios ativos nos valores do checkout. */
export function applyBenefitsToTotals(
  subtotal: number,
  baseDeliveryFee: number,
  benefits: ActiveBenefits,
  platformFee = 0
): PricedCheckout {
  const freeDeliveryApplied = !!benefits.freeDelivery && subtotal >= 25;
  const deliveryFee = freeDeliveryApplied ? 0 : baseDeliveryFee;

  let discount = 0;
  const discountApplied = !!benefits.discount10 && subtotal > 0;
  if (discountApplied) {
    discount = Math.min(15, Math.round(subtotal * 0.1 * 100) / 100);
  }

  const fee = Math.max(0, platformFee);
  const total = Math.max(
    0,
    Math.round((subtotal - discount + deliveryFee + fee) * 100) / 100
  );

  return {
    deliveryFee,
    discount,
    total,
    freeDeliveryApplied,
    discountApplied,
    platformFee: fee,
  };
}

/** Consome benefícios usados após pedido pago/criado. */
export async function consumeUsedBenefits(used: {
  freeDelivery?: boolean;
  discount10?: boolean;
}): Promise<void> {
  const current = await loadActiveBenefits();
  const next: ActiveBenefits = { ...current, sources: [...(current.sources ?? [])] };

  if (used.freeDelivery) {
    next.freeDelivery = false;
    next.sources = (next.sources ?? []).filter((s) => s !== 'reward:frete' && s !== 'cotw');
  }
  if (used.discount10) {
    next.discount10 = false;
    next.sources = (next.sources ?? []).filter((s) => s !== 'reward:desconto10');
  }

  await saveActiveBenefits(next);
}
