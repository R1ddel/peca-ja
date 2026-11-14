/**
 * Motor de problemas do Peça Já HQ — detecção e diagnóstico a partir de dados reais.
 * Não inventa causa: classifica pelo status/timestamps disponíveis.
 */
import type { Order } from '@/types';
import type { PlatformState } from '@/services/platformTypes';
import { HQ_PROJ_PREFIX } from '@/services/hqProjection';
import type { HqDataMode } from '@/services/hqMode';
import { filterStateForMode } from '@/services/hqMode';

function buildSimpleTimeline(
  order: Order,
  state: PlatformState,
  opts?: { lateStage?: string; overdueMin?: number }
) {
  const events: { at: string; label: string; meta?: string; late?: boolean }[] = [];
  events.push({ at: order.createdAt, label: 'Pedido criado' });
  if (order.paymentConfirmed) {
    events.push({
      at: (order as any).paymentConfirmedAt || order.createdAt,
      label: 'Pagamento confirmado',
      meta: order.paymentMethod || undefined,
    });
  } else {
    events.push({
      at: '—',
      label: 'Pagamento pendente',
      late: opts?.lateStage === 'pagamento',
    });
  }
  events.push({
    at: order.updatedAt || order.createdAt,
    label: `Status atual: ${order.status}`,
    late: true,
    meta:
      opts?.overdueMin != null && opts.overdueMin > 0
        ? `${opts.overdueMin} min acima do esperado`
        : undefined,
  });
  if (order.driverId) {
    events.push({
      at: (order as any).driverAssignedAt || order.updatedAt || order.createdAt,
      label: 'Entregador designado',
      meta: order.driverName || order.driverId || undefined,
    });
  } else if (String(order.status) === 'pronto') {
    events.push({
      at: '—',
      label: 'Entregador ainda não atribuído',
      late: true,
    });
  }
  if (order.kitchenReadyAt) {
    events.push({ at: order.kitchenReadyAt, label: 'Cozinha pronta' });
  }
  if (order.pickupVerifiedAt) {
    events.push({ at: order.pickupVerifiedAt, label: 'Coleta confirmada' });
  }
  const audits = (state.auditLogs || []).filter(
    (a) => a.entityType === 'order' && a.entityId === order.id
  );
  for (const a of audits.slice(0, 8)) {
    events.push({ at: a.createdAt, label: `Admin: ${a.action}`, meta: a.actorEmail });
  }
  return events.sort((a, b) => {
    if (a.at === '—') return 1;
    if (b.at === '—') return -1;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });
}
export type HqProblemSeverity = 'baixa' | 'media' | 'alta' | 'critica';
export type HqProblemStatus =
  | 'novo'
  | 'em_analise'
  | 'aguardando_comercio'
  | 'aguardando_entregador'
  | 'aguardando_cliente'
  | 'em_resolucao'
  | 'resolvido'
  | 'cancelado'
  | 'escalado';

export type HqDelayClass =
  | 'atraso_comercio'
  | 'atraso_aceitacao'
  | 'atraso_preparacao'
  | 'atraso_busca'
  | 'atraso_entregador'
  | 'atraso_entrega'
  | 'atraso_gps'
  | 'atraso_pagamento'
  | 'atraso_sem_causa';

export type HqProblemActionId =
  | 'msg_entregador'
  | 'msg_comercio'
  | 'msg_cliente'
  | 'ver_localizacao'
  | 'ver_pedido'
  | 'escalar'
  | 'registrar_ocorrencia'
  | 'resolver'
  | 'silenciar';

export type HqProblemCase = {
  id: string;
  orderId: string;
  status: HqProblemStatus;
  severity: HqProblemSeverity;
  delayClass: HqDelayClass;
  category: string;
  createdAt: string;
  updatedAt: string;
  slaMinutes: number;
  firstActionAt?: string | null;
  resolvedAt?: string | null;
  rootCause?: string | null;
  rootCauseNote?: string | null;
  assigneeUserId?: string | null;
  silencedUntil?: string | null;
  history: {
    at: string;
    actorId?: string;
    actorEmail?: string;
    text: string;
    action?: string;
  }[];
};

export type HqProblemLive = {
  id: string;
  orderId: string;
  createdAt: string;
  category: 'pedido_atrasado' | 'pagamento' | 'sistema';
  delayClass: HqDelayClass;
  severity: HqProblemSeverity;
  status: HqProblemStatus;
  ageMin: number;
  overdueMin: number;
  expectedMin: number;
  stage: string;
  nextOwner: 'comercio' | 'entregador' | 'cliente' | 'plataforma' | 'desconhecido';
  city: string;
  customerName: string;
  businessName: string;
  businessId: string;
  driverName: string | null;
  driverId: string | null;
  total: number;
  orderStatus: string;
  paymentConfirmed: boolean;
  slaMinutes: number;
  slaRemainingMin: number;
  slaBreached: boolean;
  probableCause: string;
  evidence: string[];
  recommendedActions: {
    id: HqProblemActionId;
    label: string;
    primary?: boolean;
    draftMessage?: string;
  }[];
  timeline: { at: string; label: string; meta?: string; late?: boolean }[];
  case: HqProblemCase | null;
};

function ageMinutes(iso: string, now = Date.now()) {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

function expectedTotalMinutes(o: Order): number {
  if (o.estimatedDelivery) {
    const created = new Date(o.createdAt).getTime();
    const eta = new Date(o.estimatedDelivery).getTime();
    if (Number.isFinite(eta) && eta > created) {
      return Math.max(20, Math.round((eta - created) / 60000));
    }
  }
  const st = String(o.status);
  // Defaults conservadores por status (sem inventar trânsito)
  switch (st) {
    case 'pendente':
      return 15;
    case 'confirmado':
      return 25;
    case 'preparando':
      return 45;
    case 'pronto':
      return 55;
    case 'saiu_entrega':
      return 70;
    default:
      return 60;
  }
}

function classifyDelay(o: Order): {
  delayClass: HqDelayClass;
  nextOwner: HqProblemLive['nextOwner'];
  stage: string;
  probableCause: string;
  evidence: string[];
} {
  const evidence: string[] = [];
  evidence.push(`status=${o.status}`);
  if (!o.paymentConfirmed) {
    return {
      delayClass: 'atraso_pagamento',
      nextOwner: 'plataforma',
      stage: 'pagamento',
      probableCause: 'Pagamento ainda não confirmado com o pedido em aberto.',
      evidence: [...evidence, 'paymentConfirmed=false'],
    };
  }
  if (o.status === 'pendente' || o.status === 'confirmado') {
    return {
      delayClass: o.status === 'pendente' ? 'atraso_aceitacao' : 'atraso_comercio',
      nextOwner: 'comercio',
      stage: 'aceitação/preparo',
      probableCause: 'Pedido ainda não avançou para preparação/pronto no comércio.',
      evidence,
    };
  }
  if (o.status === 'preparando' && !o.kitchenReadyAt) {
    return {
      delayClass: 'atraso_preparacao',
      nextOwner: 'comercio',
      stage: 'preparação',
      probableCause: 'Pedido permanece em preparação além do tempo esperado.',
      evidence: [...evidence, 'sem kitchenReadyAt'],
    };
  }
  // "pronto" pode existir em dados/seed mesmo fora do enum tipado
  const isReady =
    String(o.status) === 'pronto' || (!!o.kitchenReadyAt && o.status === 'preparando');
  if (isReady && !o.driverId) {
    return {
      delayClass: 'atraso_busca',
      nextOwner: 'entregador',
      stage: 'aguardando entregador',
      probableCause: 'Pedido pronto sem entregador atribuído.',
      evidence: [...evidence, 'driverId=null', o.kitchenReadyAt ? `kitchenReadyAt=${o.kitchenReadyAt}` : 'status=pronto'],
    };
  }
  if (isReady && o.driverId) {
    return {
      delayClass: 'atraso_entregador',
      nextOwner: 'entregador',
      stage: 'coleta',
      probableCause: 'Pedido pronto com entregador atribuído, ainda não saiu para entrega.',
      evidence: [...evidence, `driverId=${o.driverId}`],
    };
  }
  if (o.status === 'saiu_entrega') {
    return {
      delayClass: 'atraso_entrega',
      nextOwner: 'entregador',
      stage: 'em rota',
      probableCause: 'Pedido saiu para entrega e ultrapassou o tempo estimado.',
      evidence: [
        ...evidence,
        o.estimatedDelivery ? `eta=${o.estimatedDelivery}` : 'sem estimatedDelivery',
      ],
    };
  }
  return {
    delayClass: 'atraso_sem_causa',
    nextOwner: 'desconhecido',
    stage: o.status,
    probableCause: 'Atraso detectado; dados disponíveis não permitem classificar a etapa com precisão.',
    evidence,
  };
}

function severityFor(overdueMin: number, total: number): HqProblemSeverity {
  if (overdueMin >= 40 || total >= 150) return 'critica';
  if (overdueMin >= 25) return 'alta';
  if (overdueMin >= 12) return 'media';
  return 'baixa';
}

function slaMinutesFor(sev: HqProblemSeverity): number {
  if (sev === 'critica') return 10;
  if (sev === 'alta') return 15;
  if (sev === 'media') return 25;
  return 40;
}

function draftFor(
  action: HqProblemActionId,
  o: Order,
  overdueMin: number
): string | undefined {
  const id = o.id.slice(0, 10);
  if (action === 'msg_entregador') {
    return `Olá, ${o.driverName || 'entregador'}. O pedido #${id} está cerca de ${overdueMin} min acima do tempo esperado. Você consegue confirmar se está a caminho da coleta/entrega? Se houver algum problema, nos informe para ajudarmos.`;
  }
  if (action === 'msg_comercio') {
    return `Olá, ${o.businessName}. O pedido #${id} está ultrapassando o tempo estimado. Pedimos que confirme o status e, se possível, informe uma nova previsão.`;
  }
  if (action === 'msg_cliente') {
    return `Olá, ${o.customerName || 'cliente'}. Tivemos um atraso no seu pedido #${id}. Já estamos acompanhando e trabalhando para concluir a entrega o mais rápido possível.`;
  }
  return undefined;
}

function recommendedActions(
  delayClass: HqDelayClass,
  o: Order,
  overdueMin: number
): HqProblemLive['recommendedActions'] {
  const acts: HqProblemLive['recommendedActions'] = [];
  const push = (id: HqProblemActionId, label: string, primary?: boolean) => {
    acts.push({ id, label, primary, draftMessage: draftFor(id, o, overdueMin) });
  };

  if (delayClass === 'atraso_preparacao' || delayClass === 'atraso_aceitacao' || delayClass === 'atraso_comercio') {
    push('msg_comercio', 'Enviar mensagem ao comércio', true);
    push('msg_cliente', 'Avisar cliente');
  } else if (delayClass === 'atraso_busca' || delayClass === 'atraso_entregador' || delayClass === 'atraso_entrega') {
    push('msg_entregador', 'Enviar mensagem ao entregador', true);
    if (o.driverId) push('ver_localizacao', 'Ver localização');
    push('msg_cliente', 'Avisar cliente');
  } else if (delayClass === 'atraso_pagamento') {
    push('ver_pedido', 'Abrir pedido', true);
    push('registrar_ocorrencia', 'Registrar ocorrência');
  } else {
    push('ver_pedido', 'Abrir pedido', true);
    push('msg_comercio', 'Mensagem ao comércio');
    push('msg_entregador', 'Mensagem ao entregador');
  }
  push('escalar', 'Escalar operação');
  push('registrar_ocorrencia', 'Registrar ocorrência');
  push('resolver', 'Encerrar problema');
  return acts;
}

function findCase(state: PlatformState, orderId: string): HqProblemCase | null {
  const list = (state as any).problemCases as HqProblemCase[] | undefined;
  if (!Array.isArray(list)) return null;
  return (
    list
      .filter((c) => c.orderId === orderId && c.status !== 'resolvido' && c.status !== 'cancelado')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null
  );
}

export function detectLiveProblems(
  state: PlatformState,
  mode: HqDataMode = 'real'
): { summary: Record<string, number>; problems: HqProblemLive[] } {
  const scoped = filterStateForMode(state, mode);
  const now = Date.now();
  const problems: HqProblemLive[] = [];

  for (const o of scoped.orders || []) {
    if (o.status === 'entregue' || o.status === 'cancelado') continue;
    // Em REAL não listamos seed de projeção (já filtrado); em PROJEÇÃO permite.
    if (mode === 'real' && String(o.id).startsWith(HQ_PROJ_PREFIX)) continue;

    const expectedMin = expectedTotalMinutes(o);
    const ageMin = ageMinutes(o.createdAt, now);
    const overdueMin = ageMin - expectedMin;
    if (overdueMin < 8) continue; // limiar mínimo para não poluir

    const cls = classifyDelay(o);
    const severity = severityFor(overdueMin, Number(o.total || 0));
    const slaMinutes = slaMinutesFor(severity);
    const existing = findCase(state, o.id);
    const createdAt = existing?.createdAt || o.createdAt;
    const caseAge = ageMinutes(createdAt, now);
    const slaRemainingMin = Math.max(0, slaMinutes - caseAge);
    const timeline = buildSimpleTimeline(o, scoped, {
      lateStage: cls.stage,
      overdueMin,
    });

    const id = existing?.id || `prob_order_${o.id}`;
    problems.push({
      id,
      orderId: o.id,
      createdAt,
      category: 'pedido_atrasado',
      delayClass: cls.delayClass,
      severity: existing?.severity || severity,
      status: existing?.status || 'novo',
      ageMin,
      overdueMin,
      expectedMin,
      stage: cls.stage,
      nextOwner: cls.nextOwner,
      city: String((o as any).city || ''),
      customerName: o.customerName || '—',
      businessName: o.businessName,
      businessId: o.businessId,
      driverName: o.driverName || null,
      driverId: o.driverId || null,
      total: Number(o.total || 0),
      orderStatus: o.status,
      paymentConfirmed: !!o.paymentConfirmed,
      slaMinutes,
      slaRemainingMin,
      slaBreached: caseAge > slaMinutes && !(existing?.firstActionAt),
      probableCause: cls.probableCause,
      evidence: cls.evidence,
      recommendedActions: recommendedActions(cls.delayClass, o, overdueMin),
      timeline,
      case: existing,
    });
  }

  problems.sort((a, b) => {
    const rank = { critica: 0, alta: 1, media: 2, baixa: 3 };
    const d = rank[a.severity] - rank[b.severity];
    if (d !== 0) return d;
    return b.overdueMin - a.overdueMin;
  });

  const open = problems.filter((p) => p.status !== 'resolvido' && p.status !== 'cancelado');
  const summary = {
    open: open.length,
    critical: open.filter((p) => p.severity === 'critica').length,
    high: open.filter((p) => p.severity === 'alta').length,
    inProgress: open.filter((p) =>
      ['em_analise', 'em_resolucao', 'aguardando_comercio', 'aguardando_entregador', 'aguardando_cliente', 'escalado'].includes(
        p.status
      )
    ).length,
    slaBreached: open.filter((p) => p.slaBreached).length,
    resolvedToday: ((state as any).problemCases as HqProblemCase[] | undefined || []).filter((c) => {
      if (!c.resolvedAt) return false;
      return new Date(c.resolvedAt).getTime() >= new Date().setHours(0, 0, 0, 0);
    }).length,
  };

  return { summary, problems: open.slice(0, 200) };
}

export function buildAttentionQueue(state: PlatformState, mode: HqDataMode = 'real') {
  const { summary, problems } = detectLiveProblems(state, mode);
  const payConfigured = !!process.env.MP_ACCESS_TOKEN;
  const items: { id: string; level: string; title: string; href: string; count?: number }[] = [];
  if (summary.critical > 0) {
    items.push({
      id: 'crit',
      level: 'critical',
      title: `${summary.critical} problemas críticos`,
      href: '/admin/problems?severity=critica',
      count: summary.critical,
    });
  }
  if (summary.open > 0) {
    items.push({
      id: 'delayed',
      level: 'high',
      title: `${summary.open} pedidos atrasados exigem ação`,
      href: '/admin/problems',
      count: summary.open,
    });
  }
  if (summary.slaBreached > 0) {
    items.push({
      id: 'sla',
      level: 'high',
      title: `${summary.slaBreached} com SLA de primeira ação estourado`,
      href: '/admin/problems?sla=breached',
      count: summary.slaBreached,
    });
  }
  const openInc = (state.incidents || []).filter(
    (i) => i.status === 'open' || i.status === 'investigating'
  ).length;
  if (openInc > 0) {
    items.push({
      id: 'inc',
      level: 'medium',
      title: `${openInc} incidentes abertos`,
      href: '/admin/incidents',
      count: openInc,
    });
  }
  if (!payConfigured) {
    items.push({
      id: 'pay',
      level: 'medium',
      title: 'Gateway de pagamento não configurado',
      href: '/admin/health',
    });
  }
  return { summary, items, topProblems: problems.slice(0, 8) };
}

export const DELAY_CLASS_LABEL: Record<HqDelayClass, string> = {
  atraso_comercio: 'Atraso no comércio',
  atraso_aceitacao: 'Atraso na aceitação',
  atraso_preparacao: 'Atraso na preparação',
  atraso_busca: 'Atraso na busca',
  atraso_entregador: 'Atraso com o entregador',
  atraso_entrega: 'Atraso durante a entrega',
  atraso_gps: 'Atraso de GPS',
  atraso_pagamento: 'Atraso de pagamento',
  atraso_sem_causa: 'Atraso sem causa identificada',
};

export const ROOT_CAUSE_OPTIONS = [
  'Comércio atrasou preparação',
  'Entregador demorou para aceitar',
  'Falta de entregadores',
  'Erro de GPS',
  'Trânsito',
  'Falha de sistema',
  'Erro de endereço',
  'Cliente não localizado',
  'Problema de pagamento',
  'Problema operacional',
  'Outros',
] as const;
