/**
 * Cidades — listar, criar e status (web).
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
  platformAdminListCities,
  platformAdminSetCityStatus,
  platformAdminUpsertCity,
} from '@/services/platformClient';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

export default function AdminCitiesScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const [cities, setCities] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [stateUf, setStateUf] = useState('BA');
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
      const res = await platformAdminListCities(token);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao listar cidades.');
        return;
      }
      setCities(((res as any).cities || []) as any[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function upsert() {
    if (!name.trim()) {
      setErr('Nome obrigatório.');
      return;
    }
    setErr('');
    setMsg('');
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminUpsertCity(token, {
      name: name.trim(),
      state: stateUf.trim().toUpperCase() || 'BA',
      status: 'implanting',
    });
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao salvar cidade.');
      return;
    }
    setMsg('Cidade salva.');
    setName('');
    await load();
  }

  async function setStatus(id: string, status: 'active' | 'implanting' | 'inactive') {
    if (status === 'inactive' && reason.trim().length < 3) {
      setErr('Motivo obrigatório para desativar.');
      return;
    }
    setErr('');
    setMsg('');
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminSetCityStatus(token, id, status, reason.trim() || undefined);
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao alterar status.');
      return;
    }
    setMsg(`Status → ${status}`);
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
      <PageHeader title="Cidades" lead="Expansão e status operacional por município" />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      <Text style={hqStyles.h2}>Nova cidade</Text>
      <View style={hqStyles.card}>
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="Nome"
          placeholderTextColor={hq.faint}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="UF"
          placeholderTextColor={hq.faint}
          value={stateUf}
          onChangeText={setStateUf}
          maxLength={2}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={hqStyles.btn} onPress={() => void upsert()}>
          <Text style={hqStyles.btnText}>Salvar</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={hqStyles.input}
        placeholder="Motivo (obrigatório para desativar)"
        placeholderTextColor={hq.faint}
        value={reason}
        onChangeText={setReason}
      />

      <Text style={hqStyles.h2}>Lista</Text>
      {cities.length === 0 ? (
        <Text style={hqStyles.empty}>Nenhuma cidade.</Text>
      ) : (
        cities.map((c) => (
          <View key={c.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {c.name}/{c.state} · {c.status}
            </Text>
            <View style={[hqStyles.row, { marginTop: 8 }]}>
              {(['active', 'implanting', 'inactive'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[hqStyles.btnGhost, c.status === st && { borderColor: hq.green }]}
                  onPress={() => void setStatus(c.id, st)}
                >
                  <Text style={hqStyles.btnGhostText}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
