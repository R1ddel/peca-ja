import { CartItem, MenuItem, SelectedAddon } from '@/types';
import { customerUnitPrice } from '@/constants/pricing';

export function makeLineId(
  itemId: string,
  addons: SelectedAddon[],
  note?: string
): string {
  const key = [...addons]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((a) => `${a.id}x${a.quantity}`)
    .join('|');
  const noteKey = (note ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${itemId}::${key || 'plain'}::${noteKey || '-'}`;
}

export function getAddonsTotal(addons: SelectedAddon[]): number {
  return addons.reduce((sum, a) => sum + a.price * a.quantity, 0);
}

export function getUnitPrice(item: MenuItem, addons: SelectedAddon[] = []): number {
  return (item.promo ?? item.price) + getAddonsTotal(addons);
}

export function getLineTotal(line: CartItem): number {
  return getUnitPrice(line.item, line.selectedAddons) * line.quantity;
}

/** Preço unitário exibido ao cliente (cadastro + taxa Peça Já por item). */
export function getCustomerUnitPrice(item: MenuItem, addons: SelectedAddon[] = []): number {
  return customerUnitPrice(getUnitPrice(item, addons));
}

export function getCustomerLineTotal(line: CartItem): number {
  return getCustomerUnitPrice(line.item, line.selectedAddons) * line.quantity;
}

export function formatAddonsLabel(addons: SelectedAddon[]): string {
  if (!addons.length) return '';
  return addons
    .map((a) => (a.quantity > 1 ? `${a.quantity}x ${a.name}` : a.name))
    .join(', ');
}

export function normalizeCartItem(
  raw: CartItem & { lineId?: string; selectedAddons?: SelectedAddon[]; note?: string }
): CartItem {
  const selectedAddons = raw.selectedAddons ?? [];
  const note = raw.note?.trim() || undefined;
  return {
    item: raw.item,
    quantity: raw.quantity,
    businessId: raw.businessId,
    businessName: raw.businessName,
    selectedAddons,
    note,
    lineId: raw.lineId ?? makeLineId(raw.item.id, selectedAddons, note),
  };
}
