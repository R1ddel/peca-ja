/**
 * Promoções / cupons / frete grátis criados pelo comerciante.
 * O custo sai do bolso da loja (desconto e frete absorvidos no split).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pecaja_merchant_promos_v1';

export type MerchantPromoType = 'percent' | 'fixed' | 'free_delivery';

export type MerchantPromo = {
  id: string;
  businessId: string;
  applicationId: string;
  title: string;
  type: MerchantPromoType;
  /** percent: 0–100; fixed: R$; free_delivery: 0 */
  value: number;
  maxDiscount?: number;
  minSubtotal: number;
  /**
   * Código que o cliente digita.
   * Vazio/null = promoção automática no checkout da loja.
   */
  code: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MerchantPromoInput = {
  businessId: string;
  applicationId: string;
  title: string;
  type: MerchantPromoType;
  value: number;
  maxDiscount?: number;
  minSubtotal?: number;
  code?: string | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  maxRedemptions?: number | null;
};

async function loadAll(): Promise<MerchantPromo[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(list: MerchantPromo[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function promoTypeLabel(type: MerchantPromoType): string {
  if (type === 'free_delivery') return 'Frete grátis';
  if (type === 'percent') return 'Desconto %';
  return 'Desconto R$';
}

export function formatPromoSummary(p: MerchantPromo): string {
  if (p.type === 'free_delivery') {
    return p.minSubtotal > 0
      ? `Frete grátis a partir de R$ ${p.minSubtotal.toFixed(2).replace('.', ',')}`
      : 'Frete grátis';
  }
  if (p.type === 'percent') {
    const cap =
      p.maxDiscount != null
        ? ` (máx. R$ ${p.maxDiscount.toFixed(2).replace('.', ',')})`
        : '';
    return `${p.value}% off${cap}`;
  }
  return `R$ ${p.value.toFixed(2).replace('.', ',')} off`;
}

function isWithinWindow(p: MerchantPromo, now = Date.now()): boolean {
  if (p.startsAt) {
    const t = Date.parse(p.startsAt);
    if (Number.isFinite(t) && now < t) return false;
  }
  if (p.endsAt) {
    const t = Date.parse(p.endsAt);
    if (Number.isFinite(t) && now > t) return false;
  }
  return true;
}

export function isPromoRedeemable(p: MerchantPromo, now = Date.now()): boolean {
  if (!p.active) return false;
  if (!isWithinWindow(p, now)) return false;
  if (p.maxRedemptions != null && p.redemptionCount >= p.maxRedemptions) return false;
  return true;
}

export async function listPromosByBusiness(businessId: string): Promise<MerchantPromo[]> {
  const list = await loadAll();
  return list
    .filter((p) => p.businessId === businessId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listPromosByApplication(
  applicationId: string
): Promise<MerchantPromo[]> {
  const list = await loadAll();
  return list
    .filter((p) => p.applicationId === applicationId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPromoById(id: string): Promise<MerchantPromo | null> {
  const list = await loadAll();
  return list.find((p) => p.id === id) ?? null;
}

export async function upsertPromo(
  input: MerchantPromoInput & { id?: string }
): Promise<MerchantPromo> {
  const list = await loadAll();
  const now = new Date().toISOString();
  const code = input.code ? normalizePromoCode(input.code) : null;

  if (code) {
    const clash = list.find(
      (p) =>
        p.businessId === input.businessId &&
        p.code === code &&
        p.id !== input.id
    );
    if (clash) {
      throw new Error('Já existe um cupom com este código nesta loja.');
    }
  }

  if (input.id) {
    const idx = list.findIndex((p) => p.id === input.id);
    if (idx < 0) throw new Error('Promoção não encontrada.');
    const prev = list[idx];
    const next: MerchantPromo = {
      ...prev,
      title: input.title.trim() || prev.title,
      type: input.type,
      value: input.type === 'free_delivery' ? 0 : Math.max(0, input.value),
      maxDiscount: input.maxDiscount,
      minSubtotal: Math.max(0, input.minSubtotal ?? 0),
      code,
      active: input.active ?? prev.active,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      updatedAt: now,
    };
    list[idx] = next;
    await saveAll(list);
    return next;
  }

  const created: MerchantPromo = {
    id: `mpromo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    businessId: input.businessId,
    applicationId: input.applicationId,
    title: input.title.trim() || 'Promoção',
    type: input.type,
    value: input.type === 'free_delivery' ? 0 : Math.max(0, input.value),
    maxDiscount: input.maxDiscount,
    minSubtotal: Math.max(0, input.minSubtotal ?? 0),
    code,
    active: input.active ?? true,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    maxRedemptions: input.maxRedemptions ?? null,
    redemptionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  list.unshift(created);
  await saveAll(list);
  return created;
}

export async function setPromoActive(
  id: string,
  active: boolean
): Promise<MerchantPromo | null> {
  const list = await loadAll();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  list[idx] = {
    ...list[idx],
    active,
    updatedAt: new Date().toISOString(),
  };
  await saveAll(list);
  return list[idx];
}

export async function deletePromo(id: string): Promise<boolean> {
  const list = await loadAll();
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  await saveAll(next);
  return true;
}

export async function recordPromoRedemption(id: string): Promise<void> {
  const list = await loadAll();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return;
  list[idx] = {
    ...list[idx],
    redemptionCount: list[idx].redemptionCount + 1,
    updatedAt: new Date().toISOString(),
  };
  await saveAll(list);
}

/** Melhor promoção automática ativa da loja para o subtotal. */
export function pickAutoPromo(
  promos: MerchantPromo[],
  subtotal: number
): MerchantPromo | null {
  const eligible = promos.filter(
    (p) =>
      isPromoRedeemable(p) &&
      !p.code &&
      subtotal >= (p.minSubtotal ?? 0)
  );
  if (!eligible.length) return null;

  // Prioridade: frete grátis > maior desconto estimado
  const free = eligible.find((p) => p.type === 'free_delivery');
  if (free) return free;

  let best: MerchantPromo | null = null;
  let bestValue = -1;
  for (const p of eligible) {
    let v = 0;
    if (p.type === 'percent') {
      v = (subtotal * p.value) / 100;
      if (p.maxDiscount != null) v = Math.min(v, p.maxDiscount);
    } else if (p.type === 'fixed') {
      v = Math.min(p.value, subtotal);
    }
    if (v > bestValue) {
      bestValue = v;
      best = p;
    }
  }
  return best;
}

export function findMerchantCoupon(
  promos: MerchantPromo[],
  code: string
): MerchantPromo | null {
  const normalized = normalizePromoCode(code);
  if (!normalized) return null;
  return (
    promos.find(
      (p) =>
        isPromoRedeemable(p) &&
        p.code === normalized
    ) ?? null
  );
}
