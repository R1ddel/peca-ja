/**
 * Avisos de cupom da loja. O cliente só vê a oferta e o código.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBusinessById } from '@/data/businesses';
import { couponUseKey, loadUsedCouponKeys } from '@/utils/couponUses';
import {
  formatPromoSummary,
  listRedeemablePromos,
  type MerchantPromo,
} from '@/utils/merchantPromos';

const SEEN_KEY = '@pecaja_coupon_notices_seen_v1';

export type CouponNotice = {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  summary: string;
  code: string | null;
  updatedAt: string;
};

async function readSeen(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function promoToNotice(promo: MerchantPromo): CouponNotice {
  const shop = getBusinessById(promo.businessId);
  return {
    id: promo.id,
    businessId: promo.businessId,
    businessName: shop?.name || 'Loja',
    title: promo.title,
    summary: formatPromoSummary(promo),
    code: promo.code,
    updatedAt: promo.updatedAt,
  };
}

export async function listCouponNotices(userId?: string | null): Promise<CouponNotice[]> {
  const promos = await listRedeemablePromos();
  let notices = promos.map(promoToNotice);
  if (userId) {
    const used = new Set(await loadUsedCouponKeys(userId));
    notices = notices.filter(
      (notice) => !used.has(couponUseKey({ merchantPromoId: notice.id, code: notice.code }))
    );
  }
  return notices;
}

export async function unseenCouponNoticeCount(userId?: string | null): Promise<number> {
  const [notices, seen] = await Promise.all([listCouponNotices(userId), readSeen()]);
  const seenSet = new Set(seen);
  return notices.filter((n) => !seenSet.has(n.id)).length;
}

export async function markCouponNoticesSeen(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const seen = await readSeen();
  const next = Array.from(new Set([...ids, ...seen])).slice(0, 400);
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next));
}
