import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminListOrders } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { formatOrderTime } from '@/utils/datetime';
import type { Order } from '@/types';
import { theme } from '@/constants/theme';

export default function AdminOrdersScreen() {
  const { ok } = useAdminGate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [sinceDays, setSinceDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminListOrders(token, { sinceDays });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha.');
        return;
      }
      setOrders(((res as any).orders || []) as Order[]);
    } finally {
      setLoading(false);
    }
  }, [sinceDays]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  if (!ok) return null;

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Pedidos</Text>
      <View style={styles.filters}>
        {[1, 7, 30].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, sinceDays === d && styles.chipOn]}
            onPress={() => setSinceDays(d)}
          >
            <Text style={[styles.chipText, sinceDays === d && styles.chipTextOn]}>
              {d === 1 ? 'Hoje' : `${d}d`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {loading && orders.length === 0 ? <ActivityIndicator color={theme.colors.primary} /> : null}
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.title}>
              {item.businessName} · #{item.shopOrderNumber || item.id.slice(-6)}
            </Text>
            <Text style={styles.meta}>
              {item.status} · {formatPrice(item.total)} · {formatOrderTime(item.createdAt)}
            </Text>
            <Text style={styles.meta}>
              {item.paymentConfirmed ? 'Pago' : 'Não pago'}
              {item.customerName ? ` · ${item.customerName}` : ''}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#21262d',
  },
  chipOn: { backgroundColor: theme.colors.primary },
  chipText: { color: '#c9d1d9', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  err: { color: '#f85149' },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#21262d' },
  title: { color: '#fff', fontWeight: '700' },
  meta: { color: '#8b949e', fontSize: 12, marginTop: 2 },
});
