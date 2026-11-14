import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MacroItem } from '@/types/obras';
import { obrasTheme, planningPeriodLabels } from '@/constants/obrasTheme';

type Props = {
  items: MacroItem[];
};

export function ObrasPlanningTimeline({ items }: Props) {
  return (
    <View style={styles.wrap}>
      {items.map((item, idx) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.lineCol}>
            <View style={[styles.dot, item.progress >= 100 && styles.dotDone]} />
            {idx < items.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.period}>{planningPeriodLabels[item.period]}</Text>
            </View>
            <Text style={styles.desc}>{item.description}</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${item.progress}%` as any }]} />
              </View>
              <Text style={styles.progressText}>{item.progress}%</Text>
            </View>
            <Text style={styles.dates}>
              {formatDate(item.startDate)} → {formatDate(item.endDate)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: 'row', gap: 12 },
  lineCol: { alignItems: 'center', width: 16 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: obrasTheme.colors.primary,
    borderWidth: 2,
    borderColor: obrasTheme.colors.primaryLight,
  },
  dotDone: { backgroundColor: obrasTheme.colors.success },
  line: { flex: 1, width: 2, backgroundColor: obrasTheme.colors.border, minHeight: 40 },
  content: {
    flex: 1,
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    marginBottom: obrasTheme.spacing.md,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: obrasTheme.fontSize.md, fontWeight: '700', color: obrasTheme.colors.text, flex: 1 },
  period: {
    fontSize: 10,
    fontWeight: '700',
    color: obrasTheme.colors.secondary,
    backgroundColor: obrasTheme.colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  desc: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: obrasTheme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: obrasTheme.colors.primary, borderRadius: 4 },
  progressText: { fontSize: obrasTheme.fontSize.xs, fontWeight: '700', color: obrasTheme.colors.text },
  dates: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 6 },
});
