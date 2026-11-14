/**
 * Cada cupom vale uma vez por cliente. Depois do uso, não aplica de novo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pecaja_coupon_uses_v1';

type Store = Record<string, string[]>;

async function readStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function couponUseKey(input: {
  merchantPromoId?: string | null;
  code?: string | null;
}): string {
  const id = (input.merchantPromoId || '').trim();
  if (id) return `promo:${id}`;
  const code = (input.code || '').trim().toUpperCase();
  return code ? `code:${code}` : '';
}

export async function loadUsedCouponKeys(userId: string): Promise<string[]> {
  if (!userId) return [];
  const store = await readStore();
  const list = store[userId];
  return Array.isArray(list) ? list.filter((k) => typeof k === 'string') : [];
}

export async function markCouponUsed(userId: string, useKey: string): Promise<void> {
  if (!userId || !useKey) return;
  const store = await readStore();
  const prev = Array.isArray(store[userId]) ? store[userId] : [];
  if (prev.includes(useKey)) return;
  store[userId] = [...prev, useKey].slice(-200);
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}
