/**
 * Aba de avisos: cupons das lojas (para todos) e mensagens do pedido.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import {
  CustomerChatAlert,
  listCustomerChatAlerts,
} from '@/services/orderChat';
import {
  CouponNotice,
  listCouponNotices,
  markCouponNoticesSeen,
} from '@/utils/couponNotices';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { myOrders } = useOrders();
  const [coupons, setCoupons] = useState<CouponNotice[]>([]);
  const [chats, setChats] = useState<CustomerChatAlert[]>([]);

  const load = useCallback(async () => {
    const [noticeList, chatList] = await Promise.all([
      listCouponNotices(user?.id),
      listCustomerChatAlerts(myOrders),
    ]);
    setCoupons(noticeList);
    setChats(chatList);
    await markCouponNoticesSeen(noticeList.map((n) => n.id));
  }, [myOrders, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Notificações" fallbackHref="/(tabs)" preferFallback />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>Cupons para usar no pedido. Cada um vale uma vez.</Text>

        <Text style={styles.section}>Cupons para você</Text>
        {coupons.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="pricetag-outline" size={28} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum cupom ativo agora</Text>
            <Text style={styles.emptyText}>
              Quando uma loja liberar desconto ou frete grátis, o aviso aparece aqui para todos.
            </Text>
          </View>
        ) : (
          coupons.map((coupon) => (
            <TouchableOpacity
              key={coupon.id}
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => router.push(`/business/${coupon.businessId}` as any)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="pricetag" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{coupon.businessName}</Text>
                <Text style={styles.cardOffer}>{coupon.summary}</Text>
                <Text style={styles.cardHint}>
                  {coupon.title}
                  {coupon.code ? ` · código ${coupon.code}` : ''}
                </Text>
                <Text style={styles.cardCta}>Pedir nesta loja</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.section}>Mensagens do pedido</Text>
        {chats.length === 0 ? (
          <Text style={styles.quiet}>Nenhuma mensagem nova.</Text>
        ) : (
          chats.map((chat) => (
            <TouchableOpacity
              key={chat.messageId}
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => router.push(`/chat/${chat.orderId}` as any)}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={chat.from === 'driver' ? 'bicycle' : 'storefront'}
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{chat.label}</Text>
                <Text style={styles.cardHint} numberOfLines={2}>
                  {chat.preview}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  lead: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
    marginBottom: 6,
  },
  section: {
    marginTop: 8,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '18',
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  cardOffer: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    marginTop: 2,
  },
  cardHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  cardCta: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.xs,
    marginTop: 6,
  },
  empty: {
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 8,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  quiet: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
});
