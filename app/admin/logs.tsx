/**
 * Logs de sistema (web).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminListSystemLogs } from '@/services/platformClient';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminLogsScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [logs, setLogs] = useState<any[]>([]);
  const [level, setLevel] = useState<string>('');
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
      const res = await platformAdminListSystemLogs(token, {
        level: level || undefined,
        limit: 200,
      });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao carregar logs.');
        return;
      }
      setLogs(((res as any).logs || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, [level]);

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
      <PageHeader title="Logs do sistema" lead="Erros e eventos técnicos" />
      <View style={hqStyles.row}>
        {['', 'info', 'warn', 'error', 'critical'].map((lv) => (
          <TouchableOpacity
            key={lv || 'all'}
            style={[hqStyles.btnGhost, level === lv && { borderColor: hq.green }]}
            onPress={() => setLevel(lv)}
          >
            <Text style={hqStyles.btnGhostText}>{lv || 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ErrBox message={err} />
      {logs.length === 0 && !loading ? (
        <Text style={hqStyles.empty}>Nenhum log.</Text>
      ) : (
        logs.map((l) => (
          <View key={l.id || `${l.createdAt}-${l.message}`} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              [{l.level}] {l.service || '—'} · {l.message}
            </Text>
            <Text style={hqStyles.lead}>{l.createdAt}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
