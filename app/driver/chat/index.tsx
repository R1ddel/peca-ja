import React, { useCallback, useState } from 'react';
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
import { driverFleetId, listDriverActive, listDriverHistory, statusLabelPt } from '@/utils/driverOps';
import { loadChat } from '@/services/orderChat';
import { formatOrderTime } from '@/utils/datetime';
import { theme } from '@/constants/theme';

type ThreadRow = {
  orderId: string;
  businessName: string;
  status: string;
  preview: string;
  updatedAt: string;
  active: boolean;
};

export default function DriverChatInboxScreen() {
  const { user } = useAuth();
  const { orders } = useOrders();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const app = await resolveDriverApplication(user?.email);
    const id = app?.status === 'approved' ? driverFleetId(app) : null;
    if (!id) {
      setThreads([]);
      setReady(true);
      return;
    }
    const scope = [
      ...listDriverActive(orders, id),
      ...listDriverHistory(orders, id).filter((o) => o.status === 'entregue'),
    ];
    const rows: ThreadRow[] = [];
    for (const o of scope) {
      const msgs = await loadChat(o.id, 'driver');
      const last = msgs[msgs.length - 1];
      rows.push({
        orderId: o.id,
        businessName: o.businessName,
        status: o.status,
        preview: last?.text || 'Abrir conversa com cliente e loja',
        updatedAt: last?.createdAt || o.updatedAt,
        active: o.status !== 'entregue' && o.status !== 'cancelado',
      });
    }
    rows.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    setThreads(rows);
    setReady(true);
  }, [user?.email, orders]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
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
      <BackHeader title="Conversas" fallbackHref="/driver" />
      <FlatList
        data={threads}
        keyExtractor={(i) => i.orderId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>
              Aceite uma corrida para conversar com o cliente e a loja.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.88}
            onPress={() =>
              router.push({
                pathname: '/driver/chat/[orderId]' as any,
                params: { orderId: item.orderId },
              })
            }
          >
            <View style={[styles.icon, !item.active && { opacity: 0.5 }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#EC4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.businessName}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.preview}
              </Text>
              <Text style={styles.meta}>
                {statusLabelPt(item.status)} · {formatOrderTime(item.updatedAt)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
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
  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyText: { color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EC489922',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '800', color: theme.colors.text },
  preview: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
});
