import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BackHeader } from '@/components/BackHeader';
import { theme } from '@/constants/theme';

/**
 * Fallback tipado. No nativo o Metro usa MapScreen.native.tsx;
 * no web usa MapScreen.web.tsx.
 */
export default function MapScreen() {
  return (
    <View style={styles.screen}>
      <BackHeader title="Mapa" />
      <View style={styles.box}>
        <Text style={styles.title}>Mapa disponível no celular</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
});
