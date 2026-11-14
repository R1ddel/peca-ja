import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { obrasTheme, taskStatusConfig } from '@/constants/obrasTheme';
import { getActiveProject, getCurrentObrasUser, listTasks } from '@/utils/obrasStore';
import { WorkTask } from '@/types/obras';

export default function ObrasWorkerWeek() {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        const p = await getActiveProject();
        const u = await getCurrentObrasUser();
        if (!p || !u) {
          router.replace('/obras/projects' as any);
          return;
        }
        const empId = u.email.includes('pedro') ? 'emp-1' : u.email.includes('maria') ? 'emp-2' : 'emp-3';
        const all = await listTasks(p.id);
        setTasks(all.filter((t) => t.assignedTo === empId).sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
        setLoading(false);
      })();
    }, [])
  );

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Minha semana" subtitle="Cronograma ilustrado" accent={obrasTheme.colors.worker} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.worker} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {tasks.map((t) => {
            const st = taskStatusConfig[t.status];
            return (
              <View key={t.id} style={styles.card}>
                <View style={[styles.iconBox, { backgroundColor: st.color + '18' }]}>
                  <Ionicons name={t.icon as any} size={28} color={st.color} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{t.title}</Text>
                  <Text style={styles.area}>{t.area}</Text>
                  <Text style={styles.date}>{formatDay(t.dueDate)}</Text>
                  <View style={[styles.badge, { backgroundColor: st.color + '18' }]}>
                    <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
              </View>
            );
          })}
          {tasks.length === 0 ? (
            <Text style={styles.empty}>Sem tarefas atribuídas esta semana.</Text>
          ) : null}
        </ScrollView>
      )}
    </MobileShell>
  );
}

function formatDay(iso: string) {
  const [y, m, d] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.lg,
    padding: obrasTheme.spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
    gap: 14,
  },
  iconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  title: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.text },
  area: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.worker, fontWeight: '600', marginTop: 2 },
  date: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 4, textTransform: 'capitalize' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  empty: { textAlign: 'center', color: obrasTheme.colors.textMuted, padding: 24 },
});
