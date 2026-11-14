/**
 * Financeiro — overview + ledger (web).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminFinanceOverview, platformAdminLedgerList } from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';
import {
  ErrBox,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  MiniBars,
  EnvBanner,
} from '@/app/admin/_components';
import { useHqMode } from '@/app/admin/_hqContext';

export default function AdminFinanceScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const { mode, environmentLabel } = useHqMode();
  const [days, setDays] = useState(30);
  const [finance, setFinance] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const [f, l] = await Promise.all([
        platformAdminFinanceOverview(token, days, mode),
        platformAdminLedgerList(token, { limit: 80 }),
      ]);
      if (!f?.ok) {
        setErr((f as any)?.message || 'Falha financeira.');
        return;
      }
      setFinance((f as any).finance);
      if (l?.ok) setLedger(((l as any).ledger || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, [days, mode]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  const fin = finance || {};
  const series = fin.series || {};
  const chartHint =
    days > 14 ? `Gráfico: últimos 14 dias (filtro ${days}d)` : `Gráfico: últimos ${days} dias`;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <EnvBanner mode={mode} label={fin.environmentLabel || environmentLabel} />
      <PageHeader title="Financeiro" lead="GMV, taxas e extrato do ledger" />
      <View style={hqStyles.row}>
        {[7, 30, 90].map((d) => (
          <TouchableOpacity
            key={d}
            style={[hqStyles.btnGhost, days === d && { borderColor: hq.green, backgroundColor: hq.greenDim }]}
            onPress={() => setDays(d)}
          >
            <Text style={hqStyles.btnGhostText}>{d} dias</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ErrBox message={err} />

      <View style={hqStyles.row}>
        <KpiCard label="GMV" value={formatPrice(fin.gmv || 0)} tone="green" />
        <KpiCard label="Taxa plataforma" value={formatPrice(fin.platformFee || 0)} tone="blue" />
        <KpiCard label="Líquido lojas" value={formatPrice(fin.merchantNet || 0)} />
        <KpiCard label="Saldo plataforma" value={formatPrice(fin.platformBalance || 0)} />
        <KpiCard label="Pagos" value={fin.paidCount || 0} />
        <KpiCard label="Saques" value={formatPrice(fin.withdrawals || 0)} tone="amber" />
      </View>

      {series.gmv?.length ? (
        <SectionCard title="Tendência" action={<Text style={styles.hint}>{chartHint}</Text>}>
          <Text style={hqStyles.h2}>GMV diário</Text>
          <MiniBars values={series.gmv} height={96} color={hq.green} />
          <View style={styles.labels}>
            {(series.labels || []).map((lb: string, i: number) => (
              <Text key={i} style={styles.lbl}>
                {lb}
              </Text>
            ))}
          </View>
          <Text style={[hqStyles.h2, { marginTop: 16 }]}>Taxa plataforma</Text>
          <MiniBars values={series.platformFee || []} height={64} color={hq.blue} />
        </SectionCard>
      ) : null}

      <Text style={hqStyles.h2}>Ledger recente</Text>
      {ledger.length === 0 ? (
        <Text style={hqStyles.empty}>Sem lançamentos.</Text>
      ) : (
        ledger.map((e) => (
          <View key={e.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {e.kind} · {e.ownerType}/{e.ownerId} · {formatPrice(e.amount || 0)}
            </Text>
            <Text style={hqStyles.lead}>
              {e.note || '—'} · {e.createdAt}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { color: hq.muted, fontSize: 11, fontWeight: '600' },
  labels: { flexDirection: 'row', marginTop: 6 },
  lbl: { flex: 1, textAlign: 'center', color: hq.faint, fontSize: 9, fontWeight: '600' },
});
