/**
 * Overlay de oferta exclusiva na home do motoboy —
 * aparece na tela (estilo “pop-up de prêmio”), sem ser roleta.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Order } from '@/types';
import { Button } from '@/components/Button';
import { formatPrice } from '@/data/businesses';
import { driverEarningsOf } from '@/utils/driverOps';
import { formatWaitLabel } from '@/utils/datetime';
import { DRIVER_OFFER_SECONDS } from '@/utils/driverDispatchCore';
import { theme } from '@/constants/theme';

const ACCENT = '#F59E0B';
const { width: SCREEN_W } = Dimensions.get('window');

type Props = {
  visible: boolean;
  order: Order | null;
  secondsLeft: number;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss?: () => void;
};

export function DriverOfferPopup({
  visible,
  order,
  secondsLeft,
  busy,
  onAccept,
  onDecline,
  onDismiss,
}: Props) {
  const scale = useRef(new Animated.Value(0.72)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible || !order) return;
    scale.setValue(0.72);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 68,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, order?.id]);

  if (!order) return null;

  const urgent = secondsLeft <= 10;
  const progress = Math.max(0, Math.min(1, secondsLeft / DRIVER_OFFER_SECONDS));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View
          style={[
            styles.card,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <Animated.View style={[styles.ring, { transform: [{ scale: pulse }] }]}>
            <View style={[styles.timerCircle, urgent && styles.timerUrgent]}>
              <Text style={[styles.timerNum, urgent && styles.timerNumUrgent]}>
                {secondsLeft}
              </Text>
              <Text style={styles.timerUnit}>seg</Text>
            </View>
          </Animated.View>

          <Text style={styles.eyebrow}>NOVA CORRIDA pra você</Text>
          <Text style={styles.title} numberOfLines={2}>
            {order.businessName}
          </Text>
          <Text style={styles.meta}>
            Pronto na cozinha · {formatWaitLabel(order.kitchenReadyAt || order.createdAt)}
          </Text>
          <Text style={styles.addr} numberOfLines={3}>
            {order.address}
          </Text>

          <View style={styles.payBox}>
            <Text style={styles.payLabel}>Seu frete</Text>
            <Text style={styles.payValue}>{formatPrice(driverEarningsOf(order))}</Text>
            <Text style={styles.payItems}>
              {order.items.length} item(ns) · oferta exclusiva {DRIVER_OFFER_SECONDS}s
            </Text>
          </View>

          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: urgent ? '#EF4444' : ACCENT,
                },
              ]}
            />
          </View>

          <Button
            title="Aceitar corrida"
            onPress={onAccept}
            loading={busy}
            size="lg"
            style={styles.acceptBtn}
          />
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={onDecline}
            disabled={busy}
            activeOpacity={0.75}
          >
            <Ionicons name="close" size={18} color="#94A3B8" />
            <Text style={styles.declineText}>Recusar</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: Math.min(SCREEN_W - 32, 400),
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: ACCENT,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  ring: {
    marginBottom: 12,
  },
  timerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFBEB',
    borderWidth: 4,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  timerNum: {
    fontSize: 32,
    fontWeight: '900',
    color: '#B45309',
    lineHeight: 36,
  },
  timerNumUrgent: {
    color: '#DC2626',
  },
  timerUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginTop: -2,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: ACCENT,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 30,
  },
  meta: {
    marginTop: 8,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  addr: {
    marginTop: 10,
    fontSize: 15,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '600',
  },
  payBox: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  payLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  payValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#B45309',
    marginTop: 2,
  },
  payItems: {
    fontSize: 12,
    color: '#A16207',
    marginTop: 4,
  },
  barTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    marginTop: 16,
    marginBottom: 18,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  acceptBtn: {
    width: '100%',
    backgroundColor: '#059669',
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
  },
  declineText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
