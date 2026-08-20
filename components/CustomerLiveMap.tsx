import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Order } from '@/types';
import { theme } from '@/constants/theme';

/** Stub web — mapa nativo só no app. */
export function CustomerLiveMap({
  order,
  viewer = 'customer',
}: {
  order: Order;
  viewer?: 'customer' | 'merchant';
  height?: number;
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>
        Mapa ao vivo do entregador disponível no app (iOS/Android).
        {order.driverName ? ` · ${order.driverName}` : ''}
        {viewer === 'merchant' ? ' · visão da loja' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  text: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
});
