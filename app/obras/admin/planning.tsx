import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { ObrasPlanningTimeline } from '@/components/obras/ObrasPlanningTimeline';
import { obrasTheme, planningPeriodLabels } from '@/constants/obrasTheme';
import { getActiveProject, listMacroItems } from '@/utils/obrasStore';
import { MacroItem, PlanningPeriod } from '@/types/obras';

const PERIODS: PlanningPeriod[] = ['week', 'month', 'quarter', 'year'];

export default function ObrasAdminPlanning() {
  const [items, setItems] = useState<MacroItem[]>([]);
  const [filter, setFilter] = useState<PlanningPeriod | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        const p = await getActiveProject();
        if (!p) {
          router.replace('/obras/projects' as any);
          return;
        }
        setProjectName(p.name);
        const macros = await listMacroItems(p.id);
        setItems(macros);
        setLoading(false);
      })();
    }, [])
  );

  const filtered = filter === 'all' ? items : items.filter((i) => i.period === filter);

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Planejamento" subtitle={projectName} showBack accent={obrasTheme.colors.admin} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.desc}>
            Macro-itens da obra — visão semanal, mensal, trimestral e anual.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
            <FilterChip label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
            {PERIODS.map((p) => (
              <FilterChip
                key={p}
                label={planningPeriodLabels[p]}
                active={filter === p}
                onPress={() => setFilter(p)}
              />
            ))}
          </ScrollView>
          <ObrasPlanningTimeline items={filtered} />
        </ScrollView>
      )}
    </MobileShell>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md, paddingBottom: 24 },
  desc: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginBottom: 12 },
  tabs: { marginBottom: 16, flexGrow: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: obrasTheme.colors.surface,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
    marginRight: 8,
    fontSize: obrasTheme.fontSize.sm,
    fontWeight: '600',
    color: obrasTheme.colors.textSecondary,
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: obrasTheme.colors.primaryLight, borderColor: obrasTheme.colors.primary, color: obrasTheme.colors.primaryDark, fontWeight: '800' },
});
