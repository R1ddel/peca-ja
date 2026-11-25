import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BusinessCategory, categoryConfig, theme } from '@/constants/theme';

interface CategoryChipProps {
  category: BusinessCategory | 'todos';
  selected: boolean;
  onPress: () => void;
  /** layout horizontal pill (legado) ou círculo comercial das refs */
  layout?: 'pill' | 'circle';
}

export function CategoryChip({
  category,
  selected,
  onPress,
  layout = 'circle',
}: CategoryChipProps) {
  const config =
    category === 'todos'
      ? { label: 'Todos', icon: 'grid', color: theme.colors.primary }
      : categoryConfig[category];

  if (layout === 'pill') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          styles.pill,
          selected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
        ]}
      >
        <View style={[styles.pillIcon, selected && styles.pillIconSelected]}>
          <Ionicons
            name={config.icon as keyof typeof Ionicons.glyphMap}
            size={16}
            color={selected ? theme.colors.white : theme.colors.primary}
          />
        </View>
        <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]} numberOfLines={1}>
          {config.label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.circleWrap}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={config.label}
    >
      <View
        style={[
          styles.circle,
          selected && styles.circleSelected,
        ]}
      >
        <Ionicons
          name={config.icon as keyof typeof Ionicons.glyphMap}
          size={22}
          color={selected ? theme.colors.white : theme.colors.primary}
        />
      </View>
      <Text style={[styles.circleLabel, selected && styles.circleLabelSelected]} numberOfLines={1}>
        {config.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circleWrap: {
    width: 76,
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  circleSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryMuted,
  },
  circleLabel: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  circleLabelSelected: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  pillIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillIconSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pillLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  pillLabelSelected: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },
});
