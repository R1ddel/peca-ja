import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';

type Props = { fallbackName?: string };

/** Stub web â€” mapa nativo quebra o bundle do servidor Expo. */
export function DeliveryTrackingMap({ fallbackName = 'VocÃª' }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="map" size={16} color={theme.colors.primary} />
        <Text style={styles.title}>Mapa perto de vocÃª</Text>
      </View>
      <TouchableOpacity
        style={styles.mapPlaceholder}
        activeOpacity={0.9}
        onPress={() => router.push('/map' as any)}
      >
        <Ionicons name="map-outline" size={36} color={theme.colors.textMuted} />
        <Text style={styles.placeholderText}>
          Mapa completo no celular Â· {fallbackName}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  mapPlaceholder: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F2EC',
    borderRadius: theme.radius.md,
    gap: 8,
    padding: theme.spacing.md,
  },
  placeholderText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
});
