import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { ObrasNavBar } from '@/components/obras/ObrasNavBar';
import { obrasTheme } from '@/constants/obrasTheme';

const NAV = [
  { href: '/obras/admin', label: 'Painel', icon: 'grid-outline' as const },
  { href: '/obras/admin/planning', label: 'Plano', icon: 'calendar-outline' as const },
  { href: '/obras/admin/finance', label: 'Caixa', icon: 'wallet-outline' as const },
  { href: '/obras/admin/ai', label: 'IA', icon: 'sparkles-outline' as const },
  { href: '/obras/admin/more', label: 'Mais', icon: 'ellipsis-horizontal' as const },
];

export default function ObrasAdminLayout() {
  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      <ObrasNavBar items={NAV} accent={obrasTheme.colors.admin} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obrasTheme.colors.background },
});
