import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { ObrasHeader } from '@/components/obras/ObrasHeader';
import { obrasTheme } from '@/constants/obrasTheme';

const LINKS = [
  { href: '/obras/admin/expenses', label: 'Gastos', icon: 'receipt-outline' as const, color: '#EF4444' },
  { href: '/obras/admin/employees', label: 'Funcionários', icon: 'people-outline' as const, color: '#059669' },
  { href: '/obras/admin/suppliers', label: 'Fornecedores', icon: 'storefront-outline' as const, color: '#F59E0B' },
  { href: '/obras/admin/documents', label: 'Documentos', icon: 'document-text-outline' as const, color: '#64748B' },
  { href: '/obras/projects', label: 'Trocar obra', icon: 'swap-horizontal-outline' as const, color: '#3B82F6' },
];

export default function ObrasAdminMore() {
  return (
    <MobileShell style={styles.screen}>
      <ObrasHeader title="Mais opções" subtitle="Administrativo" accent={obrasTheme.colors.admin} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {LINKS.map((l) => (
          <TouchableOpacity key={l.href} style={styles.row} onPress={() => router.push(l.href as any)}>
            <View style={[styles.icon, { backgroundColor: l.color + '18' }]}>
              <Ionicons name={l.icon} size={22} color={l.color} />
            </View>
            <Text style={styles.label}>{l.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={obrasTheme.colors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: obrasTheme.spacing.md },
  row: {
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
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: obrasTheme.fontSize.md, fontWeight: '600', color: obrasTheme.colors.text },
});
