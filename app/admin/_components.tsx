/**
 * Componentes compartilhados do Command Center.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { hq, hqStyles } from '@/app/admin/_ui';
import { Sparkline } from '@/app/admin/_viz';

export function KpiCard({
  label,
  value,
  tone,
  hint,
  onPress,
}: {
  label: string;
  value: string | number;
  tone?: 'green' | 'amber' | 'red' | 'blue';
  hint?: string;
  onPress?: () => void;
}) {
  const accent =
    tone === 'green'
      ? hq.green
      : tone === 'amber'
        ? hq.amber
        : tone === 'red'
          ? hq.red
          : tone === 'blue'
            ? hq.blue
            : hq.line;
  const Inner = (
    <View
      style={[
        hqStyles.card,
        styles.kpi,
        { borderTopWidth: 3, borderTopColor: accent },
      ]}
    >
      <Text style={hqStyles.kpiValue}>{value}</Text>
      <Text style={hqStyles.kpiLabel}>{label}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={styles.kpiWrap} activeOpacity={0.85}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.kpiWrap}>{Inner}</View>;
}

export function StatusPill({
  label,
  tone = 'blue',
}: {
  label: string;
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'muted';
}) {
  const bg =
    tone === 'green'
      ? hq.greenDim
      : tone === 'amber'
        ? hq.amberDim
        : tone === 'red'
          ? hq.redDim
          : tone === 'muted'
            ? hq.panel2
            : hq.blueDim;
  const color =
    tone === 'green'
      ? hq.greenDark
      : tone === 'amber'
        ? hq.amber
        : tone === 'red'
          ? hq.red
          : tone === 'muted'
            ? hq.muted
            : hq.blue;
  return (
    <View style={[hqStyles.pill, { backgroundColor: bg }]}>
      <Text style={[hqStyles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function HealthDot({
  label,
  status,
}: {
  label: string;
  status?: string;
}) {
  const ok = status === 'online' || status === 'connected';
  const warn = status === 'degraded' || status === 'not_configured';
  const color = ok ? hq.green : warn ? hq.amber : hq.red;
  return (
    <View style={styles.healthItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.healthText}>
        {label} · {status || '—'}
      </Text>
    </View>
  );
}

export function LiveBadge({ text = 'AO VIVO' }: { text?: string }) {
  return (
    <View style={styles.live}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>{text}</Text>
    </View>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={hqStyles.card}>
      <View style={styles.sectionHead}>
        <Text style={hqStyles.h2}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** Mini gráfico de barras (SVG-free) para séries simples. */
export function MiniBars({
  values,
  height = 72,
  color = hq.green,
}: {
  values: number[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <View style={[styles.bars, { height }]}>
      {values.map((v, i) => (
        <View key={i} style={styles.barCol}>
          <View
            style={[
              styles.bar,
              {
                height: Math.max(4, (v / max) * (height - 8)),
                backgroundColor: color,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export function LoadingBlock() {
  return (
    <View style={{ padding: 48, alignItems: 'center' }}>
      <ActivityIndicator color={hq.green} />
    </View>
  );
}

export function ErrBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={hqStyles.errBox}>
      <Text style={hqStyles.errText}>{message}</Text>
    </View>
  );
}

export function PageHeader({
  title,
  lead,
  right,
}: {
  title: string;
  lead?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.pageHead}>
      <View style={{ flex: 1 }}>
        <Text style={hqStyles.h1}>{title}</Text>
        {lead ? <Text style={[hqStyles.lead, { marginTop: 4 }]}>{lead}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** KPI executivo com delta, meta e status. */
export function ExecKpi({
  label,
  value,
  deltaPct,
  deltaLabel = 'vs ontem',
  target,
  targetLabel = 'Meta',
  tone,
  onPress,
  spark,
}: {
  label: string;
  value: string | number;
  deltaPct?: number | null;
  deltaLabel?: string;
  target?: string | number | null;
  targetLabel?: string;
  tone?: 'green' | 'amber' | 'red' | 'blue';
  onPress?: () => void;
  spark?: number[];
}) {
  const accent =
    tone === 'green'
      ? hq.green
      : tone === 'amber'
        ? hq.amber
        : tone === 'red'
          ? hq.red
          : tone === 'blue'
            ? hq.blue
            : hq.line;
  const deltaColor =
    deltaPct == null ? hq.muted : deltaPct >= 0 ? hq.greenDark : hq.red;
  const deltaText =
    deltaPct == null
      ? 'sem base'
      : (deltaPct >= 0 ? '▲ ' : '▼ ') + Math.abs(deltaPct) + '% ' + deltaLabel;

  let status: string | null = null;
  let statusTone: 'green' | 'amber' | 'red' | 'muted' = 'muted';
  let targetPct: number | null = null;
  if (target != null && typeof value === 'number' && typeof target === 'number' && target > 0) {
    targetPct = Math.round((value / target) * 1000) / 10;
    status = targetPct >= 100 ? 'ACIMA DA META' : targetPct >= 85 ? 'PERTO DA META' : 'ABAIXO DA META';
    statusTone = targetPct >= 100 ? 'green' : targetPct >= 85 ? 'amber' : 'red';
  }

  const Inner = (
    <View style={[hqStyles.card, styles.execKpi, { borderTopWidth: 3, borderTopColor: accent }]}>
      <Text style={hqStyles.kpiLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={hqStyles.kpiValue}>{value}</Text>
          <Text style={[styles.delta, { color: deltaColor }]}>{deltaText}</Text>
        </View>
        {spark?.length ? (
          <Sparkline
            values={spark}
            width={72}
            height={32}
            color={accent === hq.line ? hq.green : accent}
          />
        ) : null}
      </View>
      {target != null ? (
        <Text style={styles.metaLine}>
          {targetLabel}: {typeof target === 'number' ? target.toLocaleString('pt-BR') : target}
          {targetPct != null ? ` · ${targetPct}%` : ''}
        </Text>
      ) : null}
      {status ? <StatusPill label={status} tone={statusTone} /> : null}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={styles.execWrap} activeOpacity={0.85}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.execWrap}>{Inner}</View>;
}

export function EnvBanner({ mode, label }: { mode: 'real' | 'projection'; label: string }) {
  const isProj = mode === 'projection';
  return (
    <View
      style={[
        styles.envBanner,
        { backgroundColor: isProj ? hq.amberDim : hq.greenDim, borderColor: isProj ? hq.amber : hq.green },
      ]}
    >
      <Text style={[styles.envText, { color: isProj ? hq.amber : hq.greenDark }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiWrap: { flexGrow: 1, minWidth: 150, maxWidth: 220 },
  kpi: { minHeight: 108 },
  kpiHint: { color: hq.faint, fontSize: 11, marginTop: 8, fontWeight: '600' },
  healthItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  healthText: { color: hq.muted, fontSize: 12, fontWeight: '600' },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: hq.redDim,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: hq.red,
  },
  liveText: { color: hq.red, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    width: '100%',
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '80%', borderRadius: 4, minHeight: 4 },
  pageHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  execWrap: { flexGrow: 1, minWidth: 160, maxWidth: 240 },
  execKpi: { minHeight: 140, gap: 6 },
  delta: { fontSize: 12, fontWeight: '700' },
  metaLine: { color: hq.muted, fontSize: 11, fontWeight: '600' },
  envBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  envText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
});
