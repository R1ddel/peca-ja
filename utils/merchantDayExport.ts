/**
 * Resumo do dia da loja para o dono (texto compartilhável).
 */
import { Share } from 'react-native';
import { Order } from '@/types';
import { formatOrderDate, formatOrderDateTime, formatOrderTime } from '@/utils/datetime';
import { formatPrice } from '@/data/businesses';
import { buildMerchantInsights } from '@/utils/merchantInsights';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export type DaySummaryInput = {
  shopName: string;
  orders: Order[];
  chatUnread?: number;
  onShiftNames?: string[];
};

export function buildDaySummaryText(input: DaySummaryInput): string {
  const now = new Date();
  const insights = buildMerchantInsights(input.orders);
  const today = input.orders.filter((o) => isSameDay(new Date(o.createdAt), now));
  const lines: string[] = [
    `Peça Já · Resumo do dia`,
    `${input.shopName}`,
    `Gerado em ${formatOrderDateTime(now.toISOString())}`,
    '',
    `Pedidos pagos: ${insights.todayOrders}`,
    `Líquido: ${formatPrice(insights.todaySales)}`,
    `Entregues: ${insights.deliveredToday}`,
    `Cancelados: ${insights.canceledToday}`,
    `Na cozinha agora: ${insights.kitchenCount}`,
  ];

  if (typeof input.chatUnread === 'number') {
    lines.push(`Conversas não lidas: ${input.chatUnread}`);
  }
  if (input.onShiftNames?.length) {
    lines.push(`Em turno: ${input.onShiftNames.join(', ')}`);
  }

  const canceled = today.filter((o) => o.status === 'cancelado');
  if (canceled.length) {
    lines.push('', 'Cancelamentos:');
    for (const o of canceled) {
      const reason = o.cancelReason?.trim() || 'sem motivo';
      const by = o.cancelledBy === 'merchant' ? 'loja' : o.cancelledBy === 'customer' ? 'cliente' : '—';
      lines.push(
        `· ${merchantOrderLabel(o)} · ${formatOrderTime(o.createdAt)} · ${by} · ${reason}`
      );
    }
  }

  const active = today.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  );
  if (active.length) {
    lines.push('', 'Pedidos em andamento:');
    for (const o of active) {
      lines.push(`· ${merchantOrderLabel(o)} · ${o.status} · ${formatPrice(o.total)}`);
    }
  }

  lines.push('', '— Fim do resumo —');
  return lines.join('\n');
}

export async function shareDaySummary(input: DaySummaryInput): Promise<void> {
  const message = buildDaySummaryText(input);
  await Share.share({
    message,
    title: `Resumo · ${input.shopName} · ${formatOrderDate(new Date().toISOString())}`,
  });
}
