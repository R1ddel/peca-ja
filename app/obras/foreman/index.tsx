import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { ObrasTaskCard } from '@/components/obras/ObrasTaskCard';
import { ObrasStatCard } from '@/components/obras/ObrasStatCard';
import { obrasTheme } from '@/constants/obrasTheme';
import {
  getActiveProject,
  listEmployees,
  listTasks,
  updateTaskStatus,
} from '@/utils/obrasStore';
import { ObrasEmployee, ObrasProject, WorkTask } from '@/types/obras';

const today = new Date().toISOString().slice(0, 10);

export default function ObrasForemanHome() {
  const [project, setProject] = useState<ObrasProject | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [employees, setEmployees] = useState<ObrasEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = await getActiveProject();
    if (!p) {
      router.replace('/obras/projects' as any);
      return;
    }
    setProject(p);
    const [t, e] = await Promise.all([
      listTasks(p.id, { dueDate: today }),
      listEmployees(p.id),
    ]);
    setTasks(t);
    setEmployees(e);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));
  const done = tasks.filter((t) => t.status === 'done').length;
  const pending = tasks.filter((t) => t.status !== 'done').length;

  async function markDone(taskId: string) {
    await updateTaskStatus(taskId, 'done');
    await load();
  }

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader
        title="Ordens do dia"
        subtitle={project?.name ?? 'Encarregado'}
        accent={obrasTheme.colors.foreman}
        rightAction={{ label: 'Trocar', onPress: () => router.push('/obras/projects' as any) }}
      />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.foreman} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.date}>{formatToday()}</Text>
          <View style={styles.statsRow}>
            <ObrasStatCard label="Concluídas" value={String(done)} icon="checkmark-circle-outline" color={obrasTheme.colors.success} />
            <ObrasStatCard label="Pendentes" value={String(pending)} icon="time-outline" color={obrasTheme.colors.warning} />
          </View>

          <Text style={styles.section}>Funções para aplicar na obra</Text>
          {tasks.length === 0 ? (
            <Text style={styles.empty}>Nenhuma tarefa para hoje.</Text>
          ) : (
            tasks.map((t) => (
              <ObrasTaskCard
                key={t.id}
                task={t}
                showAssignee
                assigneeName={t.assignedTo ? empMap[t.assignedTo] ?? '—' : 'Não atribuída'}
                onToggleDone={t.status !== 'done' ? () => markDone(t.id) : undefined}
              />
            ))
          )}
        </ScrollView>
      )}
    </MobileShell>
  );
}

function formatToday() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md, paddingBottom: 24 },
  date: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, fontWeight: '600', marginBottom: 12, textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  section: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.text, marginBottom: 10 },
  empty: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textMuted, textAlign: 'center', padding: 24 },
});
