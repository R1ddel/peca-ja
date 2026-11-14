import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { obrasTheme } from '@/constants/obrasTheme';

type Props = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: { label: string; onPress: () => void };
  accent?: string;
};

export function ObrasHeader({
  title = 'Obras',
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  accent = obrasTheme.colors.primary,
}: Props) {
  return (
    <View style={[styles.wrap, { borderBottomColor: accent + '30' }]}>
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack ?? (() => router.back())}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={obrasTheme.colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.logo, { backgroundColor: accent }]}>
            <Ionicons name="business" size={18} color={obrasTheme.colors.white} />
          </View>
        )}
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightAction ? (
          <TouchableOpacity onPress={rightAction.onPress}>
            <Text style={[styles.action, { color: accent }]}>{rightAction.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: obrasTheme.spacing.md,
    paddingVertical: obrasTheme.spacing.md,
    backgroundColor: obrasTheme.colors.surface,
    borderBottomWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1 },
  title: { fontSize: obrasTheme.fontSize.lg, fontWeight: '800', color: obrasTheme.colors.text },
  subtitle: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 2 },
  action: { fontSize: obrasTheme.fontSize.sm, fontWeight: '700' },
});
