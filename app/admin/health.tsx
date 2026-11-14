/**
 * Saúde da plataforma (web).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminHealth } from '@/services/platformClient';
import { hqStyles } from '@/app/admin/_ui';
import { ErrBox, KpiCard, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminHealthScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [health, setHealth] = useState<any>(null);
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
      const res = await platformAdminHealth(token);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao checar saúde.');
        return;
      }
      setHealth((res as any).health);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  const h = health || {};
  const tone = (status?: string) =>
    status === 'online' ? 'green' : status === 'not_configured' ? 'amber' : 'red';

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader title="Saúde" lead={h.time ? `Checado em ${h.time}` : 'Status dos serviços'} />
      <ErrBox message={err} />
      {!health && !loading ? (
        <Text style={hqStyles.empty}>Sem dados.</Text>
      ) : (
        <>
          <View style={hqStyles.row}>
            <KpiCard
              label="Plataforma"
              value={h.platform?.status || '—'}
              tone={tone(h.platform?.status) as any}
            />
            <KpiCard
              label="Frota"
              value={h.fleet?.status || '—'}
              tone={tone(h.fleet?.status) as any}
            />
            <KpiCard
              label="Pagamentos"
              value={h.payments?.status || '—'}
              tone={tone(h.payments?.status) as any}
            />
          </View>
          <View style={hqStyles.card}>
            <Text style={hqStyles.lead}>
              Persistência plataforma: {h.platform?.persistence || '—'} · rev{' '}
              {h.platform?.revision ?? '—'}
            </Text>
            <Text style={hqStyles.lead}>
              Persistência frota: {h.fleet?.persistence || '—'}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
