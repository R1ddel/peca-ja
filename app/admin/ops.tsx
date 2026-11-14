/**
 * Operação Agora — ao vivo (poll 12s + badges críticos).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminOpsNow, platformAdminOrderDetail } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { formatOrderTime } from '@/utils/datetime';
import { hq, hqStyles } from '@/app/admin/_ui';
import {
  ErrBox,
  KpiCard,
  LoadingBlock,
  PageHeader,
  LiveBadge,
  StatusPill,
  SectionCard,
} from '@/app/admin/_components';
import { AdminDrawer } from '@/app/admin/_drawer';
import { useHqMode } from '@/app/admin/_hqContext';

export default function AdminOpsScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const { mode, environmentLabel, isProjection } = useHqMode();
  const [ops, setOps] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Ops: useHqMode
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminOpsNow(token, mode);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao carregar operação.');
        return;
      }
      setOps((res as any).ops);
      setTick(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!ok) return;
    void load();
    const id = setInterval(() => void load(true), 12000);
    return () => clearInterval(id);
  }, [ok, load]);

  async function openOrder(orderId: string) {
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

  const delayed: any[] = ops?.delayed || [];
  const preparing: any[] = ops?.preparing || [];
  const newOrders: any[] = ops?.newOrders || [];
  const byStatus = ops?.byStatus || {};
  const critical = Number(ops?.delayedCount || 0) > 0;

  return (
    <>
      <ScrollView
        style={hqStyles.screen}
        contentContainerStyle={hqStyles.content}
        refreshControl={<RefreshControl refreshing={loading && !ops} onRefresh={() => void load()} />}
      >
        <PageHeader
          title="Operação"
          lead={`${isProjection ? environmentLabel + ' · ' : ''}Auto-refresh 12s · última sync ${tick || '—'}`}
          right={<LiveBadge text={critical ? 'CRÍTICO' : 'AO VIVO'} />}
        />
        <ErrBox message={err} />

        <View style={hqStyles.row}>
          <KpiCard label="Ativos" value={ops?.activeCount ?? '—'} tone="blue" />
          <KpiCard
            label="Atrasados"
            value={ops?.delayedCount ?? 0}
            tone={(ops?.delayedCount || 0) > 0 ? 'red' : 'green'}
            hint="> 90 min"
          />
          <KpiCard
            label="Sem entregador"
            value={ops?.awaitingDriverCount ?? 0}
            tone={(ops?.awaitingDriverCount || 0) > 0 ? 'amber' : 'green'}
          />
          <KpiCard label="Novos" value={newOrders.length} tone="blue" />
          <KpiCard label="Em preparo" value={preparing.length} tone="amber" />
        </View>

        <SectionCard title="Fila por status">
          <View style={hqStyles.row}>
            {Object.keys(byStatus).length === 0 ? (
              <Text style={hqStyles.empty}>Nenhum pedido ativo.</Text>
            ) : (
              Object.entries(byStatus).map(([st, n]) => (
                <View key={st} style={styles.statusChip}>
                  <Text style={styles.statusN}>{n as number}</Text>
                  <Text style={styles.statusL}>{st}</Text>
                </View>
              ))
            )}
          </View>
        </SectionCard>

        <SectionCard
          title="Pedidos atrasados"
          action={
            <TouchableOpacity onPress={() => router.push('/admin/problems' as any)}>
              <Text style={{ color: hq.greenDark, fontWeight: '800', fontSize: 12 }}>
                Central de Problemas →
              </Text>
            </TouchableOpacity>
          }
        >
          {delayed.length === 0 ? (
            <Text style={[hqStyles.empty, { paddingVertical: 8 }]}>Nenhum atraso no momento.</Text>
          ) : (
            delayed.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={styles.rowItem}
                onPress={() => router.push('/admin/problems' as any)}
              >
                <StatusPill label="ATRASO" tone="red" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {o.businessName || o.businessId}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {o.status} · {formatPrice(o.total || 0)} · {formatOrderTime(o.createdAt)}
                  </Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </SectionCard>

        <SectionCard title="Novos / em preparo">
          {[...newOrders, ...preparing].slice(0, 20).map((o) => (
            <TouchableOpacity key={o.id} style={styles.rowItem} onPress={() => void openOrder(o.id)}>
              <StatusPill
                label={o.status}
                tone={o.status === 'preparando' ? 'amber' : 'blue'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {o.businessName || o.id}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatPrice(o.total || 0)} · {o.customerName || '—'}
                </Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          ))}
          {!newOrders.length && !preparing.length ? (
            <Text style={[hqStyles.empty, { paddingVertical: 8 }]}>Fila vazia.</Text>
          ) : null}
        </SectionCard>
      </ScrollView>

      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Pedido"
        subtitle={detail?.order?.id}
      >
        {detailLoading ? (
          <LoadingBlock />
        ) : detail?.order ? (
          <View style={{ gap: 12 }}>
            <Text style={hqStyles.lead}>
              {detail.order.businessName} · {detail.order.status} · {formatPrice(detail.order.total)}
            </Text>
            <Text style={hqStyles.h2}>Timeline</Text>
            {(detail.timeline || []).map((ev: any, i: number) => (
              <View key={i} style={styles.tl}>
                <Text style={styles.rowTitle}>{ev.label}</Text>
                <Text style={styles.rowMeta}>
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
  statusChip: {
    backgroundColor: hq.panel2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 88,
    borderWidth: 1,
    borderColor: hq.line,
  },
  statusN: { color: hq.text, fontSize: 20, fontWeight: '800' },
  statusL: { color: hq.muted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: hq.line,
  },
  rowTitle: { color: hq.text, fontSize: 13, fontWeight: '700' },
  rowMeta: { color: hq.muted, fontSize: 12, marginTop: 2 },
  chev: { color: hq.faint, fontSize: 22, fontWeight: '300' },
  tl: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: hq.line },
});
