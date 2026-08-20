import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOrders } from '@/context/OrdersContext';
import { useAuth } from '@/context/AuthContext';
import { theme, orderStatusConfig } from '@/constants/theme';

type AlertPayload = {
  orderId: string;
  title: string;
  body: string;
};

/**
 * Banner in-app quando o status do pedido muda (complementa a notificação do sistema).
 */
export function OrderAlertBanner() {
  const { myOrders } = useOrders();
  const { user } = useAuth();
  const prevStatus = useRef<Record<string, string>>({});
  const prevReady = useRef<Record<string, string | undefined>>({});
  const [alert, setAlert] = useState<AlertPayload | null>(null);
  const primed = useRef(false);

  useEffect(() => {
    // Primeira carga: só memoriza, não alerta
    if (!primed.current) {
      for (const o of myOrders) {
        prevStatus.current[o.id] = o.status;
        prevReady.current[o.id] = o.kitchenReadyAt;
      }
      primed.current = true;
      return;
    }

    for (const o of myOrders) {
      const prev = prevStatus.current[o.id];
      const wasReady = prevReady.current[o.id];
      prevStatus.current[o.id] = o.status;
      prevReady.current[o.id] = o.kitchenReadyAt;

      if (!wasReady && o.kitchenReadyAt) {
        setAlert({
          orderId: o.id,
          title: 'Pedido pronto',
          body: `${o.businessName} terminou seu pedido.`,
        });
        break;
      }

      if (!prev || prev === o.status) continue;

      const config = orderStatusConfig[o.status];
      const bodies: Record<string, string> = {
        confirmado: `${o.businessName} confirmou seu pedido.`,
        preparando: `${o.businessName} está preparando.`,
        saiu_entrega: `Pedido a caminho · mostre seu código ao entregador.`,
        entregue: `Pedido de ${o.businessName} entregue!`,
        cancelado: o.cancelReason
          ? `Cancelado: ${o.cancelReason}`
          : `Pedido em ${o.businessName} foi cancelado.`,
      };

      setAlert({
        orderId: o.id,
        title: config?.label ?? 'Atualização do pedido',
        body: bodies[o.status] ?? `Status: ${o.status}`,
      });
      break;
    }
  }, [myOrders, user?.id]);

  // Troca de conta: não herdar alertas do usuário anterior
  useEffect(() => {
    primed.current = false;
    prevStatus.current = {};
    prevReady.current = {};
    setAlert(null);
  }, [user?.id]);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 7000);
    return () => clearTimeout(t);
  }, [alert]);

  if (!alert) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.9}
      onPress={() => {
        router.push(`/order/${alert.orderId}` as any);
        setAlert(null);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${alert.title}. ${alert.body}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="notifications" size={18} color={theme.colors.white} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{alert.title}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {alert.body}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => setAlert(null)}
        hitSlop={10}
        accessibilityLabel="Fechar aviso"
      >
        <Ionicons name="close" size={18} color={theme.colors.white} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 8,
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  body: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
});
