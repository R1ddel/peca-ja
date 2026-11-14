/**
 * Relatórios e exportação (web).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminExport, platformAdminReports } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, KpiCard, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminReportsScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [reports, setReports] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminReports(token, 30);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao carregar relatórios.');
        return;
      }
      setReports((res as any).reports);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function doExport(kind: 'customers' | 'orders' | 'ledger' | 'audit') {
    setBusy(kind);
    setErr('');
    setMsg('');
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminExport(token, kind, 30);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha na exportação.');
        return;
      }
      const rows = (res as any).rows || [];
      setMsg(`Export ${kind}: ${rows.length} linhas (ver console / audit).`);
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log(`[admin export ${kind}]`, rows);
      }
    } finally {
      setBusy('');
    }
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  const fin = reports?.finance || {};
  const byCity: any[] = reports?.byCity || [];

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader title="Relatórios" lead="Resumo 30 dias + exportação auditada" />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      <View style={hqStyles.row}>
        <KpiCard label="GMV 30d" value={formatPrice(fin.gmv || 0)} tone="green" />
        <KpiCard label="Taxa" value={formatPrice(fin.platformFee || 0)} tone="blue" />
        <KpiCard label="Pagos" value={fin.paidCount || 0} />
        <KpiCard label="Cancelados" value={fin.canceledCount || 0} tone="red" />
      </View>

      <Text style={hqStyles.h2}>Exportar</Text>
      <View style={hqStyles.row}>
        {(['customers', 'orders', 'ledger', 'audit'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            style={[hqStyles.btn, { opacity: busy === k ? 0.6 : 1 }]}
            disabled={!!busy}
            onPress={() => void doExport(k)}
          >
            <Text style={hqStyles.btnText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={hqStyles.h2}>Por cidade</Text>
      {byCity.length === 0 ? (
        <Text style={hqStyles.empty}>Sem dados por cidade.</Text>
      ) : (
        byCity.map((c) => (
          <View key={c.city} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {c.city} · {c.orders} pedidos · {formatPrice(c.gmv || 0)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
