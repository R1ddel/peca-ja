/**
 * Qualidade de dados (web).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminDataQuality } from '@/services/platformClient';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminQualityScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [quality, setQuality] = useState<any>(null);
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
      const res = await platformAdminDataQuality(token);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha na checagem.');
        return;
      }
      setQuality((res as any).quality);
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

  const issues: any[] = quality?.issues || [];

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader
        title="Qualidade de dados"
        lead={quality?.checkedAt ? `Checado em ${quality.checkedAt}` : 'Inconsistências detectadas'}
      />
      <ErrBox message={err} />
      {issues.length === 0 && !loading ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>Nenhum problema encontrado.</Text>
        </View>
      ) : (
        issues.map((iss) => (
          <View
            key={iss.code}
            style={[
              hqStyles.card,
              {
                borderLeftWidth: 3,
                borderLeftColor: iss.severity === 'red' ? hq.red : hq.amber,
              },
            ]}
          >
            <Text style={hqStyles.tableCell}>
              {iss.code} · {iss.count}
            </Text>
            <Text style={hqStyles.lead}>{iss.message}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
