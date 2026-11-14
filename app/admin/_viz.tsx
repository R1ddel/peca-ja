/**
 * Kit visual Peça Já HQ — gráficos ilustrativos sem reanimated.
 * Dados reais apenas; sem números decorativos.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Defs, LinearGradient, Stop, Polyline } from 'react-native-svg';
import { hq, hqStyles } from '@/app/admin/_ui';

function toneColor(tone?: 'green' | 'amber' | 'red' | 'blue' | 'muted') {
  if (tone === 'amber') return hq.amber;
  if (tone === 'red') return hq.red;
  if (tone === 'blue') return hq.blue;
  if (tone === 'muted') return hq.muted;
  return hq.green;
}

/** Sparkline / área — série real. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = hq.green,
  fill = true,
  strokeWidth = 2,
}: {
  values?: number[] | null;
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  const pts = useMemo(() => {
    const arr = (values || []).filter((v) => Number.isFinite(v));
    if (arr.length < 2) return null;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const span = Math.max(max - min, 0.0001);
    const step = width / (arr.length - 1);
    return arr.map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return { x, y, v };
    });
  }, [values, width, height]);

  if (!pts) {
    return (
      <View style={{ width, height, justifyContent: 'center' }}>
        <Text style={styles.insuf}>sem série</Text>
      </View>
    );
  }

  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `M0,${height} L${pts.map((p) => `${p.x},${p.y}`).join(' L')} L${width},${height} Z`;
  const gid = `sg_${Math.abs(Math.round(color.split('').reduce((a, c) => a + c.charCodeAt(0), 0)))}_${width}`;

  return (
    <Svg width={width} height={height}>
      {fill ? (
        <>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.28" />
              <Stop offset="1" stopColor={color} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Path d={area} fill={`url(#${gid})`} />
        </>
      ) : null}
      <Polyline points={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill={color} />
    </Svg>
  );
}

/** Gráfico de área/linha maior com hover simples (web). */
export function TrendChart({
  series,
  compare,
  target,
  labels,
  height = 180,
  color = hq.green,
  compareColor = hq.faint,
  formatValue,
}: {
  series: number[];
  compare?: number[];
  target?: number | null;
  labels?: string[];
  height?: number;
  color?: string;
  compareColor?: string;
  formatValue?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const pad = 12;

  const all = [...series, ...(compare || []), target != null ? target : 0].filter((n) => Number.isFinite(n));
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 1);
  const span = Math.max(max - min, 0.0001);

  const toPts = (arr: number[]) => {
    if (!arr.length) return [];
    const step = (width - pad * 2) / Math.max(arr.length - 1, 1);
    return arr.map((v, i) => ({
      x: pad + i * step,
      y: pad + (height - pad * 2) - ((v - min) / span) * (height - pad * 2),
      v,
    }));
  };

  const main = toPts(series);
  const prev = compare?.length ? toPts(compare) : [];
  const fmt = formatValue || ((n: number) => n.toLocaleString('pt-BR'));

  if (series.length < 2) {
    return (
      <View style={[styles.chartEmpty, { height }]}>
        <Text style={hqStyles.empty}>Dados insuficientes para esta análise.</Text>
      </View>
    );
  }

  const line = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area =
    main.length > 0
      ? `M${main[0].x},${height - pad} L${main.map((p) => `${p.x},${p.y}`).join(' L')} L${main[main.length - 1].x},${height - pad} Z`
      : '';

  const hi = hover != null ? main[hover] : null;
  const hiLabel = hover != null && labels?.[hover] ? labels[hover] : hover != null ? `D${hover + 1}` : '';
  const hiPrev = hover != null && prev[hover] ? prev[hover].v : null;
  const hiDelta =
    hi && hiPrev != null && hiPrev !== 0
      ? Math.round(((hi.v - hiPrev) / hiPrev) * 1000) / 10
      : null;

  return (
    <View
      style={styles.chartWrap}
      // @ts-expect-error web mouse
      onMouseLeave={() => setHover(null)}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.22" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        {[0.25, 0.5, 0.75].map((p) => (
          <Line
            key={p}
            x1={pad}
            x2={width - pad}
            y1={pad + (height - pad * 2) * p}
            y2={pad + (height - pad * 2) * p}
            stroke={hq.line}
            strokeWidth={1}
          />
        ))}
        {target != null && Number.isFinite(target) ? (
          <Line
            x1={pad}
            x2={width - pad}
            y1={pad + (height - pad * 2) - ((target - min) / span) * (height - pad * 2)}
            y2={pad + (height - pad * 2) - ((target - min) / span) * (height - pad * 2)}
            stroke={hq.amber}
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        ) : null}
        {prev.length > 1 ? (
          <Polyline
            points={line(prev)}
            fill="none"
            stroke={compareColor}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        ) : null}
        <Path d={area} fill="url(#trendFill)" />
        <Polyline points={line(main)} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        {main.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hover === i ? 5 : 0}
            fill={color}
            onPress={() => setHover(i)}
            // @ts-expect-error web
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {/* hit areas */}
        {main.map((p, i) => (
          <Rect
            key={`h${i}`}
            x={p.x - 12}
            y={0}
            width={24}
            height={height}
            fill="transparent"
            onPress={() => setHover(i)}
            // @ts-expect-error web
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </Svg>
      {hi ? (
        <View style={styles.tooltip}>
          <Text style={styles.tipTitle}>{hiLabel}</Text>
          <Text style={styles.tipVal}>{fmt(hi.v)}</Text>
          {hiPrev != null ? <Text style={styles.tipMeta}>Anterior: {fmt(hiPrev)}</Text> : null}
          {hiDelta != null ? (
            <Text style={{ color: hiDelta >= 0 ? hq.greenDark : hq.red, fontWeight: '800', fontSize: 12 }}>
              {hiDelta >= 0 ? '▲' : '▼'} {Math.abs(hiDelta)}%
            </Text>
          ) : null}
          {target != null ? <Text style={styles.tipMeta}>Meta: {fmt(target)}</Text> : null}
        </View>
      ) : null}
      <View style={styles.legendRow}>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: color }]} />
          <Text style={styles.legText}>Período atual</Text>
        </View>
        {compare?.length ? (
          <View style={styles.legItem}>
            <View style={[styles.legDot, { backgroundColor: compareColor }]} />
            <Text style={styles.legText}>Período anterior</Text>
          </View>
        ) : null}
        {target != null ? (
          <View style={styles.legItem}>
            <View style={[styles.legDot, { backgroundColor: hq.amber }]} />
            <Text style={styles.legText}>Meta</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Gauge circular 0–100%. */
export function GaugeRing({
  pct,
  size = 88,
  label,
  sub,
  tone = 'green',
}: {
  pct: number | null;
  size?: number;
  label?: string;
  sub?: string;
  tone?: 'green' | 'amber' | 'red' | 'blue';
}) {
  const color = toneColor(tone);
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const offset = c - (value / 100) * c;

  return (
    <View style={{ alignItems: 'center', width: size + 24 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={hq.line} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.gaugeCenter]}>
          <Text style={styles.gaugePct}>{pct == null ? '—' : `${Math.round(value)}%`}</Text>
        </View>
      </View>
      {label ? <Text style={styles.gaugeLabel}>{label}</Text> : null}
      {sub ? <Text style={styles.gaugeSub}>{sub}</Text> : null}
    </View>
  );
}

/** Barras horizontais de distribuição. */
export function DistBars({
  items,
  color = hq.green,
}: {
  items: { label: string; value: number; pct?: number }[];
  color?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) {
    return <Text style={hqStyles.empty}>Dados insuficientes para esta análise.</Text>;
  }
  return (
    <View style={{ gap: 10 }}>
      {items.map((it) => {
        const pct = it.pct != null ? it.pct : Math.round((it.value / max) * 1000) / 10;
        const w = Math.max(4, (it.value / max) * 100);
        return (
          <View key={it.label}>
            <View style={styles.distHead}>
              <Text style={styles.distLabel}>{it.label}</Text>
              <Text style={styles.distVal}>
                {it.value.toLocaleString('pt-BR')}
                {it.pct != null ? ` · ${it.pct}%` : ''}
              </Text>
            </View>
            <View style={styles.distTrack}>
              <View style={[styles.distFill, { width: `${w}%` as any, backgroundColor: color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Funil / fluxo de etapas. */
export function FlowFunnel({
  stages,
}: {
  stages: { label: string; value: number; tone?: 'green' | 'amber' | 'red' | 'blue' }[];
}) {
  if (!stages.length || stages.every((s) => !s.value)) {
    return <Text style={hqStyles.empty}>Dados insuficientes para esta análise.</Text>;
  }
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <View style={{ gap: 8 }}>
      {stages.map((s, i) => {
        const w = 40 + (s.value / max) * 60;
        const prev = i > 0 ? stages[i - 1].value : null;
        const drop =
          prev != null && prev > 0 ? Math.round(((prev - s.value) / prev) * 1000) / 10 : null;
        return (
          <View key={s.label} style={{ alignItems: 'center' }}>
            {i > 0 ? <Text style={styles.flowArrow}>↓{drop != null && drop > 0 ? ` ${drop}%` : ''}</Text> : null}
            <View
              style={[
                styles.flowStep,
                {
                  width: `${w}%` as any,
                  backgroundColor: toneColor(s.tone) + '22',
                  borderColor: toneColor(s.tone),
                },
              ]}
            >
              <Text style={styles.flowLabel}>{s.label}</Text>
              <Text style={styles.flowVal}>{s.value.toLocaleString('pt-BR')}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Heatmap dia × hora. */
export function HeatmapGrid({
  grid,
  onCellPress,
}: {
  grid: number[][];
  onCellPress?: (dow: number, hour: number, value: number) => void;
}) {
  const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const max = Math.max(1, ...grid.flatMap((r) => r || [0]));
  if (!grid.length) {
    return <Text style={hqStyles.empty}>Dados insuficientes para esta análise.</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.heatHead}>
          <Text style={styles.heatCorner}> </Text>
          {Array.from({ length: 24 }, (_, h) => (
            <Text key={h} style={styles.heatH}>
              {h}
            </Text>
          ))}
        </View>
        {grid.map((row, dow) => (
          <View key={dow} style={styles.heatRow}>
            <Text style={styles.heatDow}>{DOW[dow]}</Text>
            {(row || []).map((v, h) => {
              const t = v / max;
              const bg =
                !v
                  ? hq.panel2
                  : t > 0.75
                    ? 'rgba(0,168,107,0.9)'
                    : t > 0.5
                      ? 'rgba(0,168,107,0.55)'
                      : t > 0.25
                        ? 'rgba(0,168,107,0.3)'
                        : 'rgba(0,168,107,0.12)';
              return (
                <TouchableOpacity
                  key={h}
                  accessibilityLabel={`${DOW[dow]} ${h}h: ${v}`}
                  onPress={() => onCellPress?.(dow, h, v)}
                  style={[styles.heatCell, { backgroundColor: bg }]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** Waterfall financeiro simplificado. */
export function WaterfallBars({
  steps,
}: {
  steps: { label: string; value: number; kind?: 'pos' | 'neg' | 'total' }[];
}) {
  if (!steps.length) {
    return <Text style={hqStyles.empty}>Dados insuficientes para esta análise.</Text>;
  }
  const max = Math.max(...steps.map((s) => Math.abs(s.value)), 1);
  return (
    <View style={styles.waterfall}>
      {steps.map((s) => {
        const h = Math.max(8, (Math.abs(s.value) / max) * 100);
        const color =
          s.kind === 'total' ? hq.blue : s.kind === 'neg' || s.value < 0 ? hq.red : hq.green;
        return (
          <View key={s.label} style={styles.wfCol}>
            <Text style={styles.wfVal}>
              {s.value < 0 ? '−' : ''}
              {Math.abs(s.value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </Text>
            <View style={[styles.wfBar, { height: h, backgroundColor: color }]} />
            <Text style={styles.wfLabel} numberOfLines={2}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Card de insight com narrativa visual. */
export function InsightCard({
  kind,
  title,
  observed,
  analysis,
  opportunity,
  spark,
  onPress,
}: {
  kind: 'growth' | 'drop' | 'attention' | 'ops' | 'info' | 'opportunity';
  title: string;
  observed: string;
  analysis?: string | null;
  opportunity?: string | null;
  spark?: number[];
  onPress?: () => void;
}) {
  const tone =
    kind === 'drop' || kind === 'attention'
      ? 'red'
      : kind === 'growth'
        ? 'green'
        : kind === 'opportunity'
          ? 'amber'
          : 'blue';
  const color = toneColor(tone);
  const Inner = (
    <View style={[styles.insightCard, { borderLeftColor: color }]}>
      <View style={styles.insightTop}>
        <View style={[styles.insightBadge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.insightBadgeText, { color }]}>
            {kind === 'growth'
              ? 'CRESCIMENTO'
              : kind === 'drop'
                ? 'QUEDA'
                : kind === 'attention'
                  ? 'ATENÇÃO'
                  : kind === 'opportunity'
                    ? 'OPORTUNIDADE'
                    : kind === 'ops'
                      ? 'OPERAÇÃO'
                      : 'INFO'}
          </Text>
        </View>
        {spark?.length ? <Sparkline values={spark} width={72} height={28} color={color} /> : null}
      </View>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.factTag}>DADO OBSERVADO</Text>
      <Text style={styles.insightBody}>{observed}</Text>
      {analysis ? (
        <>
          <Text style={styles.factTag}>ANÁLISE</Text>
          <Text style={styles.insightBody}>{analysis}</Text>
        </>
      ) : null}
      {opportunity ? (
        <>
          <Text style={styles.factTag}>OPORTUNIDADE SUGERIDA</Text>
          <Text style={[styles.insightBody, { color: hq.amber }]}>{opportunity}</Text>
        </>
      ) : null}
      {onPress ? <Text style={styles.insightLink}>Ver dados →</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.insightWrap}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.insightWrap}>{Inner}</View>;
}

/** KPI hero ilustrado. */
export function StoryKpi({
  label,
  value,
  deltaPct,
  deltaLabel = 'vs ontem',
  target,
  spark,
  tone = 'green',
  onPress,
  footer,
  size = 'md',
}: {
  label: string;
  value: string | number;
  deltaPct?: number | null;
  deltaLabel?: string;
  target?: { value: number | string; pct?: number | null } | null;
  spark?: number[];
  tone?: 'green' | 'amber' | 'red' | 'blue';
  onPress?: () => void;
  footer?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const color = toneColor(tone);
  const deltaColor = deltaPct == null ? hq.muted : deltaPct >= 0 ? hq.greenDark : hq.red;
  const Inner = (
    <View
      style={[
        styles.storyKpi,
        size === 'lg' && styles.storyKpiLg,
        size === 'sm' && styles.storyKpiSm,
        { borderTopColor: color },
      ]}
    >
      <Text style={styles.storyLabel}>{label}</Text>
      <View style={styles.storyRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.storyValue, size === 'lg' && { fontSize: 36 }]}>{value}</Text>
          <Text style={[styles.storyDelta, { color: deltaColor }]}>
            {deltaPct == null
              ? 'sem base comparativa'
              : `${deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(deltaPct)}% ${deltaLabel}`}
          </Text>
        </View>
        <Sparkline
          values={spark}
          width={size === 'lg' ? 140 : 96}
          height={size === 'lg' ? 48 : 36}
          color={color}
        />
      </View>
      {target != null ? (
        <View style={{ marginTop: 10 }}>
          <View style={styles.distHead}>
            <Text style={styles.distLabel}>Meta: {String(target.value)}</Text>
            {target.pct != null ? (
              <Text style={styles.distVal}>{Math.round(target.pct)}% do objetivo</Text>
            ) : null}
          </View>
          {target.pct != null ? (
            <View style={styles.distTrack}>
              <View
                style={[
                  styles.distFill,
                  {
                    width: `${Math.max(2, Math.min(100, target.pct))}%` as any,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {footer ? <Text style={styles.storyFooter}>{footer}</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={styles.storyWrap} activeOpacity={0.88}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.storyWrap}>{Inner}</View>;
}

/** Status strip da operação. */
export function OpsStatusStrip({
  items,
}: {
  items: { label: string; value: number | string; tone?: 'green' | 'amber' | 'red' | 'blue' }[];
}) {
  return (
    <View style={styles.statusStrip}>
      {items.map((it) => (
        <View key={it.label} style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: toneColor(it.tone) }]} />
          <Text style={styles.statusVal}>{it.value}</Text>
          <Text style={styles.statusLab}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  insuf: { color: hq.faint, fontSize: 10, fontWeight: '600' },
  chartWrap: {
    width: '100%',
    position: 'relative',
    minHeight: 180,
  },
  chartEmpty: { justifyContent: 'center', alignItems: 'center' },
  tooltip: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: hq.panel,
    borderWidth: 1,
    borderColor: hq.line,
    borderRadius: 10,
    padding: 10,
    minWidth: 140,
    ...(Platform.OS === 'web' ? ({ boxShadow: `0 8px 20px ${hq.shadow}` } as any) : null),
  },
  tipTitle: { color: hq.muted, fontSize: 11, fontWeight: '700' },
  tipVal: { color: hq.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  tipMeta: { color: hq.faint, fontSize: 11, marginTop: 2 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legText: { color: hq.muted, fontSize: 11, fontWeight: '600' },
  gaugeCenter: { alignItems: 'center', justifyContent: 'center' },
  gaugePct: { color: hq.text, fontWeight: '800', fontSize: 16 },
  gaugeLabel: { color: hq.text, fontWeight: '700', fontSize: 12, marginTop: 6, textAlign: 'center' },
  gaugeSub: { color: hq.muted, fontSize: 10, textAlign: 'center', marginTop: 2 },
  distHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  distLabel: { color: hq.text, fontWeight: '700', fontSize: 12 },
  distVal: { color: hq.muted, fontWeight: '600', fontSize: 11 },
  distTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: hq.panel2,
    overflow: 'hidden',
  },
  distFill: { height: '100%', borderRadius: 999 },
  flowArrow: { color: hq.faint, fontSize: 11, fontWeight: '700', marginVertical: 2 },
  flowStep: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  flowLabel: { color: hq.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  flowVal: { color: hq.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  heatHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  heatCorner: { width: 28 },
  heatH: { width: 14, textAlign: 'center', color: hq.faint, fontSize: 8 },
  heatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  heatDow: { width: 28, color: hq.muted, fontSize: 10, fontWeight: '700' },
  heatCell: { width: 14, height: 14, borderRadius: 2, marginRight: 1 },
  waterfall: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 120, paddingTop: 8 },
  wfCol: { flex: 1, alignItems: 'center', gap: 6 },
  wfBar: { width: '70%', borderRadius: 6, minHeight: 8 },
  wfVal: { color: hq.text, fontSize: 10, fontWeight: '800' },
  wfLabel: { color: hq.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  insightWrap: { flexGrow: 1, minWidth: 240, maxWidth: 420 },
  insightCard: {
    backgroundColor: hq.panel,
    borderRadius: hq.radius,
    borderWidth: 1,
    borderColor: hq.line,
    borderLeftWidth: 4,
    padding: 14,
    gap: 4,
    ...(Platform.OS === 'web' ? ({ boxShadow: `0 8px 24px ${hq.shadow}` } as any) : null),
  },
  insightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  insightBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  insightTitle: { color: hq.text, fontSize: 15, fontWeight: '800', marginTop: 6 },
  factTag: {
    color: hq.faint,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  insightBody: { color: hq.muted, fontSize: 12, lineHeight: 17 },
  insightLink: { color: hq.greenDark, fontWeight: '800', fontSize: 12, marginTop: 8 },
  storyWrap: { flexGrow: 1, minWidth: 200, flexBasis: 220 },
  storyKpi: {
    backgroundColor: hq.panel,
    borderRadius: hq.radius,
    borderWidth: 1,
    borderColor: hq.line,
    borderTopWidth: 3,
    padding: 16,
    ...(Platform.OS === 'web' ? ({ boxShadow: `0 8px 24px ${hq.shadow}` } as any) : null),
  },
  storyKpiLg: { minHeight: 168, flexBasis: 320 },
  storyKpiSm: { minHeight: 120 },
  storyLabel: {
    color: hq.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  storyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  storyValue: { color: hq.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  storyDelta: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  storyFooter: { color: hq.faint, fontSize: 11, marginTop: 8, fontWeight: '600' },
  statusStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: hq.panel,
    borderRadius: hq.radius,
    borderWidth: 1,
    borderColor: hq.line,
    padding: 14,
  },
  statusItem: { minWidth: 100, flexGrow: 1, paddingVertical: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  statusVal: { color: hq.text, fontSize: 20, fontWeight: '800' },
  statusLab: { color: hq.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
});
