import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

type Props = {
  businessName?: string;
  viewer?: 'customer' | 'merchant';
};

/** Entrega da própria loja: sem mapa de motoboy. */
export function StoreDeliveryNotice({ businessName, viewer = 'customer' }: Props) {
  const detail =
    viewer === 'merchant'
      ? 'Este pedido sai com a entrega da loja. O mapa do motoboy da Peça Já não entra aqui.'
      : businessName
        ? `${businessName} leva o pedido até você. Não há motoboy da Peça Já nesta entrega.`
        : 'O comércio leva o pedido até você. Não há motoboy da Peça Já nesta entrega.';

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="storefront" size={22} color={theme.colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>A loja entrega</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 4 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
});
