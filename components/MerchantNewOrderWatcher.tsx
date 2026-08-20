/**
 * Alerta de pedido novo no painel do comércio:
 * vibração + notificação do sistema + banner in-app.
 * Roda em todas as telas do merchant (via _layout).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import { alertMerchantNewOrder, merchantAlertStorageKey } from '@/services/merchantAlerts';
import { merchantOrderLabel } from '@/utils/merchantOrderNumber';
import { formatPrice } from '@/data/businesses';
import { theme } from '@/constants/theme';

const KITCHEN = new Set(['confirmado', 'preparando']);

type BannerState = {
  orderId: string;
  title: string;
  body: string;
};

async function loadSeen(businessId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(merchantAlertStorageKey(businessId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

async function saveSeen(businessId: string, seen: Set<string>) {
  const list = Array.from(seen).slice(-200);
  await AsyncStorage.setItem(merchantAlertStorageKey(businessId), JSON.stringify(list));
}

export function MerchantNewOrderWatcher() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    primedRef.current = false;
    readyRef.current = false;
    (async () => {
      const { shop } = await resolveOperatorMerchantContext(user?.email);
      const bid = shop?.businessId ?? null;
      if (!bid || cancelled) return;
      seenRef.current = await loadSeen(bid);
      if (cancelled) return;
      readyRef.current = true;
      setBusinessId(bid);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    if (!businessId || !readyRef.current) return;

    const kitchen = orders.filter(
      (o) => o.businessId === businessId && KITCHEN.has(o.status)
    );

    // Primeira passagem: memoriza a fila atual sem alertar
    if (!primedRef.current) {
      kitchen.forEach((o) => seenRef.current.add(o.id));
      primedRef.current = true;
      void saveSeen(businessId, seenRef.current);
      return;
    }

    const fresh = kitchen.filter((o) => !seenRef.current.has(o.id));
    if (!fresh.length) return;

    fresh.forEach((o) => seenRef.current.add(o.id));
    void saveSeen(businessId, seenRef.current);

    const newest = [...fresh].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    )[0];

    const summary = newest.items
      .slice(0, 2)
      .map((l) => `${l.quantity}× ${l.item.name}`)
      .join(', ');

    setBanner({
      orderId: newest.id,
      title: `${merchantOrderLabel(newest)} · pedido novo`,
      body: `${summary || 'Itens'} · ${formatPrice(newest.total)}`,
    });

    void alertMerchantNewOrder({
      orderId: newest.id,
      shopOrderNumber: newest.shopOrderNumber,
      businessName: newest.businessName,
      itemSummary: summary,
    });
  }, [orders, businessId]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 12000);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.92}
      onPress={() => {
        router.push({
          pathname: '/merchant/order/[id]' as any,
          params: { id: banner.orderId },
        });
        setBanner(null);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${banner.title}. ${banner.body}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="notifications" size={18} color="#fff" />
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
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#C2410C',
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
