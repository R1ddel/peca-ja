/**
 * Avisa o cliente quando loja ou entregador mandam mensagem.
 * Banner in-app + vibração + notificação local.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { alertIncomingChat } from '@/services/chatAlerts';
import { listCustomerChatAlerts } from '@/services/orderChat';
import { theme } from '@/constants/theme';

type BannerState = {
  orderId: string;
  peer: 'merchant' | 'driver';
  title: string;
  body: string;
};

export function CustomerChatWatcher() {
  const { user } = useAuth();
  const { myOrders } = useOrders();
  const pathname = usePathname();
  const [banner, setBanner] = useState<BannerState | null>(null);
  const primedRef = useRef(false);
  const seenMsgIds = useRef<Set<string>>(new Set());

  const onPartnerPanel =
    !!pathname &&
    (pathname.includes('/merchant') || pathname.includes('/driver'));

  useEffect(() => {
    primedRef.current = false;
    seenMsgIds.current = new Set();
    setBanner(null);
  }, [user?.id]);

  const poll = useCallback(async () => {
    if (!user?.id) return;
    if (onPartnerPanel) return;
    const alerts = await listCustomerChatAlerts(myOrders);

    if (!primedRef.current) {
      alerts.forEach((a) => seenMsgIds.current.add(a.messageId));
      primedRef.current = true;
      return;
    }

    const fresh = alerts.filter((a) => !seenMsgIds.current.has(a.messageId));
    if (!fresh.length) return;

    fresh.forEach((a) => seenMsgIds.current.add(a.messageId));
    const newest = fresh[0];
    const who = newest.from === 'driver' ? 'Entregador' : 'Comércio';

    setBanner({
      orderId: newest.orderId,
      peer: newest.peer,
      title: `${who} · ${newest.label}`,
      body: newest.preview,
    });

    void alertIncomingChat({
      title: `💬 ${who} mandou mensagem`,
      preview: newest.preview,
      orderId: newest.orderId,
      peer: newest.peer,
    });
  }, [user?.id, myOrders, onPartnerPanel]);

  useEffect(() => {
    if (!user?.id || onPartnerPanel) return;
    void poll();
    const tick = setInterval(() => {
      void poll();
    }, 1500);
    return () => clearInterval(tick);
  }, [user?.id, poll, myOrders, onPartnerPanel]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 10000);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner || onPartnerPanel) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.92}
      onPress={() => {
        router.push({
          pathname: '/chat/[orderId]' as any,
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
    position: 'absolute',
    top: 52,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#0F766E',
    zIndex: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.22,
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
