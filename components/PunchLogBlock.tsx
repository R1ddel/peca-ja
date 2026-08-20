import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STAFF_ROLE_LABEL } from '@/utils/merchantTeam';
import { StaffPunch, punchKindOf } from '@/utils/merchantPunch';
import { formatOrderDateTime, formatWaitLabel } from '@/utils/datetime';
import { theme } from '@/constants/theme';

type Props = {
  punches: StaffPunch[];
  accent?: string;
  nowMs?: number;
  title?: string;
  onRefresh?: () => void;
  onSeeReport?: () => void;
};

/** Lista de pontos (entrada/saída) — dono e gerente. */
export function PunchLogBlock({
  punches,
  accent = '#0F766E',
  nowMs = Date.now(),
  title = 'Ponto da equipe',
  onRefresh,
  onSeeReport,
}: Props) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.blockTitle}>{title}</Text>
          <Text style={styles.blockHint}>Entradas e saídas de gerente, cozinha e caixa</Text>
        </View>
        <View style={styles.headActions}>
          {onSeeReport ? (
            <TouchableOpacity onPress={onSeeReport} hitSlop={8}>
              <Ionicons name="stats-chart-outline" size={18} color={accent} />
            </TouchableOpacity>
          ) : null}
          {onRefresh ? (
            <TouchableOpacity onPress={onRefresh} hitSlop={8}>
              <Ionicons name="refresh" size={18} color={accent} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {punches.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={26} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Nenhum ponto registrado ainda hoje.</Text>
        </View>
      ) : (
        punches.map((p) => {
          const kind = punchKindOf(p);
          const isIn = kind === 'in';
          return (
            <View key={p.id} style={styles.row}>
              <View
                style={[
                  styles.icon,
                  { backgroundColor: (isIn ? accent : '#DC2626') + '18' },
                ]}
              >
                <Ionicons
                  name={isIn ? 'log-in-outline' : 'log-out-outline'}
                  size={18}
                  color={isIn ? accent : '#DC2626'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {p.memberName}{' '}
                  <Text style={styles.kind}>{isIn ? '· Entrada' : '· Saída'}</Text>
                </Text>
                <Text style={styles.meta}>
                  {STAFF_ROLE_LABEL[p.role]} · {formatOrderDateTime(p.punchedAt)}
                </Text>
              </View>
              <Text style={styles.wait}>{formatWaitLabel(p.punchedAt, nowMs)}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  blockHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  headActions: { flexDirection: 'row', gap: 12, paddingTop: 2 },
  blockTitle: { fontSize: 16, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  blockHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderLight,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 14, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  kind: { fontWeight: theme.fontWeight.semibold, color: theme.colors.textMuted },
  meta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  wait: { fontSize: 11, color: theme.colors.textMuted, fontWeight: theme.fontWeight.semibold },
});
