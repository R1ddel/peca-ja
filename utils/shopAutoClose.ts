/**
 * Fecha a loja automaticamente após o horário da grade semanal.
 */
import { WeeklyHours, WeekdayKey, parseHoursToWeekly } from '@/utils/weeklyHours';
import { MerchantShop } from '@/utils/merchantShop';

const JS_TO_KEY: WeekdayKey[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function parseHm(hm: string): number | null {
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** true se o horário atual está dentro do expediente de hoje. */
export function isWithinWeeklyHours(
  weekly: WeeklyHours,
  now = new Date()
): boolean {
  const key = JS_TO_KEY[now.getDay()];
  const day = weekly[key];
  if (!day || day.closed) return false;
  const open = parseHm(day.open);
  const close = parseHm(day.close);
  if (open == null || close == null) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  if (close > open) {
    return mins >= open && mins < close;
  }
  // Cruza meia-noite (ex.: 18:00–02:00)
  return mins >= open || mins < close;
}

export function resolveShopWeeklyHours(shop: MerchantShop): WeeklyHours {
  if (shop.weeklyHours) return shop.weeklyHours;
  return parseHoursToWeekly(shop.hours);
}

/** Loja marcada aberta mas fora do horário → deve fechar. */
export function shouldAutoCloseShop(shop: MerchantShop, now = new Date()): boolean {
  if (!shop.isOpen) return false;
  return !isWithinWeeklyHours(resolveShopWeeklyHours(shop), now);
}

export function todayAutoCloseKey(businessId: string, now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `@pecaja_autoclose_${businessId}_${y}-${m}-${d}`;
}
