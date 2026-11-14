/**
 * Mapa operacional — lista de entregadores e lojas com coordenadas (web).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminListShops } from '@/services/platformClient';
import { fleetAdminRemote } from '@/services/fleetClient';
import { hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminMapScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
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
      const [fleet, shopsRes] = await Promise.all([
        fleetAdminRemote({ token, adminAction: 'list' }),
        platformAdminListShops(token),
      ]);
      if (!fleet?.ok) {
        setErr((fleet as any)?.message || 'Falha na frota.');
      } else {
        setDrivers(Object.values((fleet as any).drivers || {}));
      }
      if (shopsRes?.ok) {
        setShops(((shopsRes as any).shops || []) as any[]);
      }
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

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader
        title="Mapa operacional"
        lead="Lista com coordenadas · mapa visual pode ser ligado depois"
      />
      <ErrBox message={err} />

      <Text style={hqStyles.h2}>Entregadores ({drivers.length})</Text>
      {drivers.length === 0 ? (
        <Text style={hqStyles.empty}>Nenhum entregador na frota.</Text>
      ) : (
        drivers.map((d) => (
          <View key={d.fleetId} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {d.name || d.fleetId} {d.online ? '· online' : '· offline'}
              {d.blocked ? ' · BLOQUEADO' : ''}
            </Text>
            <Text style={hqStyles.lead}>
              lat {d.latitude ?? '—'} · lng {d.longitude ?? '—'} · {d.fleetId}
            </Text>
          </View>
        ))
      )}

      <Text style={hqStyles.h2}>Lojas ({shops.length})</Text>
      {shops.length === 0 ? (
        <Text style={hqStyles.empty}>Nenhuma loja.</Text>
      ) : (
        shops.map((s) => (
          <View key={s.businessId} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {s.name} · {s.city || '—'}
              {s.suspended ? ' · suspensa' : s.isOpen ? ' · aberta' : ' · fechada'}
            </Text>
            <Text style={hqStyles.lead}>
              lat {s.latitude ?? '—'} · lng {s.longitude ?? '—'} · {s.businessId}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
