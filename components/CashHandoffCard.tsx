import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Order } from '@/types';
import { theme } from '@/constants/theme';
import { formatPrice } from '@/data/businesses';
import { CashHandoff, cashHandoffForOrder } from '@/utils/shopDelivery';

/** Quem paga quem, em dinheiro, neste pedido. */
export function CashHandoffCard({
  order,
  viewer,
}: {
  order: Order;
  viewer: 'merchant' | 'driver' | 'customer';
}) {
  const handoff = cashHandoffForOrder(order);
  if (!handoff || viewer === 'driver') return null;

  const lines = viewer === 'customer' ? customerLines(handoff) : merchantLines(handoff);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Dinheiro na entrega</Text>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function customerLines(handoff: CashHandoff): string[] {
  return [
    `Pague ${formatPrice(handoff.collectAtDoor)} em dinheiro para o entregador da loja.`,
  ];
}

function merchantLines(handoff: CashHandoff): string[] {
  return [
    `Você fica com o dinheiro vivo: ${formatPrice(handoff.collectAtDoor)}.`,
    `A taxa Peça Já deste pedido é ${formatPrice(handoff.platformFee)}. Esse valor sai do caixa Pix da loja e cai no Pix do Peça Já.`,
    'É uma troca: a cédula fica com você, a taxa sai do saldo.',
  ];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF7E8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3D7A1',
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: 8,
  },
  line: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
});
