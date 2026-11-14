import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { obrasTheme } from '@/constants/obrasTheme';
import { assignTask, getActiveProject, getCurrentObrasUser, listEmployees, listTasks } from '@/utils/obrasStore';
import { ObrasEmployee, WorkTask } from '@/types/obras';

const today = new Date().toISOString().slice(0, 10);

export default function ObrasForemanTeam() {
  const [employees, setEmployees] = useState<ObrasEmployee[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const p = await getActiveProject();
    const u = await getCurrentObrasUser();
    if (!p || !u) {
      router.replace('/obras/projects' as any);
      return;
    }
    setUserId(u.id);
    const [e, t] = await Promise.all([listEmployees(p.id), listTasks(p.id, { dueDate: today })]);
    setEmployees(e.filter((x) => x.active));
    setTasks(t.filter((x) => x.status !== 'done'));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function assign(taskId: string, empId: string) {
    await assignTask(taskId, empId, userId);
    await load();
  }

  const tasksByEmp = (empId: string) => tasks.filter((t) => t.assignedTo === empId);

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Equipe" subtitle="Distribuir funções" accent={obrasTheme.colors.foreman} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.foreman} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.hint}>Toque em uma tarefa não atribuída para designar a um funcionário.</Text>
          {employees.map((emp) => {
            const assigned = tasksByEmp(emp.id);
            const unassigned = tasks.filter((t) => !t.assignedTo);
            return (
              <View key={emp.id} style={styles.empCard}>
                <View style={styles.empHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{emp.name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.empName}>{emp.name}</Text>
                    <Text style={styles.empRole}>{emp.role} · {assigned.length} tarefa(s) hoje</Text>
                  </View>
                </View>
                {assigned.map((t) => (
                  <Text key={t.id} style={styles.assignedTask}>✓ {t.title}</Text>
                ))}
                {unassigned.length > 0 ? (
                  <View style={styles.assignRow}>
                    {unassigned.slice(0, 2).map((t) => (
                      <TouchableOpacity key={t.id} style={styles.assignBtn} onPress={() => assign(t.id, emp.id)}>
                        <Text style={styles.assignText}>+ {t.title.slice(0, 20)}…</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md },
  hint: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginBottom: 16 },
  empCard: {
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.lg,
    padding: obrasTheme.spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
  },
  empHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: obrasTheme.colors.foreman + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: obrasTheme.colors.foreman },
  empName: { fontSize: obrasTheme.fontSize.md, fontWeight: '700', color: obrasTheme.colors.text },
  empRole: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 2 },
  assignedTask: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginTop: 4, paddingLeft: 4 },
  assignRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  assignBtn: { backgroundColor: obrasTheme.colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  assignText: { fontSize: 11, fontWeight: '700', color: obrasTheme.colors.primaryDark },
});
