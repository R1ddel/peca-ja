import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { ObrasTaskCard } from '@/components/obras/ObrasTaskCard';
import { obrasTheme } from '@/constants/obrasTheme';
import { getActiveProject, listEmployees, listTasks } from '@/utils/obrasStore';
import { ObrasEmployee, WorkTask } from '@/types/obras';

export default function ObrasForemanWeek() {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [employees, setEmployees] = useState<ObrasEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        const p = await getActiveProject();
        if (!p) {
          router.replace('/obras/projects' as any);
          return;
        }
        const [t, e] = await Promise.all([listTasks(p.id), listEmployees(p.id)]);
        setTasks(t.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
        setEmployees(e);
        setLoading(false);
      })();
    }, [])
  );

  const empMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));
  const byDate = groupByDate(tasks);

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Cronograma semanal" subtitle="Visão da semana/mês" accent={obrasTheme.colors.foreman} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.foreman} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {Object.entries(byDate).map(([date, dayTasks]) => (
            <View key={date} style={styles.dayBlock}>
              <Text style={styles.dayTitle}>{formatDay(date)}</Text>
              {dayTasks.map((t) => (
                <ObrasTaskCard
                  key={t.id}
                  task={t}
                  showAssignee
                  assigneeName={t.assignedTo ? empMap[t.assignedTo] ?? '—' : 'Não atribuída'}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </MobileShell>
  );
}

function groupByDate(tasks: WorkTask[]) {
  const map: Record<string, WorkTask[]> = {};
  for (const t of tasks) {
    if (!map[t.dueDate]) map[t.dueDate] = [];
    map[t.dueDate].push(t);
  }
  return map;
}

function formatDay(iso: string) {
  const [y, m, d] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md, paddingBottom: 24 },
  dayBlock: { marginBottom: 20 },
  dayTitle: {
    fontSize: obrasTheme.fontSize.sm,
    fontWeight: '800',
    color: obrasTheme.colors.foreman,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
});
