/**
 * Chip de status da frota — cópia amigável para loja/entregador.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  online: boolean;
  persistence?: 'postgres' | 'filesystem' | null;
};

export function FleetStatusChip({ online, persistence }: Props) {
  const syncedCloud = online && persistence === 'postgres';
  const syncedLan = online && persistence === 'filesystem';

  const label = !online
    ? 'Só neste aparelho'
    : syncedCloud
      ? 'Sincronizado na nuvem'
      : syncedLan
        ? 'Sincronizado na rede'
        : 'Sincronizado';

  const color = !online ? '#92400E' : syncedCloud ? '#047857' : '#1D4ED8';
  const bg = !online ? '#FEF3C7' : syncedCloud ? '#D1FAE5' : '#DBEAFE';
  const icon = !online
    ? 'phone-portrait-outline'
    : syncedCloud
      ? 'cloud-done-outline'
      : 'wifi-outline';

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[styles.text, { color }]}>{label}</Text>
      {__DEV__ && persistence ? (
        <Text style={[styles.dev, { color }]}> · {persistence}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
  dev: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.7,
  },
});
