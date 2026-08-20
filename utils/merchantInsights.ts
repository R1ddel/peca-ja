/**
 * Métricas e insights do painel do comerciante.
 */
import { Order } from '@/types';
import { OrderStatus } from '@/constants/theme';

function isSameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function isPaid(o: Order) {
  return !!o.paymentConfirmed && o.status !== 'cancelado';
}

export type HourBucket = { hour: number; label: string; count: number; sales: number };

export type MerchantInsights = {
  todayOrders: number;
  todaySales: number;
  todayTicket: number;
  activeCount: number;
  kitchenCount: number;
  deliveredToday: number;
  canceledToday: number;
  weekSales: number;
  weekOrders: number;
  /** Barras 0–1 para as últimas 7 horas (relógio local). */
  hourBars: HourBucket[];
  topItems: { name: string; qty: number; revenue: number }[];
  tip: string;
  /** Pico de pedidos hoje (rótulo da hora). */
  peakHourLabel: string | null;
  /** Tempo médio até entrega (min), se houver dados. */
  avgPrepMinutes: number | null;
};

function orderNetAmount(o: Order): number {
  if (typeof o.establishmentAmount === 'number' && Number.isFinite(o.establishmentAmount)) {
    return Math.max(0, o.establishmentAmount);
  }
  return Math.max(0, o.subtotal - (o.discount ?? 0));
}

export function buildMerchantInsights(orders: Order[]): MerchantInsights {
  const now = new Date();
  const today = orders.filter((o) => isSameDay(new Date(o.createdAt), now));
  const paidToday = today.filter(isPaid);

  /** Receita líquida da loja (não o total pago pelo cliente). */
  const todaySales = paidToday.reduce((s, o) => s + orderNetAmount(o), 0);
  const todayOrders = paidToday.length;
  const todayTicket = todayOrders ? todaySales / todayOrders : 0;

  const activeCount = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  ).length;
  const kitchenCount = orders.filter(
    (o) => o.status === 'confirmado' || o.status === 'preparando'
  ).length;
  const deliveredToday = today.filter((o) => o.status === 'entregue').length;
  const canceledToday = today.filter((o) => o.status === 'cancelado').length;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weekPaid = orders.filter((o) => {
    if (!isPaid(o)) return false;
    return new Date(o.createdAt) >= weekStart;
  });
  const weekSales = weekPaid.reduce((s, o) => s + orderNetAmount(o), 0);
  const weekOrders = weekPaid.length;

  const hourBars: HourBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const h = (now.getHours() - i + 24) % 24;
    const bucketOrders = paidToday.filter((o) => new Date(o.createdAt).getHours() === h);
    hourBars.push({
      hour: h,
      label: `${String(h).padStart(2, '0')}h`,
      count: bucketOrders.length,
      sales: bucketOrders.reduce((s, o) => s + orderNetAmount(o), 0),
    });
  }

  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of paidToday) {
    for (const line of o.items) {
      const key = line.item.id;
      const prev = itemMap.get(key) || { name: line.item.name, qty: 0, revenue: 0 };
      const unit = line.item.promo ?? line.item.price;
      const lineRev = unit * line.quantity;
      itemMap.set(key, {
        name: line.item.name,
        qty: prev.qty + line.quantity,
        revenue: prev.revenue + lineRev,
      });
    }
  }
  const topItems = Array.from(itemMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const peak = hourBars.reduce<(typeof hourBars)[0] | null>((best, h) => {
    if (!best || h.count > best.count) return h;
    return best;
  }, null);
  const peakHourLabel = peak && peak.count > 0 ? peak.label : null;

  const prepSamples = today
    .filter((o) => o.status === 'entregue' || o.status === 'saiu_entrega')
    .map((o) => {
      const start = new Date(o.createdAt).getTime();
      const end = o.pickupVerifiedAt
        ? new Date(o.pickupVerifiedAt).getTime()
        : Date.now();
      return Math.max(0, Math.round((end - start) / 60000));
    })
    .filter((m) => m > 0 && m < 180);
  const avgPrepMinutes = prepSamples.length
    ? Math.round(prepSamples.reduce((a, b) => a + b, 0) / prepSamples.length)
    : null;

  let tip =
    'Mantenha o cardápio com fotos boas — pedidos sobem quando o cliente vê o prato.';
  if (!orders.length) {
    tip = 'Publique 5+ itens com foto e deixe a loja aberta. O primeiro pedido costuma vir no mesmo dia.';
  } else if (kitchenCount > 3) {
    tip = 'Fila na cozinha: priorize os mais antigos e use o código de retirada assim que o entregador chegar.';
  } else if (todayOrders === 0 && now.getHours() >= 11) {
    tip = 'Sem pedidos hoje ainda — confira se a loja está aberta e se o frete/tempo estão atrativos.';
  } else if (topItems[0]) {
    tip = `Campeão de hoje: “${topItems[0].name}”. Considere um combo ou destaque no cardápio.`;
  } else if (canceledToday > 0) {
    tip = 'Houve cancelamento hoje. Responda rápido nos pedidos novos para reduzir abandono.';
  } else if (peakHourLabel) {
    tip = `Seu pico de hoje foi às ${peakHourLabel}. Prepare estoque e equipe nesse horário.`;
  } else if (todaySales > 0) {
    tip = 'O caixa mostra o valor da loja (preço cadastrado). A taxa Peça Já sobe só no total do cliente e não sai do seu bolso.';
  }

  return {
    todayOrders,
    todaySales,
    todayTicket,
    activeCount,
    kitchenCount,
    deliveredToday,
    canceledToday,
    weekSales,
    weekOrders,
    hourBars,
    topItems,
    tip,
    peakHourLabel,
    avgPrepMinutes,
  };
}

export function statusTone(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    pendente: '#F59E0B',
    confirmado: '#3B82F6',
    preparando: '#FF6B35',
    saiu_entrega: '#8B5CF6',
    entregue: '#00A86B',
    cancelado: '#EF4444',
  };
  return map[status];
}
