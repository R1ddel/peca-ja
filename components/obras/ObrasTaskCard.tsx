import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkTask } from '@/types/obras';
import { obrasTheme, taskStatusConfig } from '@/constants/obrasTheme';

type Props = {
  task: WorkTask;
  onPress?: () => void;
  onToggleDone?: () => void;
  showAssignee?: boolean;
  assigneeName?: string;
};

export function ObrasTaskCard({ task, onPress, onToggleDone, showAssignee, assigneeName }: Props) {
  const status = taskStatusConfig[task.status];
  const priorityColor =
    task.priority === 'high'
      ? obrasTheme.colors.error
      : task.priority === 'medium'
        ? obrasTheme.colors.warning
        : obrasTheme.colors.textMuted;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: status.color + '18' }]}>
          <Ionicons name={task.icon as any} size={22} color={status.color} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.area}>{task.area}</Text>
          {task.description ? <Text style={styles.desc} numberOfLines={2}>{task.description}</Text> : null}
          <View style={styles.meta}>
            <View style={[styles.badge, { backgroundColor: status.color + '18' }]}>
              <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
            <View style={[styles.dot, { backgroundColor: priorityColor }]} />
            {showAssignee && assigneeName ? (
              <Text style={styles.assignee}>{assigneeName}</Text>
            ) : null}
          </View>
        </View>
        {onToggleDone && task.status !== 'done' ? (
          <TouchableOpacity style={styles.checkBtn} onPress={onToggleDone}>
            <Ionicons name="checkmark-circle-outline" size={28} color={obrasTheme.colors.success} />
          </TouchableOpacity>
        ) : task.status === 'done' ? (
          <Ionicons name="checkmark-circle" size={28} color={obrasTheme.colors.success} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    marginBottom: obrasTheme.spacing.sm,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: obrasTheme.fontSize.md, fontWeight: '700', color: obrasTheme.colors.text },
  area: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.secondary, fontWeight: '600', marginTop: 2 },
  desc: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  assignee: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted },
  checkBtn: { padding: 4 },
});
