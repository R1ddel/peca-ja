/**
 * Peça Já HQ — Command Center · Visão Geral visual
 * Hierarquia: Status → Atenção → KPIs → Crescimento → Operação → Problemas → Oportunidades
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { useHqMode } from '@/app/admin/_hqContext';
import { getPlatformToken } from '@/services/platformSession';
import {
  platformAdminOverview,
  platformAdminHealth,
  platformAdminOpsNow,
  platformAdminProblemsNow,
  platformAdminIntelligence,
  platformAdminListApplications,
} from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';
import {
  ErrBox,
  LoadingBlock,
  PageHeader,
  HealthDot,
  LiveBadge,
  SectionCard,
  StatusPill,
  EnvBanner,
} from '@/app/admin/_components';
import {
  StoryKpi,
  TrendChart,
  DistBars,
  FlowFunnel,
  HeatmapGrid,
  InsightCard,
  OpsStatusStrip,
  GaugeRing,
  WaterfallBars,
} from '@/app/admin/_viz';
import { roleLabel } from '@/services/platformRoles';

function deltaPct(current: number, previous: number): number | null {
  if (!previous && !current) return 0;
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function targetPct(current: number, target?: number | null) {
  if (target == null || !target) return null;
  return Math.round((current / target) * 1000) / 10;
}

export default function AdminOverviewScreen() {
  const { ok, isLoading: gateLoading, role, isWeb } = useAdminGate();
  const { mode, environmentLabel, isProjection, setMode, ensureRealIfProjectionUnavailable } =
    useHqMode();
  const [overview, setOverview] = useState<any>(null);
  const [ops, setOps] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [attention, setAttention] = useState<any>(null);
  const [intel, setIntel] = useState<any>(null);
  const [metric, setMetric] = useState<'orders' | 'gmv'>('orders');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');
  const [pendingDrivers, setPendingDrivers] = useState(0);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setErr('');
      try {
        const token = await getPlatformToken();
        if (!token) {
          setErr('Sem sessão cloud.');
          return;
        }
        const [o, op, h, prob, intelRes, appsRes] = await Promise.all([
          platformAdminOverview(token, mode),
          platformAdminOpsNow(token, mode),
          platformAdminHealth(token),
          platformAdminProblemsNow(token, { hqMode: mode }),
          platformAdminIntelligence(token, { hqMode: mode, sinceDays: 30 }),
          platformAdminListApplications(token, { role: 'driver', status: 'pending' }),
        ]);
        if (!o?.ok) {
          setErr((o as any)?.message || 'Falha ao carregar overview.');
          return;
        }
        setOverview((o as any).overview);
        const projOk = !!(o as any).overview?.projectionAvailable;
        ensureRealIfProjectionUnavailable(projOk);
        if (op?.ok) setOps((op as any).ops);
        if (h?.ok) setHealth((h as any).health);
        if (prob?.ok) {
          setAttention({
            summary: (prob as any).summary,
            items: (prob as any).attention?.items || [],
            topProblems: (prob as any).attention?.topProblems || (prob as any).problems?.slice(0, 5),
          });
        }
        if (intelRes?.ok) setIntel((intelRes as any).intelligence);
        if (appsRes?.ok) {
          setPendingDrivers(((appsRes as any).applications || []).length);
        }
        setUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } finally {
        setLoading(false);
      }
    },
    [mode, ensureRealIfProjectionUnavailable]
  );

  useFocusEffect(
    useCallback(() => {
      if (!ok) return;
      void load();
      const id = setInterval(() => void load(true), 20000);
      return () => clearInterval(id);
    }, [ok, load])
  );

  const delayDist = useMemo(() => {
    const list: any[] = attention?.topProblems || [];
    const map: Record<string, number> = {};
    for (const p of list) {
      const k = p.delayClass || 'atraso_sem_causa';
      map[k] = (map[k] || 0) + 1;
    }
    const labels: Record<string, string> = {
      atraso_preparacao: 'Preparação',
      atraso_comercio: 'Comércio',
      atraso_aceitacao: 'Aceitação',
      atraso_busca: 'Falta de entregador',
      atraso_entregador: 'Entregador',
      atraso_entrega: 'Em rota',
      atraso_gps: 'GPS',
      atraso_pagamento: 'Pagamento',
      atraso_sem_causa: 'Sem causa identificada',
    };
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map)
      .map(([k, v]) => ({
        label: labels[k] || k,
        value: v,
        pct: Math.round((v / total) * 1000) / 10,
      }))
      .sort((a, b) => b.value - a.value);
  }, [attention]);

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  const d = overview || {};
  const today = d.today || {};
  const yesterday = d.yesterday || {};
  const week = d.week7d || {};
  const targets = d.targets || null;
  const insights: any[] = d.insights || [];
  const alerts: any[] = d.alerts || [];
  const ticketMedio =
    today.paidCount > 0 ? Math.round((today.gmv / today.paidCount) * 100) / 100 : 0;
  const ticketMedioY =
    yesterday.paidCount > 0
      ? Math.round((yesterday.gmv / yesterday.paidCount) * 100) / 100
      : 0;
  const alertCount = alerts.filter((a) => a.level === 'critical' || a.level === 'high').length;
  const attentionItems = attention?.items || [];
  const openProblems = Number(attention?.summary?.open || 0);
  const criticalProblems = Number(attention?.summary?.critical || 0);
  const needsAttention = openProblems > 0 || attentionItems.length > 0 || alertCount > 0;

  const byStatus: Record<string, number> = ops?.byStatus || {};
  const flowStages = [
    { label: 'Recebidos (hoje)', value: Number(today.count || 0), tone: 'blue' as const },
    { label: 'Em andamento', value: Number(today.inProgress || ops?.activeCount || 0), tone: 'amber' as const },
    {
      label: 'Preparando',
      value: Number(byStatus.preparando || 0),
      tone: 'amber' as const,
    },
    {
      label: 'Em rota',
      value: Number(byStatus.saiu_entrega || 0),
      tone: 'blue' as const,
    },
    { label: 'Entregues', value: Number(today.delivered || 0), tone: 'green' as const },
  ];

  const series = metric === 'gmv' ? d.series7d?.gmv || [] : d.series7d?.orders || [];
  const seriesLabels: string[] = d.series7d?.labels || [];
  const weekTarget =
    metric === 'gmv'
      ? targets?.weekGmv != null
        ? Number(targets.weekGmv) / 7
        : null
      : targets?.weekOrders != null
        ? Number(targets.weekOrders) / 7
        : null;

  const coverPct =
    Number(ops?.activeCount || 0) > 0 && Number(ops?.awaitingDriverCount || 0) >= 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (1 -
                Number(ops?.awaitingDriverCount || 0) /
                  Math.max(Number(ops?.activeCount || 0), 1)) *
                100
            )
          )
        )
      : null;

  const waterfall = [
    { label: 'GMV', value: Number(today.gmv || 0), kind: 'pos' as const },
    { label: 'Receita', value: Number(today.platformFee || 0), kind: 'pos' as const },
    {
      label: 'Repasses*',
      value: Math.max(0, Number(today.gmv || 0) - Number(today.platformFee || 0)),
      kind: 'neg' as const,
    },
  ];

  const intelInsights: any[] = intel?.insights || [];
  const opportunities: any[] = intel?.opportunities || [];
  const heat: number[][] = intel?.heatmap?.orders || [];

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={[hqStyles.content, styles.pad]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <EnvBanner mode={mode} label={d.environmentLabel || environmentLabel} />

      <PageHeader
        title="Command Center"
        lead={`${roleLabel(role)} · ${updatedAt || '—'} · ${
          isProjection ? 'planejamento' : 'operação ao vivo'
        }`}
        right={
          criticalProblems > 0 || alertCount > 0 ? (
            <LiveBadge text={`${criticalProblems || alertCount} críticos`} />
          ) : (
            <StatusPill label="Estável" tone="green" />
          )
        }
      />
      <ErrBox message={err} />
      {err.includes('sessão') ? (
        <TouchableOpacity
          style={hqStyles.btn}
          onPress={() => router.replace('/admin/login' as any)}
        >
          <Text style={hqStyles.btnText}>Entrar no HQ (nuvem)</Text>
        </TouchableOpacity>
      ) : null}

      {!d.projectionAvailable && isProjection ? (
        <View style={hqStyles.infoBox}>
          <Text style={hqStyles.infoText}>
            Projeção indisponível — alternando para OPERAÇÃO REAL. Para ativar o cenário Ano 2, rode{' '}
            npm run seed:hq-projection na API e recarregue.
          </Text>
          <TouchableOpacity style={[hqStyles.btnGhost, { marginTop: 8 }]} onPress={() => setMode('real')}>
            <Text style={hqStyles.btnGhostText}>Usar OPERAÇÃO REAL agora</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* STATUS */}
      <OpsStatusStrip
        items={[
          {
            label: 'API',
            value: health?.platform?.status === 'online' ? 'Online' : health?.platform?.status || '—',
            tone: health?.platform?.status === 'online' ? 'green' : 'red',
          },
          {
            label: 'Frota',
            value: health?.fleet?.status === 'online' ? 'Online' : health?.fleet?.status || '—',
            tone: health?.fleet?.status === 'online' ? 'green' : 'amber',
          },
          {
            label: 'Pagamentos',
            value: health?.payments?.status || '—',
            tone:
              health?.payments?.status === 'online' || health?.payments?.status === 'connected'
                ? 'green'
                : 'amber',
          },
          {
            label: 'Problemas',
            value: openProblems,
            tone: openProblems > 0 ? 'red' : 'green',
          },
          {
            label: 'Em andamento',
            value: today.inProgress || ops?.activeCount || 0,
            tone: 'blue',
          },
        ]}
      />

      {/* ATENÇÃO */}
      <TouchableOpacity
        style={[styles.attentionCta, needsAttention && styles.attentionCtaHot]}
        onPress={() => router.push('/admin/problems' as any)}
      >
        <View style={styles.attnIcon}>
          <Text style={{ fontSize: 22 }}>{needsAttention ? '⚡' : '✓'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.attentionTitle}>O que precisa de minha atenção?</Text>
          <Text style={styles.attentionSub}>
            {openProblems > 0
              ? `${openProblems} problemas · ${criticalProblems} críticos · ${
                  attention?.summary?.slaBreached || 0
                } SLA estourado`
              : needsAttention
                ? `${attentionItems.length || alertCount} itens exigem revisão`
                : 'Fila limpa — nenhuma ação urgente detectada'}
          </Text>
        </View>
        <Text style={styles.attentionGo}>Agir →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.attentionCta, pendingDrivers > 0 && styles.attentionCtaHot]}
        onPress={() => router.push('/admin/crm' as any)}
      >
        <View style={styles.attnIcon}>
          <Text style={{ fontSize: 22 }}>⇉</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.attentionTitle}>Cadastros da equipe</Text>
          <Text style={styles.attentionSub}>
            {pendingDrivers > 0
              ? `${pendingDrivers} motoboy${pendingDrivers === 1 ? '' : 's'} em análise · aceitar ou recusar, e ver os planos mensais`
              : 'Aceitar ou recusar motoboy e ver o plano mensal de cada loja'}
          </Text>
        </View>
        <Text style={styles.attentionGo}>Abrir →</Text>
      </TouchableOpacity>

      {/* KPIs HERO */}
      <Text style={hqStyles.h2}>Indicadores com contexto</Text>
      <View style={hqStyles.row}>
        <StoryKpi
          size="lg"
          label="Pedidos hoje"
          value={(today.count || 0).toLocaleString('pt-BR')}
          deltaPct={deltaPct(Number(today.count || 0), Number(yesterday.count || 0))}
          spark={d.series7d?.orders}
          tone="blue"
          target={
            targets?.todayOrders != null
              ? {
                  value: targets.todayOrders,
                  pct: targetPct(Number(today.count || 0), Number(targets.todayOrders)),
                }
              : null
          }
          onPress={() => router.push('/admin/orders?sinceDays=1' as any)}
        />
        <StoryKpi
          size="lg"
          label="GMV hoje"
          value={formatPrice(today.gmv || 0)}
          deltaPct={deltaPct(Number(today.gmv || 0), Number(yesterday.gmv || 0))}
          spark={d.series7d?.gmv}
          tone="green"
          target={
            targets?.todayGmv != null
              ? {
                  value: formatPrice(targets.todayGmv),
                  pct: targetPct(Number(today.gmv || 0), Number(targets.todayGmv)),
                }
              : null
          }
          onPress={() => router.push('/admin/finance' as any)}
        />
      </View>
      <View style={hqStyles.row}>
        <StoryKpi
          label="Receita Peça Já"
          value={formatPrice(today.platformFee || 0)}
          deltaPct={deltaPct(Number(today.platformFee || 0), Number(yesterday.platformFee || 0))}
          tone="green"
          onPress={() => router.push('/admin/finance' as any)}
          footer="Separado do GMV"
        />
        <StoryKpi
          label="Ticket médio"
          value={formatPrice(ticketMedio)}
          deltaPct={deltaPct(ticketMedio, ticketMedioY)}
          tone="blue"
        />
        <StoryKpi
          label="Cancelados"
          value={(today.canceled || 0).toLocaleString('pt-BR')}
          deltaPct={deltaPct(Number(today.canceled || 0), Number(yesterday.canceled || 0))}
          tone="red"
          onPress={() => router.push('/admin/orders?sinceDays=1&status=cancelado' as any)}
        />
      </View>

      {/* CRESCIMENTO */}
      <SectionCard
        title="Crescimento do Peça Já · 7 dias"
        action={
          <View style={styles.metricSwitch}>
            {(['orders', 'gmv'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.metricBtn, metric === m && styles.metricBtnOn]}
                onPress={() => setMetric(m)}
              >
                <Text style={[styles.metricBtnText, metric === m && styles.metricBtnTextOn]}>
                  {m === 'orders' ? 'Pedidos' : 'GMV'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => router.push('/admin/intelligence' as any)}>
              <Text style={styles.link}>Inteligência →</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <TrendChart
          series={series}
          labels={seriesLabels}
          target={weekTarget}
          color={metric === 'gmv' ? hq.green : hq.blue}
          formatValue={(n) => (metric === 'gmv' ? formatPrice(n) : n.toLocaleString('pt-BR'))}
        />
        <View style={[hqStyles.row, { marginTop: 12 }]}>
          <StoryKpi
            size="sm"
            label="Pedidos 7d"
            value={(week.count || 0).toLocaleString('pt-BR')}
            spark={d.series7d?.orders}
            tone="blue"
            target={
              targets?.weekOrders != null
                ? {
                    value: targets.weekOrders,
                    pct: targetPct(Number(week.count || 0), Number(targets.weekOrders)),
                  }
                : null
            }
          />
          <StoryKpi
            size="sm"
            label="GMV 7d"
            value={formatPrice(week.gmv || 0)}
            spark={d.series7d?.gmv}
            tone="green"
            target={
              targets?.weekGmv != null
                ? {
                    value: formatPrice(targets.weekGmv),
                    pct: targetPct(Number(week.gmv || 0), Number(targets.weekGmv)),
                  }
                : null
            }
          />
        </View>
      </SectionCard>

      {/* OPERAÇÃO + FUNIL */}
      <View style={styles.split}>
        <View style={styles.splitMain}>
          <SectionCard title="Fluxo operacional agora">
            <FlowFunnel stages={flowStages} />
          </SectionCard>
        </View>
        <View style={styles.splitSide}>
          <SectionCard title="Cobertura de entrega">
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <GaugeRing
                pct={coverPct}
                label="Demanda coberta"
                sub={
                  coverPct == null
                    ? 'Sem base operacional'
                    : `${ops?.awaitingDriverCount || 0} aguardando entregador`
                }
                tone={coverPct == null ? 'blue' : coverPct >= 80 ? 'green' : coverPct >= 60 ? 'amber' : 'red'}
              />
            </View>
            <TouchableOpacity onPress={() => router.push('/admin/ops' as any)}>
              <Text style={styles.link}>Abrir operação →</Text>
            </TouchableOpacity>
          </SectionCard>
        </View>
      </View>

      {/* PROBLEMAS */}
      <SectionCard
        title="Por que estamos atrasando?"
        action={
          <TouchableOpacity onPress={() => router.push('/admin/problems' as any)}>
            <Text style={styles.link}>Central →</Text>
          </TouchableOpacity>
        }
      >
        {delayDist.length === 0 ? (
          <Text style={hqStyles.empty}>
            Nenhum atraso aberto no momento — distribuição aparece quando houver casos.
          </Text>
        ) : (
          <DistBars items={delayDist} color={hq.amber} />
        )}
        {(attention?.topProblems || []).slice(0, 3).map((p: any) => (
          <TouchableOpacity
            key={p.id || p.orderId}
            style={styles.alertRow}
            onPress={() => router.push('/admin/problems' as any)}
          >
            <StatusPill
              label={String(p.severity || 'media').toUpperCase()}
              tone={p.severity === 'critica' || p.severity === 'alta' ? 'red' : 'amber'}
            />
            <Text style={styles.alertText} numberOfLines={1}>
              {p.businessName} · {p.overdueMin} min · {p.probableCause}
            </Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ))}
      </SectionCard>

      {/* HEATMAP */}
      <SectionCard
        title="Mapa de calor da demanda · 30 dias"
        action={
          <TouchableOpacity onPress={() => router.push('/admin/intelligence' as any)}>
            <Text style={styles.link}>Explorar →</Text>
          </TouchableOpacity>
        }
      >
        <HeatmapGrid grid={heat} />
        <Text style={styles.heatHint}>
          Intensidade = pedidos observados. Pico:{' '}
          {intel?.heatmap?.peak?.value
            ? `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][intel.heatmap.peak.dow]} ${intel.heatmap.peak.hour}h (${intel.heatmap.peak.value})`
            : 'dados insuficientes'}
        </Text>
      </SectionCard>

      {/* FINANCEIRO */}
      <SectionCard title="Como o dinheiro percorre a operação (hoje)">
        <WaterfallBars steps={waterfall} />
        <Text style={styles.heatHint}>
          *Repasses aproximados = GMV − taxa Peça Já quando disponível. Não mistura GMV com receita.
        </Text>
      </SectionCard>

      {/* INSIGHTS */}
      <Text style={hqStyles.h2}>Insights</Text>
      <View style={hqStyles.row}>
        {(intelInsights.length ? intelInsights : insights).slice(0, 4).map((ins: any) => (
          <InsightCard
            key={ins.id}
            kind={ins.kind || 'info'}
            title={ins.title}
            observed={ins.observed || ins.detail || '—'}
            analysis={ins.detail}
            opportunity={ins.suggestion}
            spark={ins.metric === 'gmv' ? d.series7d?.gmv : d.series7d?.orders}
            onPress={() => router.push((ins.href || '/admin/intelligence') as any)}
          />
        ))}
        {!intelInsights.length && !insights.length ? (
          <Text style={hqStyles.empty}>Sem insights significativos no momento.</Text>
        ) : null}
      </View>

      {/* OPORTUNIDADES */}
      <SectionCard
        title="Onde podemos crescer?"
        action={
          <TouchableOpacity onPress={() => router.push('/admin/intelligence' as any)}>
            <Text style={styles.link}>Ver todas →</Text>
          </TouchableOpacity>
        }
      >
        {opportunities.length === 0 ? (
          <Text style={hqStyles.empty}>
            Nenhuma oportunidade sugerida com base suficiente — hipóteses só aparecem com padrões nos dados.
          </Text>
        ) : (
          <View style={hqStyles.row}>
            {opportunities.slice(0, 3).map((o: any) => (
              <InsightCard
                key={o.id}
                kind="opportunity"
                title={o.title}
                observed={o.observed}
                opportunity={o.suggestion}
                onPress={() => router.push((o.href || '/admin/intelligence') as any)}
              />
            ))}
          </View>
        )}
      </SectionCard>

      {/* REDE */}
      <SectionCard title="Rede">
        <View style={hqStyles.row}>
          <StoryKpi
            size="sm"
            label="Clientes"
            value={(d.customersTotal || 0).toLocaleString('pt-BR')}
            tone="blue"
            onPress={() => router.push('/admin/customers' as any)}
            footer={`+${d.customersNew7d || 0} em 7d`}
          />
          <StoryKpi
            size="sm"
            label="Comércios ativos"
            value={(d.shopsActive || 0).toLocaleString('pt-BR')}
            tone="green"
            onPress={() => router.push('/admin/shops' as any)}
          />
          <StoryKpi
            size="sm"
            label="Cidades ativas"
            value={(d.citiesActive || 0).toLocaleString('pt-BR')}
            tone="blue"
            onPress={() => router.push('/admin/cities' as any)}
          />
          <StoryKpi
            size="sm"
            label="Tickets abertos"
            value={(d.openTickets || 0).toLocaleString('pt-BR')}
            tone={(d.openTickets || 0) > 0 ? 'amber' : 'green'}
            onPress={() => router.push('/admin/tickets' as any)}
          />
        </View>
        <View style={[hqStyles.row, { marginTop: 8, alignItems: 'center' }]}>
          <HealthDot label="API" status={health?.platform?.status} />
          <HealthDot label="Frota" status={health?.fleet?.status} />
          <HealthDot label="Pagamentos" status={health?.payments?.status} />
        </View>
      </SectionCard>

      <View style={styles.actions}>
        <TouchableOpacity style={hqStyles.btn} onPress={() => router.push('/admin/problems' as any)}>
          <Text style={hqStyles.btnText}>Central de Problemas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={hqStyles.btnGhost} onPress={() => router.push('/admin/intelligence' as any)}>
          <Text style={hqStyles.btnGhostText}>Inteligência</Text>
        </TouchableOpacity>
        <TouchableOpacity style={hqStyles.btnGhost} onPress={() => router.push('/admin/ops' as any)}>
          <Text style={hqStyles.btnGhostText}>Operação</Text>
        </TouchableOpacity>
        <TouchableOpacity style={hqStyles.btnGhost} onPress={() => router.push('/admin/map' as any)}>
          <Text style={hqStyles.btnGhostText}>Mapa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={hqStyles.btnGhost}
          onPress={() => router.push('/admin/overview?present=1' as any)}
        >
          <Text style={hqStyles.btnGhostText}>Modo apresentação</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 4 },
  link: { color: hq.greenDark, fontWeight: '800', fontSize: 12 },
  attentionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: hq.line,
    backgroundColor: hq.panel,
  },
  attentionCtaHot: {
    borderColor: hq.red,
    backgroundColor: 'rgba(220, 38, 38, 0.06)',
  },
  attnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: hq.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionTitle: { color: hq.text, fontWeight: '800', fontSize: 16 },
  attentionSub: { color: hq.muted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  attentionGo: { color: hq.greenDark, fontWeight: '800', fontSize: 13 },
  metricSwitch: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricBtn: {
    borderWidth: 1,
    borderColor: hq.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metricBtnOn: { borderColor: hq.green, backgroundColor: hq.greenDim },
  metricBtnText: { color: hq.muted, fontWeight: '700', fontSize: 11 },
  metricBtnTextOn: { color: hq.greenDark },
  split: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  splitMain: { flexGrow: 1, flexBasis: 360, minWidth: 280 },
  splitSide: { flexGrow: 1, flexBasis: 220, minWidth: 200, maxWidth: 320 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: hq.line,
  },
  alertText: { flex: 1, color: hq.text, fontWeight: '600', fontSize: 13 },
  chev: { color: hq.faint, fontSize: 18, fontWeight: '700' },
  heatHint: { color: hq.faint, fontSize: 11, marginTop: 10, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, marginBottom: 24 },
});
