import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DriverGpsStatus } from '@/hooks/usePublishDriverLocation';
import { theme } from '@/constants/theme';

export function DriverGpsBanner({ status }: { status: DriverGpsStatus }) {
  if (status !== 'denied' && status !== 'unavailable') return null;

  const denied = status === 'denied';

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.88}
      onPress={() => {
        if (Platform.OS === 'web') return;
        void Linking.openSettings();
      }}
    >
      <Ionicons name="location-outline" size={22} color="#B45309" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{denied ? 'GPS desligado' : 'GPS sem sinal'}</Text>
        <Text style={styles.body}>
          {denied
            ? 'O cliente não vê você no mapa. Ative a localização deste aparelho.'
            : 'Não deu para ler sua posição. O cliente não vê o ponto no mapa até o GPS voltar.'}
        </Text>
        {Platform.OS === 'web' ? null : (
          <Text style={styles.action}>Abrir ajustes do celular</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  body: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  action: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
});
