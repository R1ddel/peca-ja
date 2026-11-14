import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { obrasTheme } from '@/constants/obrasTheme';
import { formatBRL, getActiveProject, listExpenses } from '@/utils/obrasStore';
import { ObrasExpense } from '@/types/obras';

const CAT_LABELS: Record<string, string> = {
  material: 'Material',
  labor: 'Mão de obra',
  equipment: 'Equipamento',
  supplier: 'Fornecedor',
  other: 'Outros',
};

export default function ObrasAdminExpenses() {
  const [expenses, setExpenses] = useState<ObrasExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        const p = await getActiveProject();
        if (!p) {
          router.replace('/obras/projects' as any);
          return;
        }
        const list = await listExpenses(p.id);
        setExpenses(list);
        setTotal(list.reduce((s, e) => s + e.amount, 0));
        setLoading(false);
      })();
    }, [])
  );

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Controle de gastos" subtitle={`Total: ${formatBRL(total)}`} showBack accent={obrasTheme.colors.admin} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {expenses.map((e) => (
            <View key={e.id} style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.desc}>{e.description}</Text>
                <Text style={styles.amount}>{formatBRL(e.amount)}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.cat}>{CAT_LABELS[e.category] ?? e.category}</Text>
                <Text style={styles.date}>{e.date.split('-').reverse().join('/')}</Text>
                {e.invoiceRef ? <Text style={styles.nf}>{e.invoiceRef}</Text> : null}
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
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  desc: { flex: 1, fontSize: obrasTheme.fontSize.sm, fontWeight: '600', color: obrasTheme.colors.text },
  amount: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.error },
  meta: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  cat: { fontSize: 10, fontWeight: '700', color: obrasTheme.colors.secondary, backgroundColor: obrasTheme.colors.secondaryLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  date: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted },
  nf: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, fontWeight: '600' },
});
