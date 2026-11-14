/**
 * Inteligência Peça Já HQ — agregações reais, sem inventar causa/tendência.
 * Projeções ficam fora deste módulo (ver hqProjection).
 */
import type { Order } from '@/types';
import type { PlatformState } from '@/services/platformTypes';
import { filterStateForMode, type HqDataMode } from '@/services/hqMode';
import { HQ_PROJ_PREFIX } from '@/services/hqProjection';
import { detectLiveProblems } from '@/services/hqProblems';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const x = startOfDay();
  x.setDate(x.getDate() - n);
  return x;
}

function paid(o: Order) {
  return !!o.paymentConfirmed && o.status !== 'cancelado';
}

function inRange(o: Order, from: number, to: number) {
  const t = new Date(o.createdAt).getTime();
  return t >= from && t < to;
}

function sumMetrics(orders: Order[]) {
  const paidOrders = orders.filter(paid);
  const canceled = orders.filter((o) => o.status === 'cancelado');
  const gmv = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const revenue = paidOrders.reduce((s, o) => s + Number(o.platformFee || 0), 0);
  const customers = new Set(paidOrders.map((o) => o.userId || o.customerName).filter(Boolean));
  return {
    orders: orders.length,
    paid: paidOrders.length,
    canceled: canceled.length,
    cancelRate: orders.length ? Math.round((canceled.length / orders.length) * 1000) / 10 : 0,
    gmv: Math.round(gmv * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    customers: customers.size,
    ticket: paidOrders.length ? Math.round((gmv / paidOrders.length) * 100) / 100 : 0,
  };
}

function pctChange(current: number, previous: number): number | null {
  if (!previous && !current) return 0;
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type HqInsightKind = 'growth' | 'drop' | 'ops' | 'attention' | 'info';

export type HqInsight = {
  id: string;
  kind: HqInsightKind;
  title: string;
  detail: string;
  observed: string;
  suggestion: string | null;
  periodLabel: string;
  compareLabel: string;
  baseCount: number;
  href: string;
  metric: string;
  current: number;
  previous: number;
  deltaPct: number | null;
};

export function buildIntelligence(state: PlatformState, mode: HqDataMode = 'real', days = 30) {
  const scoped = filterStateForMode(state, mode);
  const orders = (scoped.orders || []).filter((o) => {
    if (mode === 'real' && String(o.id).startsWith(HQ_PROJ_PREFIX)) return false;
    return true;
  });

  const now = Date.now();
  const curFrom = daysAgo(days).getTime();
  const prevFrom = daysAgo(days * 2).getTime();
  const prevTo = curFrom;

  const currentOrders = orders.filter((o) => inRange(o, curFrom, now + 1));
  const previousOrders = orders.filter((o) => inRange(o, prevFrom, prevTo));
  const current = sumMetrics(currentOrders);
  const previous = sumMetrics(previousOrders);

  const periodLabel = `últimos ${days} dias`;
  const compareLabel = `${days} dias anteriores`;

  const growth: {
    key: string;
    label: string;
    current: number;
    previous: number;
    deltaPct: number | null;
  }[] = [
    {
      key: 'orders',
      label: 'Pedidos',
      current: current.orders,
      previous: previous.orders,
      deltaPct: pctChange(current.orders, previous.orders),
    },
    {
      key: 'gmv',
      label: 'GMV',
      current: current.gmv,
      previous: previous.gmv,
      deltaPct: pctChange(current.gmv, previous.gmv),
    },
    {
      key: 'revenue',
      label: 'Receita Peça Já',
      current: current.revenue,
      previous: previous.revenue,
      deltaPct: pctChange(current.revenue, previous.revenue),
    },
    {
      key: 'customers',
      label: 'Clientes (pagos)',
      current: current.customers,
      previous: previous.customers,
      deltaPct: pctChange(current.customers, previous.customers),
    },
    {
      key: 'ticket',
      label: 'Ticket médio',
      current: current.ticket,
      previous: previous.ticket,
      deltaPct: pctChange(current.ticket, previous.ticket),
    },
  ];

  const insights: HqInsight[] = [];
  for (const g of growth) {
    if (g.deltaPct == null) {
      insights.push({
        id: `insuf_${g.key}`,
        kind: 'info',
        title: `${g.label}: dados insuficientes para comparar`,
        detail: `Período atual tem ${g.current}; período anterior não permite % de variação.`,
        observed: `Atual=${g.current} · Anterior=${g.previous}`,
        suggestion: null,
        periodLabel,
        compareLabel,
        baseCount: current.orders,
        href: '/admin/intelligence',
        metric: g.key,
        current: g.current,
        previous: g.previous,
        deltaPct: null,
      });
      continue;
    }
    if (g.deltaPct >= 5) {
      insights.push({
        id: `up_${g.key}`,
        kind: 'growth',
        title: `${g.label} cresceu ${g.deltaPct}%`,
        detail: `Comparando ${periodLabel} com ${compareLabel}.`,
        observed: `Atual=${g.current} · Anterior=${g.previous} · Δ=${g.deltaPct}%`,
        suggestion: null,
        periodLabel,
        compareLabel,
        baseCount: current.orders,
        href: g.key === 'revenue' || g.key === 'gmv' ? '/admin/finance' : '/admin/orders',
        metric: g.key,
        current: g.current,
        previous: g.previous,
        deltaPct: g.deltaPct,
      });
    } else if (g.deltaPct <= -5) {
      insights.push({
        id: `down_${g.key}`,
        kind: 'drop',
        title: `${g.label} caiu ${Math.abs(g.deltaPct)}%`,
        detail: `Queda observada nos dados do período — causa não inferida automaticamente.`,
        observed: `Atual=${g.current} · Anterior=${g.previous} · Δ=${g.deltaPct}%`,
        suggestion:
          'Possível oportunidade: investigar cidade, horário e comércios com maior contribuição na queda.',
        periodLabel,
        compareLabel,
        baseCount: current.orders,
        href: '/admin/intelligence',
        metric: g.key,
        current: g.current,
        previous: g.previous,
        deltaPct: g.deltaPct,
      });
    }
  }

  // Heatmap pedidos por dia×hora (0–6 × 0–23)
  const heat: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const delayHeat: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const o of currentOrders) {
    const d = new Date(o.createdAt);
    heat[d.getDay()][d.getHours()] += 1;
  }
  const { problems } = detectLiveProblems(state, mode);
  // Para atrasos históricos: pedidos pagos cujo age no createdAt+ETA ultrapassou — usamos só live + cancelados por horário
  for (const o of currentOrders) {
    if (o.status !== 'cancelado') continue;
    const d = new Date(o.createdAt);
    delayHeat[d.getDay()][d.getHours()] += 1;
  }

  let peakHour = 0;
  let peakDow = 0;
  let peakVal = 0;
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 0; h < 24; h++) {
      if (heat[dow][h] > peakVal) {
        peakVal = heat[dow][h];
        peakDow = dow;
        peakHour = h;
      }
    }
  }
  const dowNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  if (peakVal > 0) {
    insights.push({
      id: 'peak_hour',
      kind: 'ops',
      title: `Maior concentração de pedidos: ${dowNames[peakDow]} ${peakHour}h`,
      detail: `${peakVal} pedidos nesse slot no período analisado.`,
      observed: `heatmap[${dowNames[peakDow]}][${peakHour}h]=${peakVal} · base=${current.orders} pedidos`,
      suggestion:
        'Possível oportunidade operacional: reforçar entregadores nesse intervalo (hipótese, não fato causal).',
      periodLabel,
      compareLabel,
      baseCount: current.orders,
      href: '/admin/intelligence',
      metric: 'peak_hour',
      current: peakVal,
      previous: 0,
      deltaPct: null,
    });
  }

  if (problems.length > 0) {
    insights.push({
      id: 'open_problems',
      kind: 'attention',
      title: `${problems.length} pedidos atrasados exigem ação agora`,
      detail: 'Detectados pelo motor de problemas com base em ETA/status.',
      observed: `open=${problems.length} · critical=${problems.filter((p) => p.severity === 'critica').length}`,
      suggestion: null,
      periodLabel: 'ao vivo',
      compareLabel: '—',
      baseCount: problems.length,
      href: '/admin/problems',
      metric: 'problems_open',
      current: problems.length,
      previous: 0,
      deltaPct: null,
    });
  }

  // Anomalia: hoje vs média dos últimos 7 dias (excluindo hoje)
  const todayFrom = startOfDay().getTime();
  const todayOrders = orders.filter((o) => inRange(o, todayFrom, now + 1));
  const todayM = sumMetrics(todayOrders);
  const histDays: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const f = daysAgo(i).getTime();
    const t = daysAgo(i - 1).getTime();
    histDays.push(sumMetrics(orders.filter((o) => inRange(o, f, t))).orders);
  }
  const histAvg =
    histDays.length > 0 ? histDays.reduce((a, b) => a + b, 0) / histDays.length : 0;
  const anomalies: {
    id: string;
    title: string;
    detail: string;
    observed: string;
  }[] = [];
  if (histAvg >= 3) {
    const delta = pctChange(todayM.orders, histAvg);
    if (delta != null && Math.abs(delta) >= 35) {
      anomalies.push({
        id: 'vol_today',
        title:
          delta < 0
            ? `Volume ${Math.abs(delta)}% abaixo da média dos últimos 7 dias`
            : `Volume ${delta}% acima da média dos últimos 7 dias`,
        detail: 'Comparação: hoje vs média diária dos 7 dias anteriores.',
        observed: `hoje=${todayM.orders} · média7d=${Math.round(histAvg * 10) / 10} · Δ=${delta}%`,
      });
    }
  } else {
    anomalies.push({
      id: 'vol_insuf',
      title: 'Não há dados suficientes para anomalia de volume',
      detail: 'Média histórica dos últimos 7 dias é baixa demais para sinalizar desvio.',
      observed: `média7d=${Math.round(histAvg * 10) / 10}`,
    });
  }

  // Ranking cidades / comércios (período atual)
  const byCity: Record<string, { orders: number; gmv: number; canceled: number }> = {};
  const byShop: Record<string, { name: string; orders: number; gmv: number }> = {};
  for (const o of currentOrders) {
    const city = String((o as any).city || '—');
    if (!byCity[city]) byCity[city] = { orders: 0, gmv: 0, canceled: 0 };
    byCity[city].orders += 1;
    if (o.status === 'cancelado') byCity[city].canceled += 1;
    if (paid(o)) byCity[city].gmv += Number(o.total || 0);
    const sid = o.businessId || '—';
    if (!byShop[sid]) byShop[sid] = { name: o.businessName || sid, orders: 0, gmv: 0 };
    byShop[sid].orders += 1;
    if (paid(o)) byShop[sid].gmv += Number(o.total || 0);
  }

  const cities = Object.entries(byCity)
    .map(([city, v]) => ({
      city,
      orders: v.orders,
      gmv: Math.round(v.gmv * 100) / 100,
      cancelRate: v.orders ? Math.round((v.canceled / v.orders) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 20);

  const shops = Object.entries(byShop)
    .map(([id, v]) => ({
      businessId: id,
      name: v.name,
      orders: v.orders,
      gmv: Math.round(v.gmv * 100) / 100,
    }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 20);

  const opportunities = insights
    .filter((i) => i.suggestion)
    .map((i) => ({
      id: `opp_${i.id}`,
      observed: i.observed,
      suggestion: i.suggestion as string,
      href: i.href,
      title: i.title,
    }));

  return {
    meta: {
      mode,
      days,
      periodLabel,
      compareLabel,
      generatedAt: new Date().toISOString(),
      orderBase: current.orders,
      note: 'Valores calculados só com pedidos do ambiente selecionado. Projeção não mistura com operação real.',
    },
    current,
    previous,
    growth,
    insights,
    anomalies,
    heatmap: { orders: heat, cancellations: delayHeat, peak: { dow: peakDow, hour: peakHour, value: peakVal } },
    cities,
    shops,
    opportunities,
    problemsOpen: problems.length,
    today: todayM,
  };
}
