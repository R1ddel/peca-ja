/**
 * Avisa o entregador quando cliente ou loja mandam mensagem no chat da entrega.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { alertIncomingChat } from '@/services/chatAlerts';
import { listDriverChatAlerts } from '@/services/orderChat';
import { resolveDriverApplication } from '@/utils/partners';
import { driverFleetId } from '@/utils/driverOps';
import { theme } from '@/constants/theme';

type BannerState = {
  orderId: string;
  title: string;
  body: string;
};

export function DriverChatWatcher() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [fleetId, setFleetId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const primedRef = useRef(false);
  const seenMsgIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    primedRef.current = false;
    seenMsgIds.current = new Set();
    (async () => {
      const app = await resolveDriverApplication(user?.email);
      if (cancelled) return;
      const id = app?.status === 'approved' ? driverFleetId(app) : null;
      setFleetId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const mine = useCallback(() => {
    if (!fleetId) return [];
    return orders.filter(
      (o) =>
        o.driverId === fleetId &&
        o.status !== 'cancelado' &&
        o.status !== 'entregue'
    );
  }, [orders, fleetId]);

  const poll = useCallback(async () => {
    if (!fleetId) return;
    const list = mine();
    const alerts = await listDriverChatAlerts(
      list.map((o) => ({
        id: o.id,
        status: o.status,
        businessName: o.businessName,
        customerName: 'Cliente',
      }))
    );

    if (!primedRef.current) {
      alerts.forEach((a) => seenMsgIds.current.add(a.messageId));
      primedRef.current = true;
      return;
    }

    const fresh = alerts.filter((a) => !seenMsgIds.current.has(a.messageId));
    if (!fresh.length) return;

    fresh.forEach((a) => seenMsgIds.current.add(a.messageId));
    const newest = fresh[0];
    const who = newest.from === 'merchant' ? 'Comércio' : 'Cliente';

    setBanner({
      orderId: newest.orderId,
      title: `${who} · ${newest.label}`,
      body: newest.preview,
    });

    void alertIncomingChat({
      title: `💬 ${who} no chat da entrega`,
      preview: newest.preview,
      orderId: newest.orderId,
      peer: 'driver',
    });
  }, [fleetId, mine]);

  useEffect(() => {
    if (!fleetId) return;
    void poll();
    const tick = setInterval(() => {
      void poll();
    }, 1500);
    return () => clearInterval(tick);
  }, [fleetId, poll, orders]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 10000);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.92}
      onPress={() => {
        router.push({
          pathname: '/driver/chat/[orderId]' as any,
          params: { orderId: banner.orderId },
        });
        setBanner(null);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${banner.title}. ${banner.body}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{banner.title}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {banner.body}
        </Text>
      </View>
      <Text style={styles.cta}>Abrir</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#0F766E',
    zIndex: 50,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: {
    color: '#fff',
    fontWeight: theme.fontWeight.bold,
    fontSize: 14,
  },
  body: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  cta: {
    color: '#fff',
    fontWeight: theme.fontWeight.bold,
    fontSize: 13,
  },
});
