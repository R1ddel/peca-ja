/**
 * Pedidos globais — Command Center (web).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminListOrders, platformAdminOrderDetail } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { formatOrderTime } from '@/utils/datetime';
import type { Order } from '@/types';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader, StatusPill } from '@/app/admin/_components';
import { AdminDrawer } from '@/app/admin/_drawer';

export default function AdminOrdersScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const params = useLocalSearchParams<{ sinceDays?: string; q?: string; status?: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [sinceDays, setSinceDays] = useState(Number(params.sinceDays) || 7);
  const [q, setQ] = useState(String(params.q || ''));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminListOrders(token, {
        sinceDays,
        q: q.trim() || undefined,
        status: params.status,
      });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao listar pedidos.');
        return;
      }
      setOrders(((res as any).orders || []) as Order[]);
    } finally {
      setLoading(false);
    }
  }, [sinceDays, q, params.status]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function openDetail(orderId: string) {
    setDrawerOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminOrderDetail(token, orderId);
      if (res?.ok) setDetail(res);
    } finally {
      setDetailLoading(false);
    }
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  const order = detail?.order;

  return (
    <>
      <ScrollView
        style={hqStyles.screen}
        contentContainerStyle={hqStyles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <PageHeader title="Pedidos" lead="Lista global com filtros e timeline" />
        <ErrBox message={err} />

        <View style={hqStyles.row}>
          {[1, 7, 30].map((d) => (
            <TouchableOpacity
              key={d}
              style={[hqStyles.btnGhost, sinceDays === d && { borderColor: hq.green }]}
              onPress={() => setSinceDays(d)}
            >
              <Text style={hqStyles.btnGhostText}>{d}d</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={hqStyles.input}
          placeholder="Buscar ID, cliente, loja, entregador…"
          placeholderTextColor={hq.faint}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => void load()}
        />

        <View style={hqStyles.card}>
          <View style={hqStyles.tableHead}>
            <Text style={[hqStyles.tableHeadText, { flex: 1.2 }]}>Pedido</Text>
            <Text style={[hqStyles.tableHeadText, { flex: 1 }]}>Status</Text>
            <Text style={[hqStyles.tableHeadText, { flex: 0.8 }]}>Total</Text>
            <Text style={[hqStyles.tableHeadText, { flex: 1 }]}>Quando</Text>
          </View>
          {orders.length === 0 ? (
            <Text style={hqStyles.empty}>Nenhum pedido no filtro.</Text>
          ) : (
            orders.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={hqStyles.tableRow}
                onPress={() => void openDetail(o.id)}
              >
                <View style={{ flex: 1.2 }}>
                  <Text style={hqStyles.tableCell} numberOfLines={1}>
                    {o.businessName}
                  </Text>
                  <Text style={{ color: hq.faint, fontSize: 11 }}>{o.id.slice(0, 10)}…</Text>
                </View>
                <Text style={[hqStyles.tableCell, { flex: 1 }]}>{o.status}</Text>
                <Text style={[hqStyles.tableCell, { flex: 0.8 }]}>{formatPrice(o.total)}</Text>
                <Text style={[hqStyles.tableCell, { flex: 1, color: hq.muted }]}>
                  {formatOrderTime(o.createdAt)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Pedido"
        subtitle={order?.id}
      >
        {detailLoading ? (
          <LoadingBlock />
        ) : order ? (
          <View style={{ gap: 12 }}>
            <View style={styles.metaRow}>
              <StatusPill label={order.status} tone="blue" />
              <Text style={styles.metaPrice}>{formatPrice(order.total)}</Text>
            </View>
            <Text style={hqStyles.lead}>
              {order.businessName}
              {order.customerName ? ` · ${order.customerName}` : ''}
            </Text>
            <Text style={hqStyles.h2}>Timeline</Text>
            {(detail.timeline || []).map((ev: any, i: number) => (
              <View key={i} style={styles.tl}>
                <Text style={styles.tlTitle}>{ev.label}</Text>
                <Text style={styles.tlMeta}>
                  {formatOrderTime(ev.at)}
                  {ev.meta ? ` · ${ev.meta}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={hqStyles.empty}>Não foi possível carregar.</Text>
        )}
      </AdminDrawer>
    </>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  metaPrice: { color: hq.text, fontSize: 18, fontWeight: '800' },
  tl: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: hq.line,
  },
  tlTitle: { color: hq.text, fontWeight: '700', fontSize: 14 },
  tlMeta: { color: hq.muted, fontSize: 12, marginTop: 2 },
});
