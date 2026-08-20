import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

type Props = { fallbackName?: string };

export function DeliveryTrackingMap({ fallbackName = 'Você' }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Mapa — {fallbackName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#E8F2EC',
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
  },
  text: { color: theme.colors.text, fontWeight: '600' },
});