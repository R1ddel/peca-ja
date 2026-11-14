import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { obrasTheme } from '@/constants/obrasTheme';
import { formatBRL, getActiveProject, listEmployees } from '@/utils/obrasStore';
import { ObrasEmployee } from '@/types/obras';

export default function ObrasAdminEmployees() {
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
        setEmployees(await listEmployees(p.id));
        setLoading(false);
      })();
    }, [])
  );

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Funcionários" subtitle={`${employees.length} na obra`} showBack accent={obrasTheme.colors.admin} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {employees.map((e) => (
            <View key={e.id} style={styles.card}>
              <View style={[styles.avatar, !e.active && styles.avatarInactive]}>
                <Text style={styles.avatarText}>{e.name.charAt(0)}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.name}>{e.name}</Text>
                <Text style={styles.role}>{e.role}</Text>
                {e.phone ? <Text style={styles.phone}>{e.phone}</Text> : null}
              </View>
              <View style={styles.rate}>
                <Text style={styles.rateValue}>{formatBRL(e.dailyRate)}</Text>
                <Text style={styles.rateLabel}>/ dia</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: obrasTheme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarInactive: { opacity: 0.4 },
  avatarText: { fontSize: 18, fontWeight: '800', color: obrasTheme.colors.primaryDark },
  body: { flex: 1 },
  name: { fontSize: obrasTheme.fontSize.md, fontWeight: '700', color: obrasTheme.colors.text },
  role: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginTop: 2 },
  phone: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 2 },
  rate: { alignItems: 'flex-end' },
  rateValue: { fontSize: obrasTheme.fontSize.sm, fontWeight: '800', color: obrasTheme.colors.text },
  rateLabel: { fontSize: 10, color: obrasTheme.colors.textMuted },
});
