import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useOrders } from '@/context/OrdersContext';
import { useCart } from '@/context/CartContext';
import { OrderStatusTracker } from '@/components/OrderStatusTracker';
import { CustomerLiveMap } from '@/components/CustomerLiveMap';
import { isCustomerLiveMapOrder } from '@/utils/customerLiveMap';
import { MobileShell } from '@/components/MobileShell';
import { OrderAlertBanner } from '@/components/OrderAlertBanner';
import { theme } from '@/constants/theme';
import { formatPrice, getBusinessById } from '@/data/businesses';
import { normalizeCartItem } from '@/utils/cartLine';
import { formatOrderDateTime, formatOrderTime } from '@/utils/datetime';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getBusinessLogoSource } from '@/utils/businessLogos';

export default function OrdersScreen() {
  useRequireAuth();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 0);
  const { myOrders, activeOrders } = useOrders();
  const { replaceCart, items: cartItems } = useCart();

  function handleReorder(orderId: string) {
    const order = myOrders.find((o) => o.id === orderId);
    if (!order) return;
    const biz = getBusinessById(order.businessId);
    if (biz && biz.isOpen === false) {
      Alert.alert('Loja fechada', `${order.businessName} está fechada agora. Tente mais tarde.`);
      return;
    }
    const otherShop =
      cartItems.length > 0 && cartItems[0].businessId !== order.businessId;
    const run = () => {
      replaceCart(order.items.map((raw) => normalizeCartItem(raw)));
      router.push('/cart');
    };
    if (otherShop) {
      Alert.alert(
        'Trocar carrinho?',
        'Seu carrinho tem itens de outra loja. Deseja substituir?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Substituir', style: 'destructive', onPress: run },
        ]
      );
      return;
    }
    run();
  }

  if (myOrders.length === 0) {
    return (
      <MobileShell style={styles.emptyShell}>
        <Tabs.Screen options={{ headerShown: false }} />
        <View style={[styles.tabHeader, { paddingTop: topInset + 14 }]}>
          <Text style={styles.tabTitle}>Pedidos</Text>
          <Text style={styles.tabSub}>Acompanhe tudo em um só lugar</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="receipt-outline" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
          <Text style={styles.emptyText}>
            Faça seu primeiro pedido e acompanhe aqui em tempo real
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.emptyButtonText}>Explorar comércios</Text>
          </TouchableOpacity>
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.container}>
      <Tabs.Screen options={{ headerShown: false }} />
      <View style={[styles.tabHeader, { paddingTop: topInset + 14 }]}>
        <Text style={styles.tabTitle}>Pedidos</Text>
        <Text style={styles.tabSub}>
          {activeOrders.length > 0
            ? `${activeOrders.length} em andamento`
            : 'Histórico e recompra'}
        </Text>
      </View>
      <OrderAlertBanner />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {activeOrders.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Em andamento</Text>
            {activeOrders.map((order) => (
              <View key={order.id}>
              <TouchableOpacity
                style={[styles.orderCard, styles.activeCard]}
                onPress={() => router.push(`/order/${order.id}`)}
                activeOpacity={0.85}
              >
                <View style={styles.orderHeader}>
                  <Image
                    source={getBusinessLogoSource({
                      name: order.businessName,
                      category: getBusinessById(order.businessId)?.category ?? 'restaurante',
                      image: getBusinessById(order.businessId)?.image ?? order.businessImage,
                    })}
                    style={styles.orderImage}
                  />
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderBusiness}>{order.businessName}</Text>
                    <Text style={styles.orderId}>
                      Pedido #{order.id} · {formatOrderTime(order.createdAt)}
                    </Text>
                  </View>
                  <OrderStatusTracker status={order.status} compact />
                </View>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotal}>{formatPrice(order.total)}</Text>
                  <View style={styles.trackBtn}>
                    <Text style={styles.trackBtnText}>Acompanhar</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
              {isCustomerLiveMapOrder(order) ? (
                <CustomerLiveMap order={order} viewer="customer" height={200} />
              ) : null}
              </View>
            ))}
          </>
        )}

        <Text
          style={[styles.sectionTitle, activeOrders.length > 0 && { marginTop: theme.spacing.lg }]}
        >
          Histórico
        </Text>
        {myOrders.filter((o) => o.status === 'entregue' || o.status === 'cancelado').length === 0 ? (
          <Text style={styles.historyEmpty}>Seus pedidos finalizados aparecerão aqui.</Text>
        ) : (
          myOrders
            .filter((o) => o.status === 'entregue' || o.status === 'cancelado')
            .map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <TouchableOpacity
                  onPress={() => router.push(`/order/${order.id}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.orderHeader}>
                    <Image
                    source={getBusinessLogoSource({
                      name: order.businessName,
                      category: getBusinessById(order.businessId)?.category ?? 'restaurante',
                      image: getBusinessById(order.businessId)?.image ?? order.businessImage,
                    })}
                    style={styles.orderImage}
                  />
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderBusiness}>{order.businessName}</Text>
                      <Text style={styles.orderDate}>
                        {formatOrderDateTime(order.createdAt)}
                      </Text>
                    </View>
                    <OrderStatusTracker status={order.status} compact />
                  </View>
                  <View style={styles.orderFooter}>
                    <Text style={styles.orderItems}>
                      {order.items.reduce((s, i) => s + i.quantity, 0)} itens
                    </Text>
                    <Text style={styles.orderTotal}>{formatPrice(order.total)}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reorderBtn}
                  onPress={() => handleReorder(order.id)}
                  activeOpacity={0.85}
                  accessibilityLabel="Pedir novamente"
                >
                  <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                  <Text style={styles.reorderBtnText}>Pedir novamente</Text>
                </TouchableOpacity>
              </View>
            ))
        )}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  tabHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  tabTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.white,
  },
  tabSub: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  orderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadow.soft,
  },
  activeCard: {
    borderColor: theme.colors.primaryMuted,
    borderWidth: 1.5,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  orderImage: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.borderLight,
  },
  orderInfo: { flex: 1 },
  orderBusiness: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  orderId: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  orderDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  orderTotal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  orderItems: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trackBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  reorderBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  historyEmpty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  emptyShell: { flex: 1, backgroundColor: theme.colors.background },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  emptyButton: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  emptyButtonText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },
});
