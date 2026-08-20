/**
 * Avisa o comércio quando cliente ou entregador manda mensagem no chat.
 * Banner in-app + vibração + notificação local.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { alertIncomingChat } from '@/services/chatAlerts';
import { listMerchantChatAlerts } from '@/services/orderChat';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { theme } from '@/constants/theme';

type BannerState = {
  orderId: string;
  peer: 'merchant' | 'driver';
  title: string;
  body: string;
};

export function MerchantChatWatcher() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const primedRef = useRef(false);
  const seenMsgIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    primedRef.current = false;
    seenMsgIds.current = new Set();
    (async () => {
      const { shop } = await resolveOperatorMerchantContext(user?.email);
      if (cancelled || !shop) return;
      setBusinessId(shop.businessId);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const mine = useCallback(() => {
    if (!businessId) return [];
    return orders.filter((o) => o.businessId === businessId);
  }, [orders, businessId]);

  const poll = useCallback(async () => {
    if (!businessId) return;
    const alerts = await listMerchantChatAlerts(mine());

    if (!primedRef.current) {
      alerts.forEach((a) => seenMsgIds.current.add(a.messageId));
      primedRef.current = true;
      return;
    }

    const fresh = alerts.filter((a) => !seenMsgIds.current.has(a.messageId));
    if (!fresh.length) return;

    fresh.forEach((a) => seenMsgIds.current.add(a.messageId));
    const newest = fresh[0];
    const order = mine().find((o) => o.id === newest.orderId);

    const who =
      newest.from === 'driver'
        ? 'Motoboy'
        : newest.peer === 'driver'
          ? 'Cliente (entrega)'
          : 'Cliente';
    setBanner({
      orderId: newest.orderId,
      peer: newest.peer,
      title: `${who} mandou mensagem · ${order ? merchantOrderLabel(order) : ''}`,
      body: newest.preview,
    });

    void alertIncomingChat({
      title: `💬 ${who} · ${order ? merchantOrderLabel(order) : ''}`,
      preview: newest.preview,
      orderId: newest.orderId,
      peer: newest.peer,
    });
  }, [businessId, mine]);

  useEffect(() => {
    if (!businessId) return;
    void poll();
    const tick = setInterval(() => {
      void poll();
    }, 1500);
    return () => clearInterval(tick);
  }, [businessId, poll, orders]);

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
          pathname: '/merchant/chat/[orderId]' as any,
          params: { orderId: banner.orderId, peer: banner.peer },
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
