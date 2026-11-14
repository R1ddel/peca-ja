import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { ObrasAiInsightCard, ObrasAiAgentCard } from '@/components/obras/ObrasAiInsightCard';
import { obrasTheme } from '@/constants/obrasTheme';
import { getActiveProject, listInsights } from '@/utils/obrasStore';
import { listAiAgents, runObrasAiAgents } from '@/utils/obrasAiAgents';
import { AiInsight } from '@/types/obras';

export default function ObrasAdminAi() {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [projectId, setProjectId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const p = await getActiveProject();
    if (!p) {
      router.replace('/obras/projects' as any);
      return;
    }
    setProjectId(p.id);
    setInsights(await listInsights(p.id));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function runAllAgents() {
    setRunning(true);
    await runObrasAiAgents(projectId);
    await load();
    setRunning(false);
  }

  const agents = listAiAgents();
  const lastByAgent = (name: string) => insights.find((i) => i.agent === name)?.createdAt;

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Agentes IA" subtitle="Análises automáticas" showBack accent={obrasTheme.colors.admin} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.desc}>
            Agentes trabalham automaticamente analisando gastos, cronograma, produtividade e segurança da obra.
          </Text>

          <TouchableOpacity style={styles.runAllBtn} onPress={runAllAgents} disabled={running}>
            {running ? (
              <ActivityIndicator color={obrasTheme.colors.white} />
            ) : (
              <Text style={styles.runAllText}>Executar todos os agentes</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.section}>Agentes ativos</Text>
          {agents.map((a) => (
            <ObrasAiAgentCard
              key={a.id}
              name={a.name}
              emoji={a.emoji}
              status={running ? 'running' : 'idle'}
              lastRun={lastByAgent(a.name)}
              onRun={runAllAgents}
            />
          ))}

          <Text style={styles.section}>Insights ({insights.length})</Text>
          {insights.map((i) => (
            <ObrasAiInsightCard key={i.id} insight={i} />
          ))}
        </ScrollView>
      )}
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md, paddingBottom: 24 },
  desc: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  runAllBtn: {
    backgroundColor: obrasTheme.colors.secondary,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    alignItems: 'center',
    marginBottom: 20,
  },
  runAllText: { color: obrasTheme.colors.white, fontWeight: '800', fontSize: obrasTheme.fontSize.md },
  section: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.text, marginBottom: 10, marginTop: 8 },
});
