import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { obrasTheme } from '@/constants/obrasTheme';
import { obrasRoleLabels } from '@/constants/obrasTheme';
import {
  getCurrentObrasUser,
  listUserProjects,
  logoutObras,
  obrasHomeForRole,
  setActiveProject,
} from '@/utils/obrasStore';
import { ObrasProject, ObrasUser } from '@/types/obras';

const statusLabels = {
  planning: { label: 'Planejamento', color: obrasTheme.colors.info },
  active: { label: 'Em andamento', color: obrasTheme.colors.success },
  paused: { label: 'Pausada', color: obrasTheme.colors.warning },
  completed: { label: 'Concluída', color: obrasTheme.colors.textMuted },
};

export default function ObrasProjectsScreen() {
  const [user, setUser] = useState<ObrasUser | null>(null);
  const [projects, setProjects] = useState<ObrasProject[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        const u = await getCurrentObrasUser();
        if (!u) {
          router.replace('/obras/login' as any);
          return;
        }
        setUser(u);
        const list = await listUserProjects(u);
        setProjects(list);
        setLoading(false);
      })();
    }, [])
  );

  async function selectProject(project: ObrasProject) {
    await setActiveProject(project.id);
    if (user) router.replace(obrasHomeForRole(user.role) as any);
  }

  async function handleLogout() {
    await logoutObras();
    router.replace('/obras/login' as any);
  }

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader
        title="Escolher obra"
        subtitle={user ? `${obrasRoleLabels[user.role]} · ${user.name}` : ''}
        rightAction={{ label: 'Sair', onPress: handleLogout }}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={obrasTheme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.hint}>Selecione a obra que deseja gerenciar hoje.</Text>
          {projects.map((p) => {
            const st = statusLabels[p.status];
            return (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => selectProject(p)}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{p.name}</Text>
                  <View style={[styles.badge, { backgroundColor: st.color + '18' }]}>
                    <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <Ionicons name="location-outline" size={14} color={obrasTheme.colors.textMuted} />
                  <Text style={styles.address}>{p.address}</Text>
                </View>
                <View style={styles.progressRow}>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${p.progress}%` as any }]} />
                  </View>
                  <Text style={styles.progressText}>{p.progress}%</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={obrasTheme.colors.textMuted}
                  style={styles.chevron}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obrasTheme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md },
  hint: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginBottom: obrasTheme.spacing.md },
  card: {
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.lg,
    padding: obrasTheme.spacing.md,
    marginBottom: obrasTheme.spacing.md,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, fontSize: obrasTheme.fontSize.lg, fontWeight: '800', color: obrasTheme.colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  address: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  progressBg: { flex: 1, height: 6, backgroundColor: obrasTheme.colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: obrasTheme.colors.primary, borderRadius: 3 },
  progressText: { fontSize: obrasTheme.fontSize.xs, fontWeight: '700', color: obrasTheme.colors.text },
  chevron: { position: 'absolute', right: 16, top: '50%' as any },
});
