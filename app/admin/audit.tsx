/**
 * Auditoria — logs de ação HQ (web).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminAuditList } from '@/services/platformClient';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminAuditScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [logs, setLogs] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (search?: string) => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminAuditList(token, {
        q: (search ?? q).trim() || undefined,
        limit: 150,
      });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao carregar auditoria.');
        return;
      }
      setLogs(((res as any).logs || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, [q]);

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
      <PageHeader title="Auditoria" lead="Ações críticas do Command Center" />
      <View style={hqStyles.row}>
        <TextInput
          style={[hqStyles.input, { flex: 1, minWidth: 180 }]}
          placeholder="Buscar ação, ator, entidade…"
          placeholderTextColor={hq.faint}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => void load(q)}
        />
        <TouchableOpacity style={hqStyles.btn} onPress={() => void load(q)}>
          <Text style={hqStyles.btnText}>Buscar</Text>
        </TouchableOpacity>
      </View>
      <ErrBox message={err} />
      {logs.length === 0 && !loading ? (
        <Text style={hqStyles.empty}>Nenhum registro.</Text>
      ) : (
        logs.map((l) => (
          <View key={l.id || `${l.action}-${l.createdAt}`} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {l.action} · {l.entityType}/{l.entityId}
            </Text>
            <Text style={hqStyles.lead}>
              {l.actorEmail || l.actorUserId || '—'} · {l.reason || '—'} · {l.createdAt}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
