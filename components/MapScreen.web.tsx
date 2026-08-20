import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BackHeader } from '@/components/BackHeader';
import { theme } from '@/constants/theme';

/** Stub web — não reexportar MapScreen (evita loop de resolução de plataforma). */
export default function MapScreenWeb() {
  return (
    <View style={styles.screen}>
      <BackHeader title="Mapa" />
      <View style={styles.box}>
        <Text style={styles.title}>Mapa disponível no celular</Text>
        <Text style={styles.sub}>
          Abra o Peça Já no Expo Go (iOS/Android) para ver o mapa completo.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  sub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
