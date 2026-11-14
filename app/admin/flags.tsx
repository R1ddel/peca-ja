/**
 * Feature flags (web).
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
import { platformAdminListFlags, platformAdminSetFlag } from '@/services/platformClient';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminFlagsScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [flags, setFlags] = useState<any[]>([]);
  const [key, setKey] = useState('');
  const [reason, setReason] = useState('');
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
      const res = await platformAdminListFlags(token);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao listar flags.');
        return;
      }
      setFlags(((res as any).flags || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function setFlag(flagKey: string, enabled: boolean) {
    if (reason.trim().length < 3) {
      setErr('Motivo obrigatório.');
      return;
    }
    setErr('');
    setMsg('');
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminSetFlag(
      token,
      { key: flagKey, enabled, scope: 'global' },
      reason.trim()
    );
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao alterar flag.');
      return;
    }
    setMsg(`Flag ${flagKey} → ${enabled ? 'on' : 'off'}`);
    await load();
  }

  async function createFlag() {
    if (!key.trim()) {
      setErr('Chave obrigatória.');
      return;
    }
    await setFlag(key.trim(), true);
    setKey('');
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader title="Feature flags" lead="Ligar/desligar capacidades com auditoria" />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      <TextInput
        style={[hqStyles.input, { marginBottom: 8 }]}
        placeholder="Motivo (obrigatório)"
        placeholderTextColor={hq.faint}
        value={reason}
        onChangeText={setReason}
      />

      <Text style={hqStyles.h2}>Nova flag</Text>
      <View style={hqStyles.card}>
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="chave.ex"
          placeholderTextColor={hq.faint}
          value={key}
          onChangeText={setKey}
          autoCapitalize="none"
        />
        <TouchableOpacity style={hqStyles.btn} onPress={() => void createFlag()}>
          <Text style={hqStyles.btnText}>Criar (enabled)</Text>
        </TouchableOpacity>
      </View>

      <Text style={hqStyles.h2}>Flags ({flags.length})</Text>
      {flags.length === 0 ? (
        <Text style={hqStyles.empty}>Nenhuma flag.</Text>
      ) : (
        flags.map((f) => (
          <View key={f.key} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {f.key} · {f.enabled ? 'ON' : 'OFF'} · {f.scope || 'global'}
            </Text>
            <Text style={hqStyles.lead}>{f.note || f.updatedAt || '—'}</Text>
            <View style={[hqStyles.row, { marginTop: 8 }]}>
              <TouchableOpacity style={hqStyles.btnGhost} onPress={() => void setFlag(f.key, true)}>
                <Text style={hqStyles.btnGhostText}>Ligar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={hqStyles.btnGhost} onPress={() => void setFlag(f.key, false)}>
                <Text style={hqStyles.btnGhostText}>Desligar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
