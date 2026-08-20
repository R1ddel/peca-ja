import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { resolveDriverApplication } from '@/utils/partners';
import {
  driverFleetId,
  listDriverHistory,
  driverEarningsOf,
  statusLabelPt,
} from '@/utils/driverOps';
import { formatPrice } from '@/data/businesses';
import { formatOrderTime } from '@/utils/datetime';
import { theme } from '@/constants/theme';

export default function DriverHistoryScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [fleetId, setFleetId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const app = await resolveDriverApplication(user?.email);
        setFleetId(app?.status === 'approved' ? driverFleetId(app) : null);
        setReady(true);
      })();
    }, [user?.email])
  );

  const list = useMemo(
    () => (fleetId ? listDriverHistory(orders, fleetId) : []),
    [orders, fleetId]
  );

  const total = useMemo(
    () =>
      list
        .filter((o) => o.status === 'entregue')
        .reduce((s, o) => s + driverEarningsOf(o), 0),
    [list]
  );

  if (!ready) {
    return (
      <MobileShell style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Histórico" fallbackHref="/driver" />
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.summary}>
            <Text style={styles.summaryLbl}>Total entregue (frete)</Text>
            <Text style={styles.summaryVal}>{formatPrice(total)}</Text>
            <Text style={styles.summaryMeta}>{list.length} corridas no histórico</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Suas entregas concluídas aparecem aqui.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push({ pathname: '/driver/order/[id]' as any, params: { id: item.id } })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.businessName}</Text>
              <Text style={styles.meta}>
                {statusLabelPt(item.status)} · {formatOrderTime(item.updatedAt)}
              </Text>
            </View>
            <Text
              style={[
                styles.pay,
                item.status === 'cancelado' && { color: theme.colors.textMuted },
              ]}
            >
              {item.status === 'entregue' ? formatPrice(driverEarningsOf(item)) : '—'}
            </Text>
          </TouchableOpacity>
        )}
      />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  summary: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  summaryLbl: { color: theme.colors.textMuted, fontSize: 12 },
  summaryVal: { fontSize: 26, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  summaryMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { color: theme.colors.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  title: { fontWeight: '700', color: theme.colors.text },
  meta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  pay: { fontWeight: '800', color: '#059669' },
});
