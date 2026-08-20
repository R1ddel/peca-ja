/**
 * Horário e status aberto/fechado do comércio.
 */
import { Business } from '@/types';

const DEFAULT_HOURS = '08:00–22:00';

export function getBusinessHours(business: Business): string {
  return business.hours?.trim() || DEFAULT_HOURS;
}

/** Mensagem clara quando a loja não aceita pedidos. */
export function getClosedBannerText(business: Business): string {
  const hours = getBusinessHours(business);
  return `Fechado no momento · Horário: ${hours}. Você pode ver o cardápio, mas não dá para pedir agora.`;
}

export function getOpenBadgeText(business: Business): string {
  if (business.isOpen) {
    return `Aberto · ${getBusinessHours(business)}`;
  }
  return `Fechado · ${getBusinessHours(business)}`;
}
