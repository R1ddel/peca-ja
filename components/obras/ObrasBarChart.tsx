import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { obrasTheme } from '@/constants/obrasTheme';
import { formatBRL } from '@/utils/obrasStore';

type BarData = { label: string; value: number; color: string };

type Props = {
  title: string;
  bars: BarData[];
  maxValue?: number;
};

export function ObrasBarChart({ title, bars, maxValue }: Props) {
  const max = maxValue ?? Math.max(...bars.map((b) => b.value), 1);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {bars.map((bar) => (
        <View key={bar.label} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>{bar.label}</Text>
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.max(4, (bar.value / max) * 100)}%` as any, backgroundColor: bar.color },
              ]}
            />
          </View>
          <Text style={styles.value}>{formatBRL(bar.value)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
  },
  title: {
    fontSize: obrasTheme.fontSize.md,
    fontWeight: '700',
    color: obrasTheme.colors.text,
    marginBottom: obrasTheme.spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: { width: 72, fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textSecondary, fontWeight: '600' },
  barBg: {
    flex: 1,
    height: 14,
    backgroundColor: obrasTheme.colors.border,
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 7 },
  value: { width: 80, fontSize: 10, fontWeight: '700', color: obrasTheme.colors.text, textAlign: 'right' },
});
