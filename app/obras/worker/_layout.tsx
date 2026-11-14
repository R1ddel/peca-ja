import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { ObrasNavBar } from '@/components/obras/ObrasNavBar';
import { obrasTheme } from '@/constants/obrasTheme';

const NAV = [
  { href: '/obras/worker', label: 'Hoje', icon: 'today-outline' as const },
  { href: '/obras/worker/week', label: 'Semana', icon: 'calendar-outline' as const },
];

export default function ObrasWorkerLayout() {
  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      <ObrasNavBar items={NAV} accent={obrasTheme.colors.worker} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obrasTheme.colors.background },
});
