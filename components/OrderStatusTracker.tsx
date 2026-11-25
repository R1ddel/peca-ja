import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrderStatus, orderStatusConfig, theme } from '@/constants/theme';

interface OrderStatusTrackerProps {
  status: OrderStatus;
  compact?: boolean;
}

const STATUS_ORDER: OrderStatus[] = ['pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue'];

export function OrderStatusTracker({ status, compact }: OrderStatusTrackerProps) {
  const currentIndex = STATUS_ORDER.indexOf(status);

  if (compact) {
    const config = orderStatusConfig[status];
    return (
      <View style={[styles.compactBadge, { backgroundColor: config.color + '20' }]}>
        <Ionicons name={config.icon as keyof typeof Ionicons.glyphMap} size={14} color={config.color} />
        <Text style={[styles.compactText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  }

  if (status === 'cancelado') {
    const config = orderStatusConfig.cancelado;
    return (
      <View style={styles.cancelledBox}>
        <View style={[styles.cancelledIcon, { backgroundColor: config.color }]}>
          <Ionicons
            name={config.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color="#fff"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cancelledTitle}>{config.label}</Text>
          <Text style={styles.cancelledSub}>Este pedido foi cancelado e não segue o fluxo normal.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {STATUS_ORDER.map((s, index) => {
        const config = orderStatusConfig[s];
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <View key={s} style={styles.step}>
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.circle,
                  isActive && { backgroundColor: theme.colors.primary },
                  isCurrent && styles.circleCurrent,
                ]}
              >
                <Ionicons
                  name={config.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={isActive ? '#fff' : theme.colors.textMuted}
                />
              </View>
              {index < STATUS_ORDER.length - 1 && (
                <View
                  style={[
                    styles.line,
                    isActive && index < currentIndex && { backgroundColor: theme.colors.primary },
                  ]}
                />
              )}
            </View>
            <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]} numberOfLines={2}>
              {config.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
  step: {
    flex: 1,
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleCurrent: {
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  line: {
    position: 'absolute',
    left: '60%',
    right: '-40%',
    height: 2,
    backgroundColor: theme.colors.border,
    top: 17,
  },
  stepLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: 2,
  },
  stepLabelActive: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    alignSelf: 'flex-start',
  },
  compactText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  cancelledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelledIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.error,
  },
  cancelledSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
});
