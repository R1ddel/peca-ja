/**
 * Inteligência do Peça Já — visual analytics (dados reais).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { useHqMode } from '@/app/admin/_hqContext';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminIntelligence } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';
import {
  ErrBox,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusPill,
  EnvBanner,
} from '@/app/admin/_components';
import {
  StoryKpi,
  TrendChart,
  HeatmapGrid,
  InsightCard,
  DistBars,
  WaterfallBars,
} from '@/app/admin/_viz';

export default function AdminIntelligenceScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const { mode, environmentLabel, isProjection } = useHqMode();
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<'orders' | 'gmv' | 'revenue'>('orders');
  const [heatMode, setHeatMode] = useState<'orders' | 'cancellations'>('orders');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminIntelligence(token, { hqMode: mode, sinceDays: days });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao carregar inteligência.');
        return;
      }
      setData((res as any).intelligence);
    } finally {
      setLoading(false);
    }
  }, [mode, days]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  const meta = data?.meta || {};
  const current = data?.current || {};
  const previous = data?.previous || {};
  const growth: any[] = data?.growth || [];
  const insights: any[] = data?.insights || [];
  const anomalies: any[] = data?.anomalies || [];
  const heat: number[][] =
    heatMode === 'cancellations'
      ? data?.heatmap?.cancellations || []
      : data?.heatmap?.orders || [];
  const cities: any[] = data?.cities || [];
  const shops: any[] = data?.shops || [];
  const opportunities: any[] = data?.opportunities || [];

  const gOrders = growth.find((g) => g.key === 'orders');
  const gGmv = growth.find((g) => g.key === 'gmv');
  const gRev = growth.find((g) => g.key === 'revenue');

  const cityBars = cities.slice(0, 8).map((c) => ({
    label: c.city,
    value: metric === 'gmv' ? Number(c.gmv || 0) : Number(c.orders || 0),
  }));

  const dropCities = cities
    .filter((c) => Number(c.cancelRate || 0) >= 10)
    .slice(0, 5)
    .map((c) => ({
      label: `${c.city} · canc ${c.cancelRate}%`,
      value: Number(c.orders || 0),
      pct: Number(c.cancelRate || 0),
    }));

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <EnvBanner mode={mode} label={environmentLabel} />
      <PageHeader
        title="Inteligência do Peça Já"
        lead="Crescimento · quedas · horários · anomalias — só com dados observados"
        right={
          data?.problemsOpen > 0 ? (
            <TouchableOpacity onPress={() => router.push('/admin/problems' as any)}>
              <StatusPill label={`${data.problemsOpen} problemas`} tone="red" />
            </TouchableOpacity>
          ) : (
            <StatusPill label="Operação estável" tone="green" />
          )
        }
      />
      <ErrBox message={err} />

      <View style={hqStyles.row}>
        {[7, 30, 90].map((d) => (
          <TouchableOpacity
            key={d}
            style={[hqStyles.btnGhost, days === d && { borderColor: hq.green, backgroundColor: hq.greenDim }]}
            onPress={() => setDays(d)}
          >
            <Text style={hqStyles.btnGhostText}>{d} dias</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.meta}>
        {meta.periodLabel || '—'} vs {meta.compareLabel || '—'} · base {meta.orderBase ?? 0} pedidos
        {isProjection ? ' · cenário de projeção' : ' · operação real'}
      </Text>

      <View style={hqStyles.row}>
        <StoryKpi
          size="lg"
          label="Pedidos"
          value={(current.orders || 0).toLocaleString('pt-BR')}
          deltaPct={gOrders?.deltaPct ?? null}
          deltaLabel="vs período anterior"
          tone="blue"
        />
        <StoryKpi
          size="lg"
          label="GMV"
          value={formatPrice(current.gmv || 0)}
          deltaPct={gGmv?.deltaPct ?? null}
          deltaLabel="vs período anterior"
          tone="green"
        />
      </View>
      <View style={hqStyles.row}>
        <StoryKpi
          label="Receita Peça Já"
          value={formatPrice(current.revenue || 0)}
          deltaPct={gRev?.deltaPct ?? null}
          deltaLabel="vs período anterior"
          tone="green"
          footer="Separado do GMV"
        />
        <StoryKpi
          label="Ticket médio"
          value={formatPrice(current.ticket || 0)}
          deltaPct={growth.find((g) => g.key === 'ticket')?.deltaPct ?? null}
          tone="blue"
        />
        <StoryKpi
          label="Cancelamento"
          value={`${current.cancelRate || 0}%`}
          tone={(current.cancelRate || 0) > 8 ? 'red' : 'amber'}
          footer={`${current.canceled || 0} cancelados`}
        />
      </View>

      <SectionCard
        title="Como estamos crescendo?"
        action={
          <View style={styles.switchRow}>
            {(['orders', 'gmv', 'revenue'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, metric === m && styles.chipOn]}
                onPress={() => setMetric(m)}
              >
                <Text style={[styles.chipText, metric === m && styles.chipTextOn]}>
                  {m === 'orders' ? 'Pedidos' : m === 'gmv' ? 'GMV' : 'Receita'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
      >
        <TrendChart
          series={[previous.orders || 0, current.orders || 0].map((_, i) => {
            if (metric === 'gmv') return i === 0 ? previous.gmv || 0 : current.gmv || 0;
            if (metric === 'revenue') return i === 0 ? previous.revenue || 0 : current.revenue || 0;
            return i === 0 ? previous.orders || 0 : current.orders || 0;
          })}
          labels={['Período anterior', 'Período atual']}
          color={metric === 'orders' ? hq.blue : hq.green}
          formatValue={(n) =>
            metric === 'orders' ? n.toLocaleString('pt-BR') : formatPrice(n)
          }
        />
        <Text style={styles.note}>
          Comparação direta período atual vs anterior ({days}d). Sem inventar tendência diária quando a série não existe.
        </Text>
      </SectionCard>

      <SectionCard title="Onde estamos caindo? / concentração">
        {dropCities.length === 0 ? (
          <Text style={hqStyles.empty}>
            Nenhuma cidade com cancelamento ≥ 10% no período — ou base insuficiente.
          </Text>
        ) : (
          <DistBars items={dropCities} color={hq.red} />
        )}
      </SectionCard>

      <SectionCard
        title="Mapa de calor"
        action={
          <View style={styles.switchRow}>
            {(['orders', 'cancellations'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, heatMode === m && styles.chipOn]}
                onPress={() => setHeatMode(m)}
              >
                <Text style={[styles.chipText, heatMode === m && styles.chipTextOn]}>
                  {m === 'orders' ? 'Pedidos' : 'Cancelamentos'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
      >
        <HeatmapGrid grid={heat} />
        <Text style={styles.note}>
          Pico:{' '}
          {data?.heatmap?.peak?.value
            ? `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][data.heatmap.peak.dow]} ${data.heatmap.peak.hour}h (${data.heatmap.peak.value})`
            : 'dados insuficientes'}
        </Text>
      </SectionCard>

      <SectionCard title="Resumo executivo">
        <View style={hqStyles.row}>
          {insights.length === 0 ? (
            <Text style={hqStyles.empty}>Sem insights significativos (variação &lt; 5% ou sem base).</Text>
          ) : (
            insights.map((ins) => (
              <InsightCard
                key={ins.id}
                kind={ins.kind}
                title={ins.title}
                observed={ins.observed}
                analysis={ins.detail}
                opportunity={ins.suggestion}
                onPress={() => ins.href && router.push(ins.href as any)}
              />
            ))
          )}
        </View>
      </SectionCard>

      <SectionCard title="Anomalias">
        {anomalies.map((a) => (
          <InsightCard
            key={a.id}
            kind={String(a.title || '').includes('abaixo') ? 'drop' : 'attention'}
            title={a.title}
            observed={a.observed}
            analysis={a.detail}
          />
        ))}
      </SectionCard>

      <SectionCard title="Cidades · ranking visual">
        <DistBars
          items={cityBars}
          color={metric === 'orders' ? hq.blue : hq.green}
        />
      </SectionCard>

      <SectionCard title="Comércios por GMV">
        <DistBars
          items={shops.slice(0, 8).map((s) => ({ label: s.name, value: Number(s.gmv || 0) }))}
          color={hq.green}
        />
      </SectionCard>

      <SectionCard title="Rendimento (visão simplificada do período)">
        <WaterfallBars
          steps={[
            { label: 'GMV', value: Number(current.gmv || 0), kind: 'pos' },
            { label: 'Receita', value: Number(current.revenue || 0), kind: 'pos' },
            {
              label: 'Repasses*',
              value: Math.max(0, Number(current.gmv || 0) - Number(current.revenue || 0)),
              kind: 'neg',
            },
          ]}
        />
        <Text style={styles.note}>*Aproximação: GMV − receita Peça Já. Sem inventar custos.</Text>
      </SectionCard>

      <SectionCard title="Oportunidades e estratégias (hipóteses)">
        <View style={hqStyles.row}>
          {opportunities.length === 0 ? (
            <Text style={hqStyles.empty}>Nenhuma oportunidade sugerida com base suficiente.</Text>
          ) : (
            opportunities.map((o) => (
              <InsightCard
                key={o.id}
                kind="opportunity"
                title={o.title}
                observed={o.observed}
                opportunity={o.suggestion}
                onPress={() => router.push((o.href || '/admin/problems') as any)}
              />
            ))
          )}
        </View>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  meta: { color: hq.muted, fontSize: 12, marginBottom: 10 },
  note: { color: hq.faint, fontSize: 11, marginTop: 10, lineHeight: 16 },
  switchRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: hq.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipOn: { borderColor: hq.green, backgroundColor: hq.greenDim },
  chipText: { color: hq.muted, fontWeight: '700', fontSize: 11 },
  chipTextOn: { color: hq.greenDark },
});
