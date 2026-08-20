/**
 * Cupom de cozinha (texto 32 colunas) — compartilhar / imprimir PDF.
 */
import { Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Order } from '@/types';
import { formatPrice } from '@/data/businesses';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatOrderDateTime } from '@/utils/datetime';
import { getLineTotal } from '@/utils/cartLine';

const W = 32;

function line(char = '-') {
  return char.repeat(W);
}

function center(text: string) {
  const t = text.slice(0, W);
  const pad = Math.max(0, Math.floor((W - t.length) / 2));
  return ' '.repeat(pad) + t;
}

function row(left: string, right: string) {
  const L = left.slice(0, W - 1);
  const R = right.slice(0, W - L.length - 1);
  return L + ' '.repeat(Math.max(1, W - L.length - R.length)) + R;
}

export function buildKitchenTicketText(order: Order, shopName?: string): string {
  const lines: string[] = [];
  lines.push(line('='));
  lines.push(center(shopName || order.businessName));
  lines.push(center('PEÇA JÁ · COZINHA'));
  lines.push(line('='));
  lines.push(center(merchantOrderLabel(order)));
  lines.push(`Feito: ${formatOrderDateTime(order.createdAt)}`);
  lines.push(`Status: ${order.status}`);
  lines.push(line());
  lines.push('ITENS');
  for (const item of order.items) {
    const addons =
      item.selectedAddons?.map((a) => a.name).filter(Boolean).join(', ') || '';
    lines.push(`${item.quantity}x ${item.item.name}`.slice(0, W));
    if (addons) lines.push(`  + ${addons}`.slice(0, W));
    if (item.note) lines.push(`  obs: ${item.note}`.slice(0, W));
    lines.push(row('', formatPrice(getLineTotal(item))));
  }
  lines.push(line());
  lines.push(row('Subtotal', formatPrice(order.subtotal)));
  lines.push(row('Frete', formatPrice(order.deliveryFee)));
  if (order.discount) lines.push(row('Desconto', `- ${formatPrice(order.discount)}`));
  lines.push(row('TOTAL', formatPrice(order.total)));
  lines.push(line());
  lines.push('ENTREGA');
  lines.push(order.address.slice(0, W * 3));
  lines.push(`Pagamento: ${order.paymentMethod}`);
  if (order.pickupCode) lines.push(`Retirada loja: ${order.pickupCode}`);
  if (order.deliveryCode) lines.push(`Cód. cliente: ${order.deliveryCode}`);
  if (order.driverName) lines.push(`Motoboy: ${order.driverName}`);
  lines.push(line('='));
  lines.push(center('Obrigado · Peça Já'));
  lines.push('');
  return lines.join('\n');
}

export async function shareKitchenTicket(order: Order, shopName?: string) {
  const message = buildKitchenTicketText(order, shopName);
  await Share.share({
    message,
    title: `Cupom ${merchantOrderLabel(order)}`,
  });
}

export async function copyKitchenTicket(order: Order, shopName?: string) {
  const message = buildKitchenTicketText(order, shopName);
  await Clipboard.setStringAsync(message);
}

/** PDF térmico via expo-print (Expo Go ok). */
export async function printKitchenTicketPdf(order: Order, shopName?: string) {
  const text = buildKitchenTicketText(order, shopName);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:monospace;font-size:12px;padding:12px;white-space:pre-wrap}
</style></head><body>${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</body></html>`;

  try {
    const Print = await import('expo-print');
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return { ok: true as const };
    }
    await Print.printAsync({ html });
    return { ok: true as const };
  } catch (e) {
    await shareKitchenTicket(order, shopName);
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Impressão indisponível — cupom compartilhado.',
    };
  }
}
