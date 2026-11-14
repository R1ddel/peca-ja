import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { ObrasBarChart } from '@/components/obras/ObrasBarChart';
import { ObrasStatCard } from '@/components/obras/ObrasStatCard';
import { obrasTheme } from '@/constants/obrasTheme';
import { formatBRL, getActiveProject, getFinanceSummary, listCashEntries } from '@/utils/obrasStore';
import { CashEntry } from '@/types/obras';

const CATEGORY_COLORS: Record<string, string> = {
  material: '#F59E0B',
  labor: '#059669',
  equipment: '#7C3AED',
  supplier: '#EF4444',
  other: '#64748B',
};

const CATEGORY_LABELS: Record<string, string> = {
  material: 'Material',
  labor: 'Mão de obra',
  equipment: 'Equipamento',
  supplier: 'Fornecedor',
  other: 'Outros',
};

export default function ObrasAdminFinance() {
  const [loading, setLoading] = useState(true);
  const [finance, setFinance] = useState<Awaited<ReturnType<typeof getFinanceSummary>> | null>(null);
  const [cash, setCash] = useState<CashEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        const p = await getActiveProject();
        if (!p) {
          router.replace('/obras/projects' as any);
          return;
        }
        const [fin, entries] = await Promise.all([getFinanceSummary(p.id), listCashEntries(p.id)]);
        setFinance(fin);
        setCash(entries.sort((a, b) => b.date.localeCompare(a.date)));
        setLoading(false);
      })();
    }, [])
  );

  const categoryBars = finance
    ? Object.entries(finance.byCategory).map(([k, v]) => ({
        label: CATEGORY_LABELS[k] ?? k,
        value: v,
        color: CATEGORY_COLORS[k] ?? obrasTheme.colors.textMuted,
      }))
    : [];

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Fluxo de caixa" subtitle="Entradas e saídas" showBack accent={obrasTheme.colors.admin} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.statsRow}>
            <ObrasStatCard label="Entradas" value={formatBRL(finance?.totalIn ?? 0)} icon="arrow-down-circle-outline" color={obrasTheme.colors.success} />
            <ObrasStatCard label="Saídas" value={formatBRL(finance?.totalOut ?? 0)} icon="arrow-up-circle-outline" color={obrasTheme.colors.error} />
          </View>
          <ObrasStatCard
            label="Saldo atual"
            value={formatBRL(finance?.balance ?? 0)}
            icon="wallet-outline"
            color={obrasTheme.colors.secondary}
            hint={`Restante do orçamento: ${formatBRL(finance?.remaining ?? 0)}`}
          />

          {categoryBars.length > 0 ? (
            <View style={styles.chartWrap}>
              <ObrasBarChart title="Gastos por categoria" bars={categoryBars} />
            </View>
          ) : null}

          <Text style={styles.section}>Movimentações recentes</Text>
          {cash.map((c) => (
            <View key={c.id} style={styles.cashRow}>
              <View style={[styles.cashDot, { backgroundColor: c.type === 'in' ? obrasTheme.colors.success : obrasTheme.colors.error }]} />
              <View style={styles.cashBody}>
                <Text style={styles.cashDesc}>{c.description}</Text>
                <Text style={styles.cashDate}>{formatDate(c.date)}</Text>
              </View>
              <Text style={[styles.cashAmount, { color: c.type === 'in' ? obrasTheme.colors.success : obrasTheme.colors.error }]}>
                {c.type === 'in' ? '+' : '−'}{formatBRL(c.amount)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </MobileShell>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: obrasTheme.spacing.md, paddingBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  chartWrap: { marginTop: 16, marginBottom: 8 },
  section: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.text, marginTop: 16, marginBottom: 10 },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
    gap: 10,
  },
  cashDot: { width: 8, height: 8, borderRadius: 4 },
  cashBody: { flex: 1 },
  cashDesc: { fontSize: obrasTheme.fontSize.sm, fontWeight: '600', color: obrasTheme.colors.text },
  cashDate: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 2 },
  cashAmount: { fontSize: obrasTheme.fontSize.sm, fontWeight: '800' },
});
