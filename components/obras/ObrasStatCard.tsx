import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { obrasTheme } from '@/constants/obrasTheme';

type Props = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  hint?: string;
};

export function ObrasStatCard({ label, value, icon, color = obrasTheme.colors.primary, hint }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: obrasTheme.fontSize.lg,
    fontWeight: '800',
    color: obrasTheme.colors.text,
  },
  label: {
    fontSize: obrasTheme.fontSize.xs,
    color: obrasTheme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  hint: {
    fontSize: obrasTheme.fontSize.xs,
    color: obrasTheme.colors.textMuted,
    marginTop: 4,
  },
});
