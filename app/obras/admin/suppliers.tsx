import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { ObrasBarChart } from '@/components/obras/ObrasBarChart';
import { obrasTheme } from '@/constants/obrasTheme';
import { formatBRL, getActiveProject, listSuppliers } from '@/utils/obrasStore';
import { ObrasSupplier } from '@/types/obras';

export default function ObrasAdminSuppliers() {
  const [suppliers, setSuppliers] = useState<ObrasSupplier[]>([]);
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
        setSuppliers(await listSuppliers(p.id));
        setLoading(false);
      })();
    }, [])
  );

  const bars = suppliers.map((s, i) => ({
    label: s.name.split(' ')[0],
    value: s.totalPaid,
    color: ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'][i % 4],
  }));

  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Fornecedores" subtitle="Quanto sai para cada" showBack accent={obrasTheme.colors.admin} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={obrasTheme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {bars.length > 0 ? <ObrasBarChart title="Total pago por fornecedor" bars={bars} /> : null}
          <Text style={styles.section}>Lista completa</Text>
          {suppliers.map((s) => (
            <View key={s.id} style={styles.card}>
              <View style={styles.body}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.cat}>{s.category}</Text>
                {s.phone ? <Text style={styles.phone}>{s.phone}</Text> : null}
              </View>
              <Text style={styles.paid}>{formatBRL(s.totalPaid)}</Text>
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
  section: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.text, marginTop: 16, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: obrasTheme.colors.surface,
    borderRadius: obrasTheme.radius.md,
    padding: obrasTheme.spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: obrasTheme.colors.border,
  },
  body: { flex: 1 },
  name: { fontSize: obrasTheme.fontSize.md, fontWeight: '700', color: obrasTheme.colors.text },
  cat: { fontSize: obrasTheme.fontSize.sm, color: obrasTheme.colors.textSecondary, marginTop: 2 },
  phone: { fontSize: obrasTheme.fontSize.xs, color: obrasTheme.colors.textMuted, marginTop: 2 },
  paid: { fontSize: obrasTheme.fontSize.md, fontWeight: '800', color: obrasTheme.colors.error },
});
