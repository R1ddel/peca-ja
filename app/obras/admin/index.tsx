import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { ObrasStatCard } from '@/components/obras/ObrasStatCard';
import { ObrasAiInsightCard } from '@/components/obras/ObrasAiInsightCard';
import { obrasTheme } from '@/constants/obrasTheme';
import {
  formatBRL,
  getActiveProject,
  getFinanceSummary,
  listEmployees,
  listInsights,
  listTasks,
} from '@/utils/obrasStore';
import { ObrasProject } from '@/types/obras';
import { AiInsight } from '@/types/obras';

export default function ObrasAdminHome() {
  const [project, setProject] = useState<ObrasProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [finance, setFinance] = useState<Awaited<ReturnType<typeof getFinanceSummary>> | null>(null);
  const [taskStats, setTaskStats] = useState({ total: 0, done: 0, pending: 0 });
  const [employeeCount, setEmployeeCount] = useState(0);
  const [insights, setInsights] = useState<AiInsight[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        const p = await getActiveProject();
        if (!p) {
          router.replace('/obras/projects' as any);
          return;
        }
        setProject(p);
        const [fin, tasks, emps, ins] = await Promise.all([
          getFinanceSummary(p.id),
          listTasks(p.id),
          listEmployees(p.id),
          listInsights(p.id),
        ]);
        setFinance(fin);
        setTaskStats({
          total: tasks.length,
          done: tasks.filter((t) => t.status === 'done').length,
          pending: tasks.filter((t) => t.status !== 'done').length,
        });
        setEmployeeCount(emps.filter((e) => e.active).length);
        setInsights(ins.slice(0, 3));
        setLoading(false);
      })();
    }, [])
  );

  if (loading || !project) {
    return (
      <MobileShell style={styles.center}>
        <ActivityIndicator color={obrasTheme.colors.primary} />
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader
        title={project.name}
        subtitle="Painel administrativo"
        accent={obrasTheme.colors.admin}
        rightAction={{ label: 'Trocar', onPress: () => router.push('/obras/projects' as any) }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statsRow}>
          <ObrasStatCard label="Orçamento" value={formatBRL(finance?.budget ?? 0)} icon="cash-outline" color={obrasTheme.colors.secondary} />
          <ObrasStatCard label="Gasto" value={formatBRL(finance?.spent ?? 0)} icon="trending-down-outline" color={obrasTheme.colors.error} />
        </View>
        <View style={styles.statsRow}>
          <ObrasStatCard label="Saldo caixa" value={formatBRL(finance?.balance ?? 0)} icon="wallet-outline" color={obrasTheme.colors.success} hint="Entradas − saídas" />
          <ObrasStatCard label="Progresso" value={`${project.progress}%`} icon="construct-outline" color={obrasTheme.colors.primary} />
        </View>
        <View style={styles.statsRow}>
          <ObrasStatCard label="Equipe" value={String(employeeCount)} icon="people-outline" color={obrasTheme.colors.info} />
          <ObrasStatCard label="Tarefas hoje" value={`${taskStats.done}/${taskStats.total}`} icon="checkbox-outline" color={obrasTheme.colors.foreman} />
        </View>

        <Text style={styles.section}>Acesso rápido</Text>
        <View style={styles.quickGrid}>
          {QUICK.map((q) => (
            <TouchableOpacity key={q.href} style={styles.quickCard} onPress={() => router.push(q.href as any)}>
              <Ionicons name={q.icon} size={24} color={q.color} />
              <Text style={styles.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {insights.length > 0 ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Insights IA</Text>
              <TouchableOpacity onPress={() => router.push('/obras/admin/ai' as any)}>
                <Text style={styles.seeAll}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            {insights.map((i) => (
              <ObrasAiInsightCard key={i.id} insight={i} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </MobileShell>
  );
}

const QUICK = [
  { href: '/obras/admin/planning', label: 'Planejamento', icon: 'calendar' as const, color: '#1E40AF' },
  { href: '/obras/admin/expenses', label: 'Gastos', icon: 'receipt' as const, color: '#EF4444' },
  { href: '/obras/admin/employees', label: 'Funcionários', icon: 'people' as const, color: '#059669' },
  { href: '/obras/admin/suppliers', label: 'Fornecedores', icon: 'storefront' as const, color: '#F59E0B' },
  { href: '/obras/admin/finance', label: 'Fluxo caixa', icon: 'bar-chart' as const, color: '#7C3AED' },
  { href: '/obras/admin/documents', label: 'Documentos', icon: 'document-text' as const, color: '#64748B' },
];

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md, paddingBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  section: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.text, marginTop: 16, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  seeAll: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.secondary, fontWeight: '700' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '30%' as any,
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
  },
  quickLabel: { fontSize: 11, fontWeight: '700', color: obrasTheme.colors.text, textAlign: 'center' },
});
