import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AiInsight } from '@/types/obras';
import { obrasTheme } from '@/constants/obrasTheme';

type Props = {
  insight: AiInsight;
  onDismiss?: () => void;
};

const severityConfig = {
  info: { color: obrasTheme.colors.info, icon: 'information-circle' as const },
  warning: { color: obrasTheme.colors.warning, icon: 'warning' as const },
  critical: { color: obrasTheme.colors.error, icon: 'alert-circle' as const },
};

export function ObrasAiInsightCard({ insight, onDismiss }: Props) {
  const cfg = severityConfig[insight.severity];

  return (
    <View style={[styles.card, { borderLeftColor: cfg.color }]}>
      <View style={styles.header}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
        <Text style={styles.agent}>{insight.agent}</Text>
        {onDismiss ? (
          <TouchableOpacity onPress={onDismiss} hitSlop={8}>
            <Ionicons name="close" size={16} color={obrasTheme.colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.title}>{insight.title}</Text>
      <Text style={styles.body}>{insight.body}</Text>
    </View>
  );
}

type AgentCardProps = {
  name: string;
  emoji: string;
  status: 'idle' | 'running' | 'done';
  lastRun?: string;
  onRun?: () => void;
};

export function ObrasAiAgentCard({ name, emoji, status, lastRun, onRun }: AgentCardProps) {
  return (
    <View style={styles.agentCard}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.agentBody}>
        <Text style={styles.agentName}>{name}</Text>
        {lastRun ? (
          <Text style={styles.lastRun}>
            Última análise: {new Date(lastRun).toLocaleDateString('pt-BR')}
          </Text>
        ) : (
          <Text style={styles.lastRun}>Aguardando primeira análise</Text>
        )}
      </View>
      <TouchableOpacity style={styles.runBtn} onPress={onRun} disabled={status === 'running'}>
        {status === 'running' ? (
          <ActivityIndicator size="small" color={obrasTheme.colors.white} />
        ) : (
          <Ionicons name="play" size={16} color={obrasTheme.colors.white} />
        )}
      </TouchableOpacity>
    </View>
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
    borderLeftWidth: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  agent: { flex: 1, fontSize: obrasTheme.fontSize.xs, fontWeight: '700', color: obrasTheme.colors.textMuted },
  title: { fontSize: obrasTheme.fontSize.md, fontWeight: '700', color: obrasTheme.colors.text },
  body: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginTop: 4, lineHeight: 20 },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    marginBottom: obrasTheme.spacing.sm,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
    gap: 12,
  },
  emoji: { fontSize: 28 },
  agentBody: { flex: 1 },
  agentName: { fontSize: obrasTheme.fontSize.md, fontWeight: '700', color: obrasTheme.colors.text },
  lastRun: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 2 },
  runBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: obrasTheme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
