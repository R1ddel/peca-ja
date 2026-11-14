/**
 * Incidentes operacionais (web).
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
import {
  platformAdminListIncidents,
  platformAdminUpsertIncident,
} from '@/services/platformClient';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminIncidentsScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [impact, setImpact] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
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
      const res = await platformAdminListIncidents(token);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao listar incidentes.');
        return;
      }
      setRows(((res as any).incidents || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function create() {
    if (!title.trim()) {
      setErr('Título obrigatório.');
      return;
    }
    setErr('');
    setMsg('');
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminUpsertIncident(token, {
      title: title.trim(),
      severity: 'medium',
      service: 'platform',
      status: 'open',
      impact: impact.trim() || undefined,
    });
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao criar incidente.');
      return;
    }
    setMsg('Incidente aberto.');
    setTitle('');
    setImpact('');
    await load();
  }

  async function resolve(id: string) {
    const token = await getPlatformToken();
    if (!token) return;
    const prev = rows.find((r) => r.id === id);
    if (!prev) return;
    const res = await platformAdminUpsertIncident(token, {
      ...prev,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    });
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao resolver.');
      return;
    }
    setMsg('Incidente resolvido.');
    await load();
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader title="Incidentes" lead="Registro e resolução de falhas" />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      <Text style={hqStyles.h2}>Abrir incidente</Text>
      <View style={hqStyles.card}>
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="Título"
          placeholderTextColor={hq.faint}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="Impacto (opcional)"
          placeholderTextColor={hq.faint}
          value={impact}
          onChangeText={setImpact}
        />
        <TouchableOpacity style={hqStyles.btn} onPress={() => void create()}>
          <Text style={hqStyles.btnText}>Abrir</Text>
        </TouchableOpacity>
      </View>

      <Text style={hqStyles.h2}>Lista ({rows.length})</Text>
      {rows.length === 0 ? (
        <Text style={hqStyles.empty}>Nenhum incidente.</Text>
      ) : (
        rows.map((i) => (
          <View key={i.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              [{i.severity}] {i.title} · {i.status}
            </Text>
            <Text style={hqStyles.lead}>
              {i.service} · {i.impact || '—'} · {i.startedAt || i.updatedAt}
            </Text>
            {i.status !== 'resolved' ? (
              <TouchableOpacity
                style={[hqStyles.btnGhost, { marginTop: 8, alignSelf: 'flex-start' }]}
                onPress={() => void resolve(i.id)}
              >
                <Text style={hqStyles.btnGhostText}>Resolver</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}
