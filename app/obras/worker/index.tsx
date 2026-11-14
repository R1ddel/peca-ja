import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { ObrasTaskCard } from '@/components/obras/ObrasTaskCard';
import { obrasTheme } from '@/constants/obrasTheme';
import {
  getActiveProject,
  getCurrentObrasUser,
  listTasks,
  updateTaskStatus,
} from '@/utils/obrasStore';
import { DEMO_EMPLOYEES } from '@/utils/obrasDemo';
import { ObrasProject, WorkTask } from '@/types/obras';

const today = new Date().toISOString().slice(0, 10);

/** Resolve employee id pelo e-mail do usuário logado. */
function employeeIdForUser(email: string): string | undefined {
  const emp = DEMO_EMPLOYEES.find((e) => {
    const userEmail = email.toLowerCase();
    return userEmail.startsWith(e.name.split(' ')[0].toLowerCase());
  });
  return emp?.id;
}

export default function ObrasWorkerHome() {
  const [project, setProject] = useState<ObrasProject | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = await getActiveProject();
    const u = await getCurrentObrasUser();
    if (!p || !u) {
      router.replace('/obras/projects' as any);
      return;
    }
    setProject(p);
    setUserName(u.name);
    const empId = employeeIdForUser(u.email) ?? u.id.replace('usr-worker', 'emp');
    const all = await listTasks(p.id, { dueDate: today });
    const mine = all.filter((t) => t.assignedTo === empId || t.assignedTo === mapUserToEmp(u.email));
    setTasks(mine.length > 0 ? mine : all.slice(0, 3));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function markDone(taskId: string) {
    await updateTaskStatus(taskId, 'done');
    await load();
  }

  const done = tasks.filter((t) => t.status === 'done').length;

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader
        title={`Olá, ${userName.split(' ')[0]}!`}
        subtitle="Suas funções de hoje"
        accent={obrasTheme.colors.worker}
        rightAction={{ label: 'Trocar', onPress: () => router.push('/obras/projects' as any) }}
      />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.worker} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.banner}>
            <Text style={styles.bannerDate}>{formatToday()}</Text>
            <Text style={styles.bannerProgress}>{done}/{tasks.length} concluídas</Text>
          </View>

          <Text style={styles.section}>O que fazer agora</Text>
          {tasks.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyText}>Nenhuma tarefa para hoje. Bom descanso!</Text>
            </View>
          ) : (
            tasks.map((t) => (
              <ObrasTaskCard
                key={t.id}
                task={t}
                onToggleDone={t.status !== 'done' ? () => markDone(t.id) : undefined}
              />
            ))
          )}
        </ScrollView>
      )}
    </MobileShell>
  );
}

function mapUserToEmp(email: string): string {
  if (email.includes('pedro')) return 'emp-1';
  if (email.includes('maria')) return 'emp-2';
  return 'emp-3';
}

function formatToday() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md, paddingBottom: 24 },
  banner: {
    backgroundColor: obrasTheme.colors.worker,
    borderRadius: obrasTheme.radius.lg,
    padding: obrasTheme.spacing.lg,
    marginBottom: 16,
  },
  bannerDate: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.white, opacity: 0.9, textTransform: 'capitalize' },
  bannerProgress: { fontSize: obrasTheme.fontSize.xl, fontWeight: '900', color: obrasTheme.colors.white, marginTop: 4 },
  section: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.text, marginBottom: 10 },
  emptyBox: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textMuted, marginTop: 8, textAlign: 'center' },
});
